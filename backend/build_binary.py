"""
PyInstaller build script for creating standalone Python server binary.

Usage:
    python build_binary.py           # Build default (CPU) server binary
    python build_binary.py --cuda    # Build CUDA-enabled server binary
"""

import PyInstaller.__main__
import argparse
import os
import platform
import sys
from pathlib import Path


def is_apple_silicon():
    """Check if running on Apple Silicon."""
    return platform.system() == "Darwin" and platform.machine() == "arm64"


def build_server(cuda=False):
    """Build Python server as standalone binary.

    Args:
        cuda: If True, build with CUDA support and name the binary
              voicebox-server-cuda instead of voicebox-server.
    """
    backend_dir = Path(__file__).parent

    binary_name = 'voicebox-server-cuda' if cuda else 'voicebox-server'

    # PyInstaller arguments
    args = [
        'server.py',  # Use server.py as entry point instead of main.py
        '--onefile',
        '--name', binary_name,
    ]

    # Hide console window on Windows only. On macOS/Linux the sidecar needs
    # stdout/stderr for Tauri to capture logs.
    if platform.system() == "Windows":
        args.append('--noconsole')

    # Add local qwen_tts path if specified (for editable installs)
    qwen_tts_path = os.getenv('QWEN_TTS_PATH')
    if qwen_tts_path and Path(qwen_tts_path).exists():
        args.extend(['--paths', str(qwen_tts_path)])
        print(f"Using local qwen_tts source from: {qwen_tts_path}")

    # Add common hidden imports
    args.extend([
        '--hidden-import', 'backend',
        '--hidden-import', 'backend.main',
        '--hidden-import', 'backend.config',
        '--hidden-import', 'backend.database',
        '--hidden-import', 'backend.models',
        '--hidden-import', 'backend.profiles',
        '--hidden-import', 'backend.history',
        '--hidden-import', 'backend.tts',
        '--hidden-import', 'backend.transcribe',
        '--hidden-import', 'backend.platform_detect',
        '--hidden-import', 'backend.backends',
        '--hidden-import', 'backend.backends.pytorch_backend',
        '--hidden-import', 'backend.utils.audio',
        '--hidden-import', 'backend.utils.cache',
        '--hidden-import', 'backend.utils.progress',
        '--hidden-import', 'backend.utils.hf_progress',
        '--hidden-import', 'backend.utils.validation',
        '--hidden-import', 'backend.services.cuda',
        '--hidden-import', 'backend.effects',
        '--hidden-import', 'backend.utils.effects',
        '--hidden-import', 'backend.versions',
        '--hidden-import', 'pedalboard',
        '--hidden-import', 'chatterbox',
        '--hidden-import', 'chatterbox.tts_turbo',
        '--hidden-import', 'chatterbox.mtl_tts',
        '--hidden-import', 'backend.backends.chatterbox_backend',
        '--hidden-import', 'backend.backends.chatterbox_turbo_backend',
        '--hidden-import', 'backend.backends.luxtts_backend',
        '--hidden-import', 'zipvoice',
        '--hidden-import', 'zipvoice.luxvoice',
        '--collect-all', 'zipvoice',
        '--collect-all', 'linacodec',
        '--hidden-import', 'torch',
        '--hidden-import', 'transformers',
        '--hidden-import', 'fastapi',
        '--hidden-import', 'uvicorn',
        '--hidden-import', 'sqlalchemy',
        '--hidden-import', 'librosa',
        '--hidden-import', 'soundfile',
        '--hidden-import', 'qwen_tts',
        '--hidden-import', 'qwen_tts.inference',
        '--hidden-import', 'qwen_tts.inference.qwen3_tts_model',
        '--hidden-import', 'qwen_tts.inference.qwen3_tts_tokenizer',
        '--hidden-import', 'qwen_tts.core',
        '--hidden-import', 'qwen_tts.cli',
        '--copy-metadata', 'qwen-tts',
        '--copy-metadata', 'requests',
        '--copy-metadata', 'transformers',
        '--copy-metadata', 'huggingface-hub',
        '--copy-metadata', 'tokenizers',
        '--copy-metadata', 'safetensors',
        '--copy-metadata', 'tqdm',
        '--hidden-import', 'requests',
        '--collect-submodules', 'qwen_tts',
        '--collect-data', 'qwen_tts',
        # Fix for pkg_resources and jaraco namespace packages
        '--hidden-import', 'pkg_resources.extern',
        '--collect-submodules', 'jaraco',
        # inflect uses typeguard @typechecked which calls inspect.getsource()
        # at import time — needs .py source files, not just .pyc bytecode
        '--collect-all', 'inflect',
        # perth ships pretrained watermark model files (hparams.yaml, .pth.tar)
        # in perth/perth_net/pretrained/ — needed by chatterbox at runtime
        '--collect-all', 'perth',
        # piper_phonemize ships espeak-ng-data/ (phoneme tables, language dicts)
        # needed by LuxTTS for text-to-phoneme conversion
        '--collect-all', 'piper_phonemize',
    ])

    # Add CUDA-specific hidden imports
    if cuda:
        print("Building with CUDA support")
        args.extend([
            '--hidden-import', 'torch.cuda',
            '--hidden-import', 'torch.backends.cudnn',
        ])
    else:
        # Exclude NVIDIA CUDA packages from CPU-only builds to keep binary small.
        # When building from a venv with CUDA torch installed, PyInstaller would
        # bundle ~3GB of NVIDIA shared libraries. We exclude both the Python
        # modules and the binary DLLs.
        nvidia_packages = [
            'nvidia', 'nvidia.cublas', 'nvidia.cuda_cupti', 'nvidia.cuda_nvrtc',
            'nvidia.cuda_runtime', 'nvidia.cudnn', 'nvidia.cufft', 'nvidia.curand',
            'nvidia.cusolver', 'nvidia.cusparse', 'nvidia.nccl', 'nvidia.nvjitlink',
            'nvidia.nvtx',
        ]
        for pkg in nvidia_packages:
            args.extend(['--exclude-module', pkg])

    # Add MLX-specific imports if building on Apple Silicon (never for CUDA builds)
    if is_apple_silicon() and not cuda:
        print("Building for Apple Silicon - including MLX dependencies")
        args.extend([
            '--hidden-import', 'backend.backends.mlx_backend',
            '--hidden-import', 'mlx',
            '--hidden-import', 'mlx.core',
            '--hidden-import', 'mlx.nn',
            '--hidden-import', 'mlx_audio',
            '--hidden-import', 'mlx_audio.tts',
            '--hidden-import', 'mlx_audio.stt',
            '--collect-submodules', 'mlx',
            '--collect-submodules', 'mlx_audio',
            # Use --collect-all so PyInstaller bundles both data files AND
            # native shared libraries (.dylib, .metallib) for MLX.
            # Previously only --collect-data was used, which caused MLX to
            # raise OSError at runtime inside the bundled binary because
            # the Metal shader libraries were missing.
            '--collect-all', 'mlx',
            '--collect-all', 'mlx_audio',
        ])
    elif not cuda:
        print("Building for non-Apple Silicon platform - PyTorch only")

    dist_dir = str(backend_dir / 'dist')
    build_dir = str(backend_dir / 'build')

    args.extend([
        '--distpath', dist_dir,
        '--workpath', build_dir,
        '--noconfirm',
        '--clean',
    ])

    # Change to backend directory
    os.chdir(backend_dir)
    
    # For CPU builds on Windows, ensure we're using CPU-only torch.
    # If CUDA torch is installed (local dev), swap to CPU torch before building,
    # then restore CUDA torch after. This prevents PyInstaller from bundling
    # ~3GB of CUDA DLLs into the CPU binary.
    restore_cuda = False
    if not cuda and platform.system() == "Windows":
        import subprocess
        result = subprocess.run(
            [sys.executable, "-c", "import torch; print(torch.version.cuda or '')"],
            capture_output=True, text=True
        )
        has_cuda_torch = bool(result.stdout.strip())
        if has_cuda_torch:
            print("CUDA torch detected — installing CPU torch for CPU build...")
            subprocess.run(
                [sys.executable, "-m", "pip", "install", "torch", "torchvision", "torchaudio",
                 "--index-url", "https://download.pytorch.org/whl/cpu", "--force-reinstall", "-q"],
                check=True
            )
            restore_cuda = True

    # Run PyInstaller
    try:
        PyInstaller.__main__.run(args)
    finally:
        # Restore CUDA torch if we swapped it out (even on build failure)
        if restore_cuda:
            print("Restoring CUDA torch...")
            import subprocess
            subprocess.run(
                [sys.executable, "-m", "pip", "install", "torch", "torchvision", "torchaudio",
                 "--index-url", "https://download.pytorch.org/whl/cu126", "--force-reinstall", "-q"],
                check=True
            )
    
    print(f"Binary built in {backend_dir / 'dist' / binary_name}")


