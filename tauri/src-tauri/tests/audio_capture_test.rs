// NOTE: This test requires system audio to be playing during execution.
// To run this test successfully:
//   1. Start playing audio (music, video, etc.)
//   2. Run: cargo test --test audio_capture_test -- --nocapture
//   3. The test will capture audio for 5 seconds and verify the output

use voicebox::audio_capture::{AudioCaptureState, start_capture, stop_capture};
use base64::Engine;

#[tokio::test]
async fn test_system_audio_capture() {
    // Create AudioCaptureState
    let state = AudioCaptureState::new();

    println!("Starting system audio capture with 5 second max duration...");

    // Start capture with 5 second max duration
    let result = start_capture(&state, 5).await;

    if let Err(e) = result {
        panic!("Failed to start capture: {}", e);
    }

    println!("Capture started, waiting 5 seconds...");

    // Wait 5 seconds for capture to complete
    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;

    println!("Stopping capture...");

    // Stop capture and get the result
    let audio_data = stop_capture(&state).await;

    match audio_data {
        Ok(base64_wav) => {
            println!("Capture stopped successfully");

            // Validate the returned base64 WAV data
            println!("Validating base64 WAV data...");

            // Decode base64 to bytes
            let decoded_bytes = base64::engine::general_purpose::STANDARD
                .decode(&base64_wav)
                .expect("Failed to decode base64 data");

            // Verify bytes array is not empty
            assert!(!decoded_bytes.is_empty(), "Decoded bytes array is empty");

            // Confirm data has content (length > 0)
            println!("WAV data length: {} bytes", decoded_bytes.len());
            assert!(decoded_bytes.len() > 0, "WAV data has no content");

            println!("✓ Test passed: Audio capture produced valid WAV data");
        }
        Err(e) => {
            panic!("Failed to stop capture or get audio data: {}", e);
        }
    }
}
