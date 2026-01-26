# Icon Update Workflow for voicebox

## Prerequisites
- Xcode Command Line Tools installed (`xcode-select --install`)
- Your icon designed in Icon Composer and saved as `voicebox.icon` in the project root

## Directory Structure
```
voicebox/
├── voicebox.icon/              # macOS 26 Liquid Glass icon bundle
│   ├── icon.json
│   └── Assets/
│       └── Voicebox.png        # Your source image
├── tauri/
│   ├── assets/
│   │   └── voicebox_exports/   # Your 1024x1024 exports
│   └── src-tauri/
│       ├── gen/                # Auto-generated at build time
│       │   ├── Assets.car      # Liquid Glass assets
│       │   ├── voicebox.icns   # Generated fallback icon
│       │   └── partial.plist
│       └── icons/              # Tauri fallback icons (all platforms)
│           ├── icon.icns
│           ├── icon.ico
│           ├── 32x32.png
│           ├── 128x128.png
│           └── ...
```

## Step 1: Update the Liquid Glass Icon

Edit `voicebox.icon/` in Icon Composer (or manually update `icon.json` and `Assets/`).

The build script (`build.rs`) automatically compiles this during `cargo build`.

## Step 2: Regenerate Fallback Icons

After updating the `.icon` bundle, regenerate the fallback icons:

```bash
cd tauri/src-tauri

# Trigger rebuild to generate new icns
cargo build

# Copy the generated icns to icons folder
cp gen/voicebox.icns icons/icon.icns

# Generate PNGs from the icns
sips -s format png -z 32 32 gen/voicebox.icns --out icons/32x32.png
sips -s format png -z 64 64 gen/voicebox.icns --out icons/64x64.png
sips -s format png -z 128 128 gen/voicebox.icns --out icons/128x128.png
sips -s format png -z 256 256 gen/voicebox.icns --out icons/128x128@2x.png
sips -s format png -z 512 512 gen/voicebox.icns --out icons/icon.png

# Windows Square logos
for size in 30 44 71 89 107 142 150 284 310; do
  sips -s format png -z $size $size gen/voicebox.icns --out "icons/Square${size}x${size}Logo.png"
done
```

## Step 3: Rebuild the App

```bash
cd tauri && bun run tauri build
```

## Step 4: Clear Icon Cache (if icons don't update)

```bash
sudo rm -rf /Library/Caches/com.apple.iconservices.store
sudo killall Finder
sudo killall Dock
```

---

## How It Works

| File | Purpose |
|------|---------|
| `voicebox.icon/` | Source for macOS 26 Liquid Glass icon |
| `build.rs` | Compiles `.icon` → `Assets.car` + `voicebox.icns` at build time |
| `gen/Assets.car` | Liquid Glass assets (macOS 26+) |
| `gen/voicebox.icns` | Auto-generated fallback icon |
| `icons/icon.icns` | Tauri's fallback for older macOS |
| `icons/*.png` | Tauri's fallback for other platforms |
| `Info.plist` | Points to `voicebox` as icon name |
| `tauri.conf.json` | Bundles `gen/*` to Resources root |

## Key Config Files

### `build.rs` — Compiles the icon

```rust
xcrun actool --app-icon voicebox ... voicebox.icon
```

### `tauri.conf.json` — Bundles generated assets to Resources root

```json
"resources": {
  "gen/Assets.car": "./",
  "gen/voicebox.icns": "./",
  "gen/partial.plist": "./"
}
```

### `Info.plist` — Tells macOS which icon to use

```xml
<key>CFBundleIconFile</key>
<string>voicebox</string>
<key>CFBundleIconName</key>
<string>voicebox</string>
```

## Quick Reference Script

Save this as `scripts/update-icons.sh`:

```bash
#!/bin/bash
set -e

cd "$(dirname "$0")/../tauri/src-tauri"

echo "Building to generate new icons..."
cargo build

echo "Copying icns to icons folder..."
cp gen/voicebox.icns icons/icon.icns

echo "Generating PNG icons..."
sips -s format png -z 32 32 gen/voicebox.icns --out icons/32x32.png
sips -s format png -z 64 64 gen/voicebox.icns --out icons/64x64.png
sips -s format png -z 128 128 gen/voicebox.icns --out icons/128x128.png
sips -s format png -z 256 256 gen/voicebox.icns --out icons/128x128@2x.png
sips -s format png -z 512 512 gen/voicebox.icns --out icons/icon.png

echo "Generating Windows Square logos..."
for size in 30 44 71 89 107 142 150 284 310; do
  sips -s format png -z $size $size gen/voicebox.icns --out "icons/Square${size}x${size}Logo.png"
done

echo "Done! Icons updated."
echo "Run 'bun run tauri build' to rebuild the app."
```

Make it executable: `chmod +x scripts/update-icons.sh`
