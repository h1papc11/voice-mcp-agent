use crate::audio_capture::AudioCaptureState;
use base64::{engine::general_purpose, Engine as _};
use hound::{WavSpec, WavWriter};
use std::io::Cursor;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use wasapi::*;
use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_MULTITHREADED};

pub async fn start_capture(
    state: &AudioCaptureState,
    max_duration_secs: u32,
) -> Result<(), String> {
    // Reset previous samples
    state.reset();

    let samples = state.samples.clone();
    let sample_rate_arc = state.sample_rate.clone();
    let channels_arc = state.channels.clone();
    let stop_tx = state.stop_tx.clone();
    let error_arc = state.error.clone();

    // Use AtomicBool for stop signal (works with non-Send types)
    let stop_flag = Arc::new(AtomicBool::new(false));
    let stop_flag_clone = stop_flag.clone();

    // Create tokio channel and spawn a task to bridge it to the AtomicBool
    let (tx, mut rx) = tokio::sync::mpsc::channel::<()>(1);
    *stop_tx.lock().unwrap() = Some(tx);

    tokio::spawn(async move {
        rx.recv().await;
        stop_flag_clone.store(true, Ordering::Relaxed);
    });

    // Spawn capture task on a dedicated thread (WASAPI COM objects are not Send)
    // All WASAPI objects must be created and used on the same thread
    thread::spawn(move || {
        // Initialize COM for this thread
        unsafe {
            let hr = CoInitializeEx(None, COINIT_MULTITHREADED);
            if hr.is_err() {
                eprintln!("Failed to initialize COM: {:?}", hr);
                return;
            }
        }

        // Ensure COM is uninitialized when thread exits
        let _com_guard = scopeguard::guard((), |_| unsafe {
            CoUninitialize();
        });

        // Initialize WASAPI on this thread
        let device = match DeviceEnumerator::new()
            .and_then(|enumerator| enumerator.get_default_device(&Direction::Render))
        {
            Ok(d) => d,
            Err(e) => {
                let error_msg = format!("Failed to get audio device: {}", e);
                eprintln!("{}", error_msg);
                *error_arc.lock().unwrap() = Some(error_msg);
                return;
            }
        };

        let mut audio_client = match device.get_iaudioclient() {
            Ok(client) => client,
            Err(e) => {
                let error_msg = format!("Failed to get audio client: {}", e);
                eprintln!("{}", error_msg);
                *error_arc.lock().unwrap() = Some(error_msg);
                return;
            }
        };

        let mix_format = match audio_client.get_mixformat() {
            Ok(format) => format,
            Err(e) => {
                let error_msg = format!("Failed to get mix format: {}", e);
                eprintln!("{}", error_msg);
                *error_arc.lock().unwrap() = Some(error_msg);
                return;
            }
        };

        // Set sample rate and channels
        let channels = mix_format.get_nchannels() as usize;
        let bytes_per_sample = (mix_format.get_bitspersample() / 8) as usize;
        *sample_rate_arc.lock().unwrap() = mix_format.get_samplespersec();
        *channels_arc.lock().unwrap() = mix_format.get_nchannels();

        // Get device period
        let (_def_period, min_period) = match audio_client.get_device_period() {
            Ok(periods) => periods,
            Err(e) => {
                eprintln!("Failed to get device period: {}", e);
                return;
            }
        };

        // Initialize audio client for loopback with StreamMode
        // For loopback mode: get Render device, initialize with Capture direction
        // This triggers AUDCLNT_STREAMFLAGS_LOOPBACK in the wasapi crate
        let stream_mode = StreamMode::EventsShared {
            autoconvert: true,  // Enable automatic format conversion
            buffer_duration_hns: min_period, // Use minimum period
        };

        if let Err(e) = audio_client.initialize_client(&mix_format, &Direction::Capture, &stream_mode) {
            let error_msg = format!("Failed to initialize audio client: {}", e);
            eprintln!("{}", error_msg);
            *error_arc.lock().unwrap() = Some(error_msg);
            return;
        }

        // Set up event handle for EventsShared mode
        let h_event = match audio_client.set_get_eventhandle() {
            Ok(event) => event,
            Err(e) => {
                eprintln!("Failed to set event handle: {}", e);
                return;
            }
        };

        let capture_client = match audio_client.get_audiocaptureclient() {
            Ok(client) => client,
            Err(e) => {
                let error_msg = format!("Failed to get capture client: {}", e);
                eprintln!("{}", error_msg);
                *error_arc.lock().unwrap() = Some(error_msg);
                return;
            }
        };

        if let Err(e) = audio_client.start_stream() {
            let error_msg = format!("Failed to start stream: {}", e);
            eprintln!("{}", error_msg);
            *error_arc.lock().unwrap() = Some(error_msg);
            return;
        }

        loop {
            // Check if stop signal was received
            if stop_flag.load(Ordering::Relaxed) {
                break;
            }

            // Try to get available data
            match capture_client.get_next_packet_size() {
                Ok(Some(frames_available)) => {
                    if frames_available > 0 {
                        // Calculate buffer size needed (frames * channels * bytes_per_sample)
                        let buffer_size = frames_available as usize * channels * bytes_per_sample;

                        let mut buffer = vec![0u8; buffer_size];
                        match capture_client.read_from_device(&mut buffer) {
                            Ok((frames_read, _buffer_info)) => {
                                if frames_read > 0 {
                                    // Convert bytes to f32 samples
                                    let samples_read = (frames_read as usize * channels) as usize;
                                    let mut samples_guard = samples.lock().unwrap();

                                    // Assuming 32-bit float format
                                    if bytes_per_sample == 4 {
                                        for i in 0..samples_read {
                                            let byte_offset = i * 4;
                                            if byte_offset + 4 <= buffer.len() {
                                                let sample = f32::from_le_bytes([
                                                    buffer[byte_offset],
                                                    buffer[byte_offset + 1],
                                                    buffer[byte_offset + 2],
                                                    buffer[byte_offset + 3],
                                                ]);
                                                samples_guard.push(sample);
                                            }
                                        }
                                    }
                                }
                            }
                            Err(e) => {
                                eprintln!("Error reading from device: {}", e);
                            }
                        }
                    }
                }
                Ok(None) => {
                    // Exclusive mode - handle differently if needed
                }
                Err(e) => {
                    eprintln!("Error getting next packet size: {}", e);
                }
            }

            // Wait for event signal (with timeout to allow checking stop flag)
            if h_event.wait_for_event(100).is_err() {
                // Timeout is expected - just continue to check stop flag
            }
        }

        // Stop the stream when done
        audio_client.stop_stream().ok();
    });

    // Spawn timeout task
    let stop_tx_clone = state.stop_tx.clone();
    tokio::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_secs(max_duration_secs as u64)).await;
        // Take the sender out of the mutex before awaiting
        let tx = stop_tx_clone.lock().unwrap().take();
        if let Some(tx) = tx {
            let _ = tx.send(()).await;
        }
    });

    Ok(())
}

