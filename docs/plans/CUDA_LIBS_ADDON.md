# CUDA Libs as a Bolt-On Addon

## Problem

Every time we bump `__version__` (even for a UI tweak or bugfix), the exact-match version check in both `main.rs:222` and `cuda.py:237` invalidates the user's ~2.4GB CUDA binary, forcing a full redownload. The CUDA binary is the entire server rebuilt with NVIDIA libs included -- there's no separation between app logic and the CUDA runtime.

## Why This Is Hard With `--onefile`

The core tension is PyInstaller `--onefile` mode (`build_binary.py:39`). In onefile mode, everything -- Python code, all dependencies, torch, the NVIDIA `.dll`/`.so` files -- gets packed into a single self-extracting archive. There's no concept of "swap out one part." The binary IS the server.

## Options

### Option A: Switch to `--onedir` for the CUDA Build (Recommended)

Instead of `--onefile`, build the CUDA variant as a directory (a folder with the exe + all the shared libs alongside it). Then split the distribution into two archives:

1. **`voicebox-server-cuda` executable + non-NVIDIA deps** (~200-400MB) -- versioned with the app, redownloaded on every app update.
2. **`cuda-libs-cu126.tar.gz`** (~2GB) -- the `nvidia.*` packages (cublas, cudnn, cuda_runtime, etc.), versioned independently (e.g., `cuda-libs-cu126-v1`). Only redownloaded when we bump the CUDA toolkit version or torch's CUDA dependency changes.

#### How it would work at runtime

- Tauri downloads the server binary archive and extracts it to `{data_dir}/backends/cuda/`
- On first CUDA setup (or when cuda-libs version bumps), downloads and extracts the libs archive into the same directory
- The CUDA server exe finds the `.dll`/`.so` files next to it (standard PyInstaller onedir behavior)
- Version check becomes two checks: server version + cuda-libs version

#### Independent versioning

Add a `cuda-libs.json` manifest:

```json
{"version": "cu126-v1", "torch_compat": ">=2.6.0,<2.8.0"}
```

The server checks this on startup. The Tauri side checks it before launching. Only bump `cu126-v1` -> `cu126-v2` when we actually change the CUDA toolkit or torch major version.

#### Build pipeline changes

The CI `build-cuda-windows` job would build with `--onedir`, then separate the output into two archives. The CUDA libs archive could be built less frequently (only when torch/CUDA version changes) and stored as a pinned release asset.

#### Download experience

- First-time CUDA setup: ~2.4GB total (same as today)
- Subsequent app updates: ~200-400MB for the server, CUDA libs stay cached
- CUDA toolkit bump: ~2GB for just the libs

#### Pros

- PyInstaller `--onedir` natively produces this structure -- NVIDIA DLLs end up as discrete files in the output directory
- The separation is natural: PyInstaller puts torch's NVIDIA deps in predictable paths (`nvidia/cublas/lib/`, etc.)
- CUDA libs are highly stable -- only rebundle when changing CUDA toolkit version (e.g., cu126 -> cu128) or major torch version
- Server updates become ~200-400MB instead of ~2.4GB
- No library path hacking needed -- torch finds NVIDIA DLLs because they're in the same directory tree

#### Cons

- Onedir means a folder with hundreds of files instead of a single exe -- more complex to manage, extract, and clean up
- Need to modify download/assembly logic in `cuda.py` to handle two separate archives
- The Tauri side (`main.rs`) needs to point at an exe inside a directory rather than a standalone binary
- Users who manually manage the file may find the folder structure confusing

#### TTS engine compatibility

No issues. The TTS engines are pure Python + torch. They don't care whether NVIDIA libs are inside the binary or sitting next to it -- torch's dynamic loader finds them either way.

---

### Option B: Keep `--onefile` but Externalize CUDA Libs via Library Path

Keep the server as a single `--onefile` binary (with NVIDIA packages excluded, same as the CPU build). Ship the CUDA libs as a separate download that gets extracted to `{data_dir}/backends/cuda-libs/`. Before launching, set the library search path to include that directory.

**Important caveat:** The CPU torch wheel (`whl/cpu`) doesn't have CUDA kernels compiled in -- it's a fundamentally different build. So the binary would need to be built with CUDA-compiled torch but with the NVIDIA runtime libraries excluded. The runtime libs (cublas, cudnn, etc.) would be provided externally.

#### How it would work

- Build ONE "CUDA-ready" server binary with CUDA-compiled torch but NVIDIA runtime packages excluded
- Ship `cuda-libs-cu126-v1.tar.gz` separately (~2GB of `.dll`/`.so` files)
- When launching, Tauri sets `PATH` (Windows) or `LD_LIBRARY_PATH` (Linux) to include the cuda-libs directory

#### Pros

- Single server binary for both CPU and CUDA users -- simplifies build pipeline enormously
- True bolt-on CUDA libs with fully independent versioning
- Server updates are always small (~150MB for the onefile binary)

#### Cons

- **Fragile on Windows.** PyInstaller `--onefile` extracts to a temp directory at runtime and the internal torch may not find externally-placed NVIDIA libs. DLL resolution on Windows is notoriously unreliable in this scenario.
- `os.add_dll_directory()` only affects `LoadLibraryEx` with `LOAD_LIBRARY_SEARCH_USER_DIRS` flag -- not all DLL loads go through this path
- PyInstaller's onefile bootloader may configure DLL search paths before Python code runs
- Could work on Linux but is fragile on Windows

