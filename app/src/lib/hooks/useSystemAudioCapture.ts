import { useState, useRef, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@/lib/tauri';

interface UseSystemAudioCaptureOptions {
  maxDurationSeconds?: number;
  onRecordingComplete?: (blob: Blob) => void;
}

/**
 * Hook for native system audio capture using Tauri commands.
 * Uses ScreenCaptureKit on macOS and WASAPI loopback on Windows.
 */
export function useSystemAudioCapture({
  maxDurationSeconds = 30,
  onRecordingComplete,
}: UseSystemAudioCaptureOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const stopRecordingRef = useRef<(() => Promise<void>) | null>(null);

  // Check if system audio capture is supported
  useEffect(() => {
    if (!isTauri()) {
      setIsSupported(false);
      return;
    }

    invoke<boolean>('is_system_audio_supported')
      .then((supported) => {
        setIsSupported(supported);
      })
      .catch(() => {
        setIsSupported(false);
      });
  }, []);

  const startRecording = useCallback(async () => {
    if (!isTauri()) {
      const errorMsg = 'System audio capture is only available in the desktop app.';
      setError(errorMsg);
      return;
    }

    if (!isSupported) {
      const errorMsg = 'System audio capture is not supported on this platform.';
      setError(errorMsg);
      return;
    }

    try {
      setError(null);
      setDuration(0);

      // Start native capture
      await invoke('start_system_audio_capture', {
        maxDurationSecs: maxDurationSeconds,
      });

      setIsRecording(true);
      startTimeRef.current = Date.now();

      // Start timer
      timerRef.current = window.setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          setDuration(elapsed);

          // Auto-stop at max duration
          if (elapsed >= maxDurationSeconds && stopRecordingRef.current) {
            void stopRecordingRef.current();
          }
        }
      }, 100);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to start system audio capture. Please check permissions.';
      setError(errorMessage);
      setIsRecording(false);
    }
  }, [maxDurationSeconds, isSupported]);

  const stopRecording = useCallback(async () => {
    if (!isRecording || !isTauri()) {
      return;
    }

    try {
      setIsRecording(false);

      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Stop capture and get base64 WAV data
      const base64Data = await invoke<string>('stop_system_audio_capture');

      // Convert base64 to Blob
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: 'audio/wav' });
      onRecordingComplete?.(blob);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to stop system audio capture.';
      setError(errorMessage);
    }
  }, [isRecording, onRecordingComplete]);

  // Store stopRecording in ref for use in timer
  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  const cancelRecording = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    }

    setIsRecording(false);
    setDuration(0);

    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [isRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
      // Cancel recording on unmount if still recording
      if (isRecording) {
        void cancelRecording();
      }
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: cancelRecording is stable
  }, [isRecording]);

  return {
    isRecording,
    duration,
    error,
    isSupported,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
