use crate::audio_capture::AudioCaptureState;
use base64::{engine::general_purpose, Engine as _};
use hound::{WavSpec, WavWriter};
use std::io::Cursor;
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;
use wasapi::*;

pub async fn start_capture(
    state: &AudioCaptureState,
    max_duration_secs: u32,
) -> Result<(), String> {
    // Reset previous samples
    state.reset();

    // Get default audio render device for loopback
    let device = DeviceEnumerator::new()
        .map_err(|e| format!("Failed to create device enumerator: {}", e))?
        .get_default_audio_endpoint(&Direction::Render)
        .map_err(|e| format!("Failed to get default render device: {}", e))?;

    // Create audio client for loopback capture
    let audio_client = device
        .get_iaudioclient()
        .map_err(|e| format!("Failed to get audio client: {}", e))?;

    // Get mix format
    let mix_format = audio_client
        .get_mixformat()
        .map_err(|e| format!("Failed to get mix format: {}", e))?;

    // Set sample rate and channels
    *state.sample_rate.lock().unwrap() = mix_format.get_samples_per_sec();
    *state.channels.lock().unwrap() = mix_format.get_nchannels();

    // Initialize audio client for loopback
    audio_client
        .initialize_client(
            &mix_format,
            0, // Buffer duration (0 = default)
            &Direction::Capture,
            ShareMode::Shared,
            true, // Loopback mode
        )
        .map_err(|e| format!("Failed to initialize audio client: {}", e))?;

    // Get capture client
    let capture_client = audio_client
        .get_audiocaptureclient()
        .map_err(|e| format!("Failed to get capture client: {}", e))?;

    // Start capture
    audio_client
        .start_stream()
        .map_err(|e| format!("Failed to start stream: {}", e))?;

    let samples = state.samples.clone();
    let stop_tx = state.stop_tx.clone();
    let (tx, mut rx) = mpsc::channel::<()>(1);
    *stop_tx.lock().unwrap() = Some(tx);

    // Spawn capture task - move audio_client and capture_client into the task
    tokio::spawn(async move {
        loop {
            tokio::select! {
                _ = rx.recv() => {
                    break;
                }
                _ = tokio::time::sleep(tokio::time::Duration::from_millis(10)) => {
                    // Try to get available data
                    match capture_client.get_available_samples() {
                        Ok(available) => {
                            if available > 0 {
                                match capture_client.get_buffer::<f32>() {
                                    Ok((data, flags)) => {
                                        if flags.contains(&StreamFlags::SILENT) {
                                            // Silent buffer, skip
                                            capture_client.release_buffer(available).ok();
                                            continue;
                                        }
                                        
                                        // Convert samples to f32 and store
                                        let mut samples_guard = samples.lock().unwrap();
                                        samples_guard.extend_from_slice(data);
                                        capture_client.release_buffer(available).ok();
                                    }
                                    Err(e) => {
                                        eprintln!("Error getting buffer: {}", e);
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!("Error getting available samples: {}", e);
                        }
                    }
                }
            }
        }
        
        // Stop the stream when done
        audio_client.stop_stream().ok();
    });

    // Spawn timeout task
    let stop_tx_clone = state.stop_tx.clone();
    tokio::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_secs(max_duration_secs as u64)).await;
        if let Some(tx) = stop_tx_clone.lock().unwrap().take() {
            let _ = tx.send(());
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

    // Get samples
    let samples = state.samples.lock().unwrap().clone();
    let sample_rate = *state.sample_rate.lock().unwrap();
    let channels = *state.channels.lock().unwrap();

    if samples.is_empty() {
        return Err("No audio samples captured".to_string());
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
