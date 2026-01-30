"""
Test script to validate mlx-audio can load and run Qwen3-TTS models.
"""
import sys
import time

def test_mlx_available():
    """Step 1: Verify MLX is available and working."""
    print("=" * 60)
    print("Step 1: Testing MLX availability")
    print("=" * 60)
    
    try:
        import mlx.core as mx
        print(f"✓ MLX imported successfully")
        print(f"  Version: {mx.__version__ if hasattr(mx, '__version__') else 'unknown'}")
        
        # Quick compute test
        a = mx.array([1.0, 2.0, 3.0])
        b = mx.array([4.0, 5.0, 6.0])
        c = a + b
        print(f"  Compute test: {a.tolist()} + {b.tolist()} = {c.tolist()}")
        print("✓ MLX compute working\n")
        return True
    except Exception as e:
        print(f"✗ MLX error: {e}\n")
        return False


def test_mlx_audio_import():
    """Step 2: Verify mlx-audio modules can be imported."""
    print("=" * 60)
    print("Step 2: Testing mlx-audio imports")
    print("=" * 60)
    
    try:
        import mlx_audio
        print(f"✓ mlx_audio imported")
        
        from mlx_audio.tts import load
        print(f"✓ mlx_audio.tts.load imported")
        
        return True
    except Exception as e:
        print(f"✗ Import error: {e}\n")
        return False


def test_model_loading():
    """Step 3: Load Qwen3-TTS model (1.7B - same as voicebox uses)."""
    print("=" * 60)
    print("Step 3: Loading Qwen3-TTS model (1.7B)")
    print("=" * 60)
    print("(This will download the model on first run, ~3.4GB)")
    print()
    
    # Model mapping - same as backend/tts.py but for MLX
    # PyTorch: Qwen/Qwen3-TTS-12Hz-1.7B-Base
    # MLX:     mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16
    
    try:
        from mlx_audio.tts import load
        
        start = time.time()
        # Load the MLX-converted version of the same model voicebox uses
        model = load("mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16")
        load_time = time.time() - start
        
        print(f"✓ Model loaded in {load_time:.1f}s\n")
        return model
    except Exception as e:
        print(f"✗ Model loading error: {e}\n")
        import traceback
        traceback.print_exc()
        return None


def test_generation(model):
    """Step 4: Generate a short audio clip."""
    print("=" * 60)
    print("Step 4: Generating test audio")
    print("=" * 60)
    
    try:
        test_text = "Hello, this is a test of MLX audio generation."
        print(f"  Text: \"{test_text}\"")
        print(f"  Model type: {type(model).__name__}")
        
        start = time.time()
        
        # mlx-audio generate() returns a generator yielding GenerationResult objects
        # Each result has: audio, sample_rate, real_time_factor, etc.
        audio_chunks = []
        sample_rate = 24000
        
        for result in model.generate(test_text):
            # result is a GenerationResult with audio and metadata
            audio_chunks.append(result.audio)
            sample_rate = result.sample_rate
            
            # Print streaming progress info
            if hasattr(result, 'real_time_factor') and result.real_time_factor:
                print(f"  Chunk: {result.audio.shape[0]} samples, RTF: {result.real_time_factor:.2f}x")
        
        gen_time = time.time() - start
        
        # Concatenate all audio chunks
        import numpy as np
        audio = np.concatenate([np.array(chunk) for chunk in audio_chunks])
        
        samples = len(audio)
        duration = samples / sample_rate
        rtf = gen_time / duration if duration > 0 else float('inf')
        
        print(f"✓ Audio generated:")
        print(f"  Samples: {samples}")
        print(f"  Sample rate: {sample_rate} Hz")
        print(f"  Duration: {duration:.2f}s")
        print(f"  Generation time: {gen_time:.2f}s")
        print(f"  Real-time factor: {rtf:.2f}x (lower is faster)")
        
        if rtf < 1.0:
            print(f"  → Faster than real-time!")
        
        return audio, sample_rate
    except Exception as e:
        print(f"✗ Generation error: {e}\n")
        import traceback
        traceback.print_exc()
        return None, None


def test_save_audio(audio, sample_rate):
    """Step 5: Save the generated audio to a file."""
    print("\n" + "=" * 60)
    print("Step 5: Saving audio file")
    print("=" * 60)
    
    try:
        import numpy as np
        import soundfile as sf
        
        # Audio should already be a numpy array from test_generation
        audio_np = np.asarray(audio, dtype=np.float32)
        
        # Ensure 1D
        if len(audio_np.shape) > 1:
            audio_np = audio_np.squeeze()
        
        output_path = "test_output.wav"
        sf.write(output_path, audio_np, sample_rate)
        print(f"✓ Saved to: {output_path}")
        
        # Get file size
        import os
        size_kb = os.path.getsize(output_path) / 1024
        print(f"  File size: {size_kb:.1f} KB\n")
        
        return True
    except Exception as e:
        print(f"✗ Save error: {e}\n")
        import traceback
        traceback.print_exc()
        return False


def main():
    print("\n" + "=" * 60)
    print("MLX Audio Validation Test")
    print("=" * 60 + "\n")
    
    # Step 1: MLX
    if not test_mlx_available():
        print("FAILED: MLX not available")
        sys.exit(1)
    
    # Step 2: Imports
    if not test_mlx_audio_import():
        print("FAILED: mlx-audio import failed")
        sys.exit(1)
    
    # Step 3: Model loading
    tts = test_model_loading()
    if tts is None:
        print("FAILED: Model loading failed")
        sys.exit(1)
    
    # Step 4: Generation
    audio, sr = test_generation(tts)
    if audio is None:
        print("FAILED: Audio generation failed")
        sys.exit(1)
    
    # Step 5: Save
    if not test_save_audio(audio, sr):
        print("FAILED: Could not save audio")
        sys.exit(1)
    
    print("=" * 60)
    print("ALL TESTS PASSED ✓")
    print("=" * 60)
    print("\nMLX Audio is working correctly on this system.")
    print("You can play the generated audio with: afplay test_output.wav\n")


if __name__ == "__main__":
    main()