---

### Option C: Hybrid -- `--onefile` Server + Dynamic CUDA Lib Loading at Runtime

Build the server as `--onefile` with CUDA-compiled torch but with NVIDIA packages excluded. At startup, before torch initializes CUDA, explicitly load the NVIDIA shared libraries using `ctypes.CDLL` or `os.add_dll_directory()`.

In `server.py`, before any torch imports:

```python
cuda_libs_dir = os.environ.get("VOICEBOX_CUDA_LIBS")
if cuda_libs_dir and os.path.isdir(cuda_libs_dir):
    if sys.platform == "win32":
        os.add_dll_directory(cuda_libs_dir)
        os.environ["PATH"] = cuda_libs_dir + os.pathsep + os.environ.get("PATH", "")
    else:
        os.environ["LD_LIBRARY_PATH"] = cuda_libs_dir + ":" + os.environ.get("LD_LIBRARY_PATH", "")
```

#### Pros

- Single server binary, true bolt-on CUDA libs
- Clean separation of concerns
- Independent versioning

#### Cons

- Needs careful testing with each torch version -- CUDA initialization happens deep in C++ extension layer
- On Windows, `os.add_dll_directory()` may not cover all DLL load paths
- PyInstaller's onefile bootloader may have already configured DLL search paths before Python code runs
- Most complex to get right and maintain

## Recommendation

**Option A (`--onedir` with split archives)** is the most reliable path:

1. **It actually works.** `--onedir` puts all files on disk as regular files. Torch finds NVIDIA DLLs because they're in the same directory tree, exactly as they would be in a normal pip install.
2. **Natural separation.** PyInstaller's `--onedir` output already separates the NVIDIA `.dll`/`.so` files into `nvidia/` subdirectories. We can split the output directory into "core" and "nvidia-libs" archives after building.
3. **Independent versioning is straightforward.** A `cuda-libs.json` manifest controls when redownloads are needed.
4. **Build pipeline simplification.** Build CUDA libs archive less frequently, store as a pinned release asset.

The main cost is managing a directory instead of a single file, but we already have sophisticated download/assembly infrastructure in `cuda.py` with manifests and split parts. Extending that to handle two archives is incremental work.

## Tauri Compatibility (Validated)

Tauri handles PyInstaller `--onedir` with no issues. The key insight is that we're **not** using a static sidecar for CUDA -- we're downloading and extracting at runtime (the existing `cuda.py` + `main.rs` flow). For runtime-launched processes, Tauri's `tauri::shell::Command` supports arbitrary directories natively.

### The critical change in `main.rs`

The only Tauri-side change needed is adding `.current_dir()` when spawning the CUDA backend:

```rust
let cuda_dir = data_dir.join("backends/cuda");
let exe_path = cuda_dir.join("voicebox-server-cuda.exe");

let mut cmd = app.shell().command(exe_path.to_str().unwrap());
cmd = cmd.current_dir(&cuda_dir);  // PyInstaller finds all DLLs relative to exe
cmd = cmd.args(["--data-dir", &data_dir_str, "--port", &port_str, "--parent-pid", &parent_pid_str]);
```

`.current_dir()` tells the PyInstaller bootloader that everything (DLLs, `nvidia/cublas/lib/`, `_internal/`, torch extensions, etc.) lives relative to the exe. Torch finds the NVIDIA libs exactly as it does in a normal `pip install` or dev environment -- no `LD_LIBRARY_PATH` hacks, no `os.add_dll_directory` gymnastics.

### Community evidence

- Multiple Tauri users run this exact pattern: Nuitka folders (exe + pythonXX.dll + supporting files), multi-file .NET apps, and PyInstaller onedir backends (GitHub issues #5719, discussion #5206).
- The shell plugin explicitly supports `cwd` in both Rust and JS APIs.
- No reports of torch/CUDA-specific breakage -- the onedir layout is identical to what PyInstaller produces in normal usage.

### Known gotcha: process termination on Windows

PyInstaller onedir creates a parent bootloader + child Python process on Windows. `child.kill()` only hits the outer process in some cases (Tauri issue #11686). Mitigation: keep a reference to the parent PID or use `taskkill /F /T` for clean shutdown. This is not a blocker -- our existing `--parent-pid` watchdog mechanism in `server.py` already handles orphan cleanup.

## Next Steps

1. Prototype: Build the current CUDA binary with `--onedir` and verify torch CUDA works from the output directory
2. Measure the size split: how much is NVIDIA libs vs everything else
3. Design the two-archive download flow and dual version checking
4. Update `cuda.py` for dual-archive extraction (server core + cuda-libs)
5. Update `main.rs`: change launch path to `backends/cuda/` dir + add `.current_dir()`
6. Add `ensure_cuda_structure()` helper in Rust to verify exe + nvidia/ subdirs exist before spawning
7. Update CI pipeline: `build-cuda-windows` produces two archives instead of split parts
8. ~~Update `split_binary.py` or replace with archive-based distribution~~ Done: replaced with `package_cuda.py`
