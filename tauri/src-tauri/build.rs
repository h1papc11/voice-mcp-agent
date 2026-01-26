use std::process::Command;

fn main() {
    // Compile macOS Liquid Glass icon
    #[cfg(target_os = "macos")]
    {
        let project_root = env!("CARGO_MANIFEST_DIR");
        // voicebox.icon is in tauri/assets/voicebox.icon (one level up from src-tauri)
        let icon_source = format!("{}/../assets/voicebox.icon", project_root);
        let gen_dir = format!("{}/gen", project_root);

        std::fs::create_dir_all(&gen_dir).expect("Failed to create gen directory");

        if std::path::Path::new(&icon_source).exists() {
            println!("cargo:rerun-if-changed={}", icon_source);
            println!("cargo:rerun-if-changed={}/icon.json", icon_source);
            println!("cargo:rerun-if-changed={}/Assets", icon_source);

            let partial_plist = format!("{}/partial.plist", gen_dir);
            let output = Command::new("xcrun")
                .args([
                    "actool",
                    "--compile", &gen_dir,
                    "--output-format", "human-readable-text",
                    "--output-partial-info-plist", &partial_plist,
                    "--app-icon", "voicebox",
                    "--include-all-app-icons",
                    "--target-device", "mac",
                    "--minimum-deployment-target", "11.0",
                    "--platform", "macosx",
                    &icon_source,
                ])
                .output();

            match output {
                Ok(output) => {
                    if !output.status.success() {
                        eprintln!("actool stderr: {}", String::from_utf8_lossy(&output.stderr));
                        eprintln!("actool stdout: {}", String::from_utf8_lossy(&output.stdout));
                        panic!("actool failed to compile icon");
                    }
                    println!("Successfully compiled icon to {}", gen_dir);
                }
                Err(e) => {
                    eprintln!("Failed to execute xcrun actool: {}", e);
                    eprintln!("Make sure you have Xcode Command Line Tools installed");
                    panic!("Icon compilation failed");
                }
            }
        } else {
            println!("cargo:warning=Icon source not found at {}, skipping icon compilation", icon_source);
        }
    }

    tauri_build::build()
}
