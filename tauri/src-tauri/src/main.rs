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

    let mut sidecar = app
        .shell()
        .sidecar("voicebox-server")
        .map_err(|e| format!("Failed to get sidecar: {}", e))?;

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

    let (mut rx, child) = sidecar
        .spawn()
        .map_err(|e| format!("Failed to spawn: {}", e))?;

    // Store child process
    *state.child.lock().unwrap() = Some(child);

    // Wait for server to be ready by listening for startup log
    let timeout = tokio::time::Duration::from_secs(30);
    let start_time = tokio::time::Instant::now();

    loop {
        if start_time.elapsed() > timeout {
            return Err("Server startup timeout".to_string());
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
                        let line_str = String::from_utf8_lossy(&line);
                        eprintln!("Server: {}", line_str);

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