def _get_cuda_dll_excludes():
    """Get list of CUDA DLL filenames to exclude from CPU builds.
    
    When building locally with CUDA torch installed, PyInstaller bundles ~3GB of
    CUDA DLLs from torch/lib/. Returns a list of DLL filenames to exclude.
    """
    try:
        import torch
        torch_lib = Path(torch.__file__).parent / 'lib'
    except ImportError:
        return []
    
    cuda_prefixes = (
        'torch_cuda', 'cublas', 'cublasLt', 'cudnn', 'cusparse', 'cufft',
        'cusolver', 'cusolverMg', 'curand', 'nvrtc', 'nvJitLink', 'nccl',
        'nvperf', 'nvrtc-builtins',
    )
    
    exclude_dlls = []
    if torch_lib.exists():
        for f in torch_lib.iterdir():
            if f.suffix == '.dll' and any(f.name.startswith(p) for p in cuda_prefixes):
                exclude_dlls.append(f.name)
    
    if exclude_dlls:
        total_mb = sum(
            (torch_lib / dll).stat().st_size 
            for dll in exclude_dlls 
            if (torch_lib / dll).exists()
        ) / 1024 / 1024
        print(f"CPU build: will exclude {len(exclude_dlls)} CUDA DLLs ({total_mb:.0f} MB)")
    
    return exclude_dlls


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Build voicebox-server binary")
    parser.add_argument(
        '--cuda',
        action='store_true',
        help="Build CUDA-enabled binary (voicebox-server-cuda)",
    )
    cli_args = parser.parse_args()
    build_server(cuda=cli_args.cuda)
