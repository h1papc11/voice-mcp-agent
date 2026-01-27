use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, Host, SampleFormat, StreamConfig};
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicUsize, Ordering};

#[derive(Debug, Clone, serde::Serialize)]
pub struct AudioOutputDevice {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

pub struct AudioOutputState {
    host: Host,
}

impl AudioOutputState {
    pub fn new() -> Self {
        Self {
            host: cpal::default_host(),
        }
    }

    pub fn list_output_devices(&self) -> Result<Vec<AudioOutputDevice>, String> {
        let devices = self
            .host
            .output_devices()
            .map_err(|e| format!("Failed to enumerate output devices: {}", e))?;

        let default_device = self.host.default_output_device();

        let mut result = Vec::new();
        for device in devices {
            let name = device
                .name()
                .map_err(|e| format!("Failed to get device name: {}", e))?;

            // Generate a stable ID from the device name (cpal doesn't provide stable IDs)
            let id = format!("device_{}", name.replace(' ', "_").to_lowercase());

            let is_default = default_device
                .as_ref()
                .map(|d| d.name().unwrap_or_default() == name)
                .unwrap_or(false);

            result.push(AudioOutputDevice {
                id,
                name,
                is_default,
            });
        }

        Ok(result)
    }

    pub async fn play_audio_to_devices(
        &self,
        audio_data: Vec<u8>,
        device_ids: Vec<String>,
    ) -> Result<(), String> {
        // Decode audio file (assuming WAV format)
        let (samples, sample_rate, channels) = self.decode_wav(&audio_data)?;

        // Find devices by ID
        let devices: Vec<Device> = self
            .host
            .output_devices()
            .map_err(|e| format!("Failed to enumerate devices: {}", e))?
            .filter_map(|device| {
                let name = device.name().ok()?;
                let id = format!("device_{}", name.replace(' ', "_").to_lowercase());
                if device_ids.contains(&id) {
                    Some(device)
                } else {
                    None
                }
            })
            .collect();

        if devices.is_empty() {
            return Err("No matching devices found".to_string());
        }

        // Play to each device
        for device in devices {
            self.play_to_device(&device, samples.clone(), sample_rate, channels)
                .map_err(|e| format!("Failed to play to device: {}", e))?;
        }

        Ok(())
    }

    fn decode_wav(&self, data: &[u8]) -> Result<(Vec<f32>, u32, u16), String> {
        use symphonia::core::formats::FormatOptions;
        use symphonia::core::io::MediaSourceStream;
        use symphonia::core::meta::MetadataOptions;
        use symphonia::core::probe::Probe;

        let mss = MediaSourceStream::new(
            Box::new(std::io::Cursor::new(data)),
            Default::default(),
        );

        let mut probe = Probe::default();
        let mut format = probe
            .format(
                &Default::default(),
                mss,
                &FormatOptions::default(),
                &MetadataOptions::default(),
            )
            .map_err(|e| format!("Failed to probe audio: {}", e))?
            .format;

        let track = format
            .tracks()
            .iter()
            .find(|t| t.codec_params.codec != symphonia::core::codecs::CODEC_TYPE_NULL)
            .ok_or("No audio track found")?;

        let sample_rate = track
            .codec_params
            .sample_rate
            .ok_or("No sample rate found")?;

        let channels = track
            .codec_params
            .channels
            .ok_or("No channels found")?
            .count() as u16;

        let mut decoder = symphonia::default::get_codecs()
            .make(&track.codec_params, &Default::default())
            .map_err(|e| format!("Failed to create decoder: {}", e))?;

        let mut samples = Vec::new();
        loop {
            let packet = match format.next_packet() {
                Ok(packet) => packet,
                Err(_) => break, // End of stream
            };

            let decoded = decoder
                .decode(&packet)
                .map_err(|e| format!("Decode error: {}", e))?;

            // Convert to f32 samples
            let spec = *decoded.spec();
            let duration = decoded.capacity() as u64;

            // Handle multi-channel audio
            if spec.channels.count() == 1 {
                // Mono
                let plane = decoded.plane(0);
                for i in 0..duration {
                    if let Some(&sample) = plane.get(i as usize) {
                        samples.push(sample as f32 / 32768.0);
                    }
                }
            } else {
                // Multi-channel - interleave
                for i in 0..duration {
                    for ch in 0..spec.channels.count() {
                        if let Some(plane) = decoded.plane(ch) {
                            if let Some(&sample) = plane.get(i as usize) {
                                samples.push(sample as f32 / 32768.0);
                            }
                        }
                    }
                }
            }
        }

        Ok((samples, sample_rate, channels))
    }

