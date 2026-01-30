#!/usr/bin/env python3
"""
Quick demo script to test MLX audio generation speed.

Usage:
    python demo.py                     # Use default text
    python demo.py "Your custom text"  # Use custom text
"""
import sys
import time
import numpy as np
import soundfile as sf
from mlx_audio.tts import load

# Default demo text
DEFAULT_TEXT = "Hello! This is MLX audio running natively on Apple Silicon. It's incredibly fast!"

def main():
    text = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_TEXT
    
    print(f"\n🎙️  MLX Audio Demo")
    print(f"{'=' * 50}")
    print(f"Text: \"{text}\"\n")
    
    # Load model
    print("Loading model...", end=" ", flush=True)
    start = time.time()
    model = load("mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16")
    print(f"done ({time.time() - start:.1f}s)\n")
    
    # Generate
    print("Generating audio...")
    start = time.time()
    
    for result in model.generate(text):
        # Calculate duration from audio samples
        audio = np.array(result.audio)
        sample_rate = result.sample_rate
        duration = len(audio) / sample_rate
        gen_time = float(result.processing_time_seconds)
        rtf = gen_time / duration if duration > 0 else 0
        
        print(f"  Audio duration: {duration:.2f}s")
        print(f"  Generation time: {gen_time:.2f}s")
        print(f"  Real-time factor: {rtf:.2f}x", end="")
        
        if rtf < 1.0:
            print(f" ⚡ ({1/rtf:.1f}x faster than real-time)")
        else:
            print()
        
        # Save audio
        sf.write("test_output.wav", audio, sample_rate)
    
    print(f"\n✅ Saved to test_output.wav")
    print(f"{'=' * 50}")
    
    # Play audio
    print("\n🔊 Playing audio...\n")
    import subprocess
    subprocess.run(["afplay", "test_output.wav"])

if __name__ == "__main__":
    main()