pub async fn stop_capture(state: &AudioCaptureState) -> Result<String, String> {
    // Signal stop
    if let Some(tx) = state.stop_tx.lock().unwrap().take() {
        let _ = tx.send(());
    }

    // Wait a bit for capture to stop
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // Check if there was an error during capture
    if let Some(error) = state.error.lock().unwrap().as_ref() {
        return Err(error.clone());
    }

    // Get samples
    let samples = state.samples.lock().unwrap().clone();
    let sample_rate = *state.sample_rate.lock().unwrap();
    let channels = *state.channels.lock().unwrap();

    if samples.is_empty() {
        return Err("No audio samples captured. Make sure audio is playing on your system during recording.".to_string());
    }

    // Convert to WAV
    let wav_data = samples_to_wav(&samples, sample_rate, channels)?;
    
    // Encode to base64
    let base64_data = general_purpose::STANDARD.encode(&wav_data);
    
    Ok(base64_data)
}

pub fn is_supported() -> bool {
    #[cfg(target_os = "windows")]
    {
        true
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

fn samples_to_wav(samples: &[f32], sample_rate: u32, channels: u16) -> Result<Vec<u8>, String> {
    let mut buffer = Vec::new();
    let cursor = Cursor::new(&mut buffer);
    
    let spec = WavSpec {
        channels,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut writer = WavWriter::new(cursor, spec)
        .map_err(|e| format!("Failed to create WAV writer: {}", e))?;

    // Convert f32 samples to i16
    for sample in samples {
        let clamped = sample.clamp(-1.0, 1.0);
        let i16_sample = (clamped * 32767.0) as i16;
        writer.write_sample(i16_sample)
            .map_err(|e| format!("Failed to write sample: {}", e))?;
    }

    writer.finalize()
        .map_err(|e| format!("Failed to finalize WAV: {}", e))?;

    Ok(buffer)
}