    fn play_to_device(
        &self,
        device: &Device,
        samples: Vec<f32>,
        sample_rate: u32,
        channels: u16,
    ) -> Result<(), String> {
        let config = device
            .default_output_config()
            .map_err(|e| format!("Failed to get default config: {}", e))?;

        // Prepare samples for the device's format
        let device_sample_rate = config.sample_rate().0;
        let device_channels = config.channels();

        // Resample if needed (simple linear interpolation for now)
        let resampled = if device_sample_rate != sample_rate {
            self.resample(&samples, sample_rate, device_sample_rate)
        } else {
            samples
        };

        // Interleave/convert channels if needed
        let interleaved = self.interleave_channels(&resampled, channels, device_channels);

        // Create shared buffer for playback
        let buffer: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(interleaved));
        let position = Arc::new(AtomicUsize::new(0));
        let buffer_clone = buffer.clone();
        let position_clone = position.clone();

        let err_fn = |err| eprintln!("Playback error: {}", err);

        let stream_config = StreamConfig {
            channels: device_channels,
            sample_rate: cpal::SampleRate(device_sample_rate),
            buffer_size: cpal::BufferSize::Default,
        };

        let stream = match config.sample_format() {
            SampleFormat::F32 => {
                let buffer = buffer_clone.clone();
                let pos = position_clone.clone();
                device
                    .build_output_stream(
                        &stream_config,
                        move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                            let mut idx = pos.load(Ordering::Relaxed);
                            let buf = buffer.lock().unwrap();
                            for sample in data.iter_mut() {
                                if idx < buf.len() {
                                    *sample = buf[idx];
                                    idx += 1;
                                } else {
                                    *sample = 0.0;
                                }
                            }
                            pos.store(idx, Ordering::Relaxed);
                        },
                        err_fn,
                        None,
                    )
                    .map_err(|e| format!("Failed to build stream: {}", e))?
            }
            SampleFormat::I16 => {
                let buffer = buffer_clone.clone();
                let pos = position_clone.clone();
                device
                    .build_output_stream(
                        &stream_config,
                        move |data: &mut [i16], _: &cpal::OutputCallbackInfo| {
                            let mut idx = pos.load(Ordering::Relaxed);
                            let buf = buffer.lock().unwrap();
                            for sample in data.iter_mut() {
                                if idx < buf.len() {
                                    *sample = (buf[idx] * 32767.0) as i16;
                                    idx += 1;
                                } else {
                                    *sample = 0;
                                }
                            }
                            pos.store(idx, Ordering::Relaxed);
                        },
                        err_fn,
                        None,
                    )
                    .map_err(|e| format!("Failed to build stream: {}", e))?
            }
            SampleFormat::U16 => {
                let buffer = buffer_clone.clone();
                let pos = position_clone.clone();
                device
                    .build_output_stream(
                        &stream_config,
                        move |data: &mut [u16], _: &cpal::OutputCallbackInfo| {
                            let mut idx = pos.load(Ordering::Relaxed);
                            let buf = buffer.lock().unwrap();
                            for sample in data.iter_mut() {
                                if idx < buf.len() {
                                    *sample = ((buf[idx] + 1.0) * 32767.5) as u16;
                                    idx += 1;
                                } else {
                                    *sample = 32768;
                                }
                            }
                            pos.store(idx, Ordering::Relaxed);
                        },
                        err_fn,
                        None,
                    )
                    .map_err(|e| format!("Failed to build stream: {}", e))?
            }
            _ => return Err("Unsupported sample format".to_string()),
        };

        stream.play().map_err(|e| format!("Failed to play stream: {}", e))?;

        // Keep stream alive until playback completes
        // In a real implementation, we'd track this and clean up when done
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_secs(30)); // Max 30s
        });

        Ok(())
    }

    fn resample(&self, samples: &[f32], from_rate: u32, to_rate: u32) -> Vec<f32> {
        if from_rate == to_rate {
            return samples.to_vec();
        }

        let ratio = to_rate as f64 / from_rate as f64;
        let new_len = (samples.len() as f64 * ratio) as usize;
        let mut resampled = Vec::with_capacity(new_len);

        for i in 0..new_len {
            let src_idx = (i as f64 / ratio) as usize;
            if src_idx < samples.len() {
                resampled.push(samples[src_idx]);
            } else {
                resampled.push(0.0);
            }
        }

        resampled
    }

    fn interleave_channels(
        &self,
        samples: &[f32],
        src_channels: u16,
        dst_channels: u16,
    ) -> Vec<f32> {
        if src_channels == dst_channels {
            return samples.to_vec();
        }

        let mut interleaved = Vec::new();
        let samples_per_channel = samples.len() / src_channels as usize;

        for i in 0..samples_per_channel {
            for ch in 0..dst_channels {
                let src_ch = if ch < src_channels { ch } else { src_channels - 1 };
                let idx = (i * src_channels as usize) + src_ch as usize;
                if idx < samples.len() {
                    interleaved.push(samples[idx]);
                } else {
                    interleaved.push(0.0);
                }
            }
        }

        interleaved
    }
}

impl Default for AudioOutputState {
    fn default() -> Self {
        Self::new()
    }
}
