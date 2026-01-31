use crate::audio_capture::AudioCaptureState;

pub async fn start_capture(
    state: &AudioCaptureState,
    max_duration_secs: u32,
) -> Result<(), String> {
    todo!("implement Linux audio capture")
}

pub async fn stop_capture(state: &AudioCaptureState) -> Result<String, String> {
    todo!("implement Linux audio capture stop")
}

pub fn is_supported() -> bool {
    false
}
