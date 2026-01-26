// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::{command, State, Manager, WindowEvent, Emitter, Listener};
use tauri_plugin_shell::ShellExt;
use tokio::sync::mpsc;

struct ServerState {
    child: Mutex<Option<tauri_plugin_shell::process::CommandChild>>,
}

#[command]
async fn start_server(
    app: tauri::AppHandle,
    state: State<'_, ServerState>,
    remote: Option<bool>,
) -> Result<String, String> {
    // Check if server is already running
    if state.child.lock().unwrap().is_some() {
        return Ok("Server already running on http://localhost:8000".to_string());
    }

    // Get app data directory
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    // Ensure data directory exists
    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Failed to create data dir: {}", e))?;

    println!("=================================================================");
    println!("Starting voicebox-server sidecar");
    println!("Data directory: {:?}", data_dir);
    println!("Remote mode: {}", remote.unwrap_or(false));

    let mut sidecar = app
        .shell()
        .sidecar("voicebox-server")
        .map_err(|e| {
            eprintln!("Failed to get sidecar: {}", e);
            eprintln!("This usually means the binary is not bundled correctly or doesn't have execute permissions");
            format!("Failed to get sidecar: {}", e)
        })?;

    println!("Sidecar command created successfully");

    // Pass data directory to Python server
    sidecar = sidecar.args([
        "--data-dir",
        data_dir
            .to_str()
            .ok_or_else(|| "Invalid data dir path".to_string())?,
    ]);

    if remote.unwrap_or(false) {
        sidecar = sidecar.args(["--host", "0.0.0.0"]);
    }

    println!("Spawning server process...");
    let (mut rx, child) = sidecar
        .spawn()
        .map_err(|e| {
            eprintln!("Failed to spawn server process: {}", e);
            eprintln!("This could be due to:");
            eprintln!("  - Missing or corrupted binary");
            eprintln!("  - Missing execute permissions");
            eprintln!("  - Code signing issues on macOS");
            eprintln!("  - Missing dependencies");
            format!("Failed to spawn: {}", e)
        })?;

    println!("Server process spawned, waiting for ready signal...");
    println!("=================================================================");

    // Store child process
    *state.child.lock().unwrap() = Some(child);

    // Wait for server to be ready by listening for startup log
    let timeout = tokio::time::Duration::from_secs(30);
    let start_time = tokio::time::Instant::now();
    let mut error_output = Vec::new();

    loop {
        if start_time.elapsed() > timeout {
            eprintln!("Server startup timeout after 30 seconds");
            if !error_output.is_empty() {
                eprintln!("Collected error output:");
                for line in &error_output {
                    eprintln!("  {}", line);
                }
            }
            return Err("Server startup timeout - check Console.app for detailed logs".to_string());
        }

        match tokio::time::timeout(tokio::time::Duration::from_millis(100), rx.recv()).await {
            Ok(Some(event)) => {
                match event {
                    tauri_plugin_shell::process::CommandEvent::Stdout(line) => {
                        let line_str = String::from_utf8_lossy(&line);
                        println!("Server output: {}", line_str);

                        if line_str.contains("Uvicorn running") || line_str.contains("Application startup complete") {
                            println!("Server is ready!");
                            break;
                        }
                    }
                    tauri_plugin_shell::process::CommandEvent::Stderr(line) => {
                        let line_str = String::from_utf8_lossy(&line).to_string();
                        eprintln!("Server: {}", line_str);

                        // Collect error lines for debugging
                        if line_str.contains("ERROR") || line_str.contains("Error") || line_str.contains("Failed") {
                            error_output.push(line_str.clone());
                        }

                        // Uvicorn logs to stderr, so check there too
                        if line_str.contains("Uvicorn running") || line_str.contains("Application startup complete") {
                            println!("Server is ready!");
                            break;
                        }
                    }
                    _ => {}
                }
            }
            Ok(None) => {
                eprintln!("Server process ended unexpectedly during startup!");
                eprintln!("The server binary may have crashed or exited with an error.");
                eprintln!("Check Console.app logs for more details (search for 'voicebox')");
                return Err("Server process ended unexpectedly".to_string());
            }
            Err(_) => {
                // Timeout on this recv, continue loop
                continue;
            }
        }
    }

    // Spawn task to continue reading output
    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                tauri_plugin_shell::process::CommandEvent::Stdout(line) => {
                    println!("Server: {}", String::from_utf8_lossy(&line));
                }
                tauri_plugin_shell::process::CommandEvent::Stderr(line) => {
                    eprintln!("Server error: {}", String::from_utf8_lossy(&line));
                }
                _ => {}
            }
        }
    });

    Ok("Server started on http://localhost:8000".to_string())
}

#[command]
async fn stop_server(state: State<'_, ServerState>) -> Result<(), String> {
    if let Some(child) = state.child.lock().unwrap().take() {
        child.kill().map_err(|e| format!("Failed to kill: {}", e))?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(ServerState {
            child: Mutex::new(None),
        })
        .setup(|app| {
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;

            #[cfg(debug_assertions)]
            {
                // Get all windows and open devtools on the first one
                if let Some((_, window)) = app.webview_windows().iter().next() {
                    window.open_devtools();
                    println!("Dev tools opened");
                } else {
                    println!("No window found to open dev tools");
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![start_server, stop_server])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Prevent automatic close
                api.prevent_close();

                // Emit event to frontend to check setting and stop server if needed
                let app_handle = window.app_handle();

                if let Err(e) = app_handle.emit("window-close-requested", ()) {
                    eprintln!("Failed to emit window-close-requested event: {}", e);
                    // If event emission fails, allow close anyway
                    window.close().ok();
                    return;
                }

                // Set up listener for frontend response
                let window_for_close = window.clone();
                let (tx, mut rx) = mpsc::unbounded_channel::<()>();

                // Listen for response from frontend using window's listen method
                let listener_id = window.listen("window-close-allowed", move |_| {
                    // Frontend has checked setting and stopped server if needed
                    // Signal that we can close
                    let _ = tx.send(());
                });

                // Wait for frontend response or timeout
                tokio::spawn(async move {
                    tokio::select! {
                        _ = rx.recv() => {
                            // Frontend responded, close window
                            window_for_close.close().ok();
                        }
                        _ = tokio::time::sleep(tokio::time::Duration::from_secs(5)) => {
                            // Timeout - close anyway
                            eprintln!("Window close timeout, closing anyway");
                            window_for_close.close().ok();
                        }
                    }
                    // Clean up listener
                    window_for_close.unlisten(listener_id);
                });
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
