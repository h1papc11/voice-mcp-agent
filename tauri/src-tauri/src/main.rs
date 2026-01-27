// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod audio_capture;
mod audio_output;

use std::sync::Mutex;
use tauri::{command, State, Manager, WindowEvent, Emitter, Listener, RunEvent};
use tauri_plugin_shell::ShellExt;
use tokio::sync::mpsc;

const LEGACY_PORT: u16 = 8000;
const SERVER_PORT: u16 = 17493;

struct ServerState {
    child: Mutex<Option<tauri_plugin_shell::process::CommandChild>>,
    server_pid: Mutex<Option<u32>>,
    keep_running_on_close: Mutex<bool>,
}

#[command]
async fn start_server(
    app: tauri::AppHandle,
    state: State<'_, ServerState>,
    remote: Option<bool>,
) -> Result<String, String> {
    // Check if server is already running (managed by this app instance)
    if state.child.lock().unwrap().is_some() {
        return Ok(format!("http://127.0.0.1:{}", SERVER_PORT));
    }

    // Check if a voicebox server is already running on our port (from previous session with keep_running=true)
    #[cfg(unix)]
    {
        use std::process::Command;
        if let Ok(output) = Command::new("lsof")
            .args(["-i", &format!(":{}", SERVER_PORT), "-sTCP:LISTEN"])
            .output()
        {
            let output_str = String::from_utf8_lossy(&output.stdout);
            for line in output_str.lines().skip(1) {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    let command = parts[0];
                    let pid_str = parts[1];
                    if command.contains("voicebox") {
                        if let Ok(pid) = pid_str.parse::<u32>() {
                            println!("Found existing voicebox-server on port {} (PID: {}), reusing it", SERVER_PORT, pid);
                            // Store the PID so we can kill it on exit if needed
                            *state.server_pid.lock().unwrap() = Some(pid);
                            return Ok(format!("http://127.0.0.1:{}", SERVER_PORT));
                        }
                    }
                }
            }
        }
    }
    
    #[cfg(windows)]
    {
        use std::process::Command;
        if let Ok(output) = Command::new("netstat")
            .args(["-ano"])
            .output()
        {
            let output_str = String::from_utf8_lossy(&output.stdout);
            for line in output_str.lines() {
                if line.contains(&format!(":{}", SERVER_PORT)) && line.contains("LISTENING") {
                    if let Some(pid_str) = line.split_whitespace().last() {
                        if let Ok(pid) = pid_str.parse::<u32>() {
                            if let Ok(tasklist_output) = Command::new("tasklist")
                                .args(["/FI", &format!("PID eq {}", pid), "/FO", "CSV", "/NH"])
                                .output()
                            {
                                let tasklist_str = String::from_utf8_lossy(&tasklist_output.stdout);
                                if tasklist_str.to_lowercase().contains("voicebox") {
                                    println!("Found existing voicebox-server on port {} (PID: {}), reusing it", SERVER_PORT, pid);
                                    // Store the PID so we can kill it on exit if needed
                                    *state.server_pid.lock().unwrap() = Some(pid);
                                    return Ok(format!("http://127.0.0.1:{}", SERVER_PORT));
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Kill any orphaned voicebox-server from previous session on legacy port 8000
    // This handles upgrades from older versions that used a fixed port
    #[cfg(unix)]
    {
        use std::process::Command;
        // Find processes listening on legacy port 8000 with their command names
        if let Ok(output) = Command::new("lsof")
            .args(["-i", &format!(":{}", LEGACY_PORT), "-sTCP:LISTEN"])
            .output()
        {
            let output_str = String::from_utf8_lossy(&output.stdout);
            for line in output_str.lines().skip(1) { // Skip header line
                // lsof output format: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    let command = parts[0];
                    let pid_str = parts[1];
                    
                    // Only kill if it's a voicebox-server process
                    if command.contains("voicebox") {
                        if let Ok(pid) = pid_str.parse::<i32>() {
                            println!("Found orphaned voicebox-server on legacy port {} (PID: {}, CMD: {}), killing it...", LEGACY_PORT, pid, command);
                            // Kill the process group
                            let _ = Command::new("kill")
                                .args(["-9", "--", &format!("-{}", pid)])
                                .output();
                            let _ = Command::new("kill")
                                .args(["-9", &pid.to_string()])
                                .output();
                        }
                    } else {
                        println!("Legacy port {} is in use by non-voicebox process: {} (PID: {}), not killing", LEGACY_PORT, command, pid_str);
                    }
                }
            }
        }
    }
    
    #[cfg(windows)]
    {
        use std::process::Command;
        // On Windows, find PIDs on legacy port 8000, then check their names
        if let Ok(output) = Command::new("netstat")
            .args(["-ano"])
            .output()
        {
            let output_str = String::from_utf8_lossy(&output.stdout);
            for line in output_str.lines() {
                if line.contains(&format!(":{}", LEGACY_PORT)) && line.contains("LISTENING") {
                    if let Some(pid_str) = line.split_whitespace().last() {
                        if let Ok(pid) = pid_str.parse::<u32>() {
                            // Get process name for this PID
                            if let Ok(tasklist_output) = Command::new("tasklist")
                                .args(["/FI", &format!("PID eq {}", pid), "/FO", "CSV", "/NH"])
                                .output()
                            {
                                let tasklist_str = String::from_utf8_lossy(&tasklist_output.stdout);
                                if tasklist_str.to_lowercase().contains("voicebox") {
                                    println!("Found orphaned voicebox-server on legacy port {} (PID: {}), killing it...", LEGACY_PORT, pid);
                                    let _ = Command::new("taskkill")
                                        .args(["/PID", &pid.to_string(), "/T", "/F"])
                                        .output();
                                } else {
                                    println!("Legacy port {} is in use by non-voicebox process (PID: {}), not killing", LEGACY_PORT, pid);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Brief wait for port to be released
    std::thread::sleep(std::time::Duration::from_millis(200));

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

    // Pass data directory and port to Python server
    sidecar = sidecar.args([
        "--data-dir",
        data_dir
            .to_str()
            .ok_or_else(|| "Invalid data dir path".to_string())?,
        "--port",
        &SERVER_PORT.to_string(),
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

    // Store child process and PID
    let process_pid = child.pid();
    *state.server_pid.lock().unwrap() = Some(process_pid);
    *state.child.lock().unwrap() = Some(child);

    // Wait for server to be ready by listening for startup log
    // PyInstaller bundles can be slow on first import, especially torch/transformers
    let timeout = tokio::time::Duration::from_secs(120);
    let start_time = tokio::time::Instant::now();
    let mut error_output = Vec::new();

    loop {
        if start_time.elapsed() > timeout {
            eprintln!("Server startup timeout after 120 seconds");
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

    Ok(format!("http://127.0.0.1:{}", SERVER_PORT))
}

#[command]
async fn stop_server(state: State<'_, ServerState>) -> Result<(), String> {
    let pid = state.server_pid.lock().unwrap().take();
    let _child = state.child.lock().unwrap().take();
    
    if let Some(pid) = pid {
        println!("stop_server: Killing server process group with PID: {}", pid);
        
        #[cfg(unix)]
        {
            use std::process::Command;
            // Kill process group with SIGTERM first
            let _ = Command::new("kill")
                .args(["-TERM", "--", &format!("-{}", pid)])
                .output();
            
            // Brief wait then force kill
            std::thread::sleep(std::time::Duration::from_millis(100));
            
            let _ = Command::new("kill")
                .args(["-9", "--", &format!("-{}", pid)])
                .output();
            let _ = Command::new("kill")
                .args(["-9", &pid.to_string()])
                .output();
        }
        
        #[cfg(windows)]
        {
            use std::process::Command;
            let _ = Command::new("taskkill")
                .args(["/PID", &pid.to_string(), "/T", "/F"])
                .output();
        }
        
        println!("stop_server: Process group kill completed");
    }
    
    Ok(())
}

#[command]
fn set_keep_server_running(state: State<'_, ServerState>, keep_running: bool) {
    *state.keep_running_on_close.lock().unwrap() = keep_running;
}

#[command]
async fn start_system_audio_capture(
    state: State<'_, audio_capture::AudioCaptureState>,
    max_duration_secs: u32,
) -> Result<(), String> {
    audio_capture::start_capture(&state, max_duration_secs).await
}

#[command]
async fn stop_system_audio_capture(
    state: State<'_, audio_capture::AudioCaptureState>,
) -> Result<String, String> {
    audio_capture::stop_capture(&state).await
}

#[command]
fn is_system_audio_supported() -> bool {
    audio_capture::is_supported()
}

#[command]
fn list_audio_output_devices(
    state: State<'_, audio_output::AudioOutputState>,
) -> Result<Vec<audio_output::AudioOutputDevice>, String> {
    state.list_output_devices()
}

#[command]
async fn play_audio_to_devices(
    state: State<'_, audio_output::AudioOutputState>,
    audio_data: Vec<u8>,
    device_ids: Vec<String>,
) -> Result<(), String> {
    state.play_audio_to_devices(audio_data, device_ids).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(ServerState {
            child: Mutex::new(None),
            server_pid: Mutex::new(None),
            keep_running_on_close: Mutex::new(false),
        })
        .manage(audio_capture::AudioCaptureState::new())
        .manage(audio_output::AudioOutputState::new())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;

            // Hide title bar icon on Windows
            #[cfg(windows)]
            {
                use windows::Win32::Foundation::HWND;
                use windows::Win32::UI::WindowsAndMessaging::{SetClassLongPtrW, GCLP_HICON, GCLP_HICONSM};
                
                if let Some((_, window)) = app.webview_windows().iter().next() {
                    if let Ok(hwnd) = window.hwnd() {
                        let hwnd = HWND(hwnd.0);
                        unsafe {
                            // Set both small and regular icons to NULL to hide the title bar icon
                            SetClassLongPtrW(hwnd, GCLP_HICON, 0);
                            SetClassLongPtrW(hwnd, GCLP_HICONSM, 0);
                        }
                    }
                }
            }

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
        .invoke_handler(tauri::generate_handler![
            start_server,
            stop_server,
            set_keep_server_running,
            start_system_audio_capture,
            stop_system_audio_capture,
            is_system_audio_supported,
            list_audio_output_devices,
            play_audio_to_devices
        ])
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
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            match &event {
                RunEvent::Exit => {
                    println!("=================================================================");
                    println!("RunEvent::Exit received - checking server cleanup");
                    let state = app.state::<ServerState>();
                    let keep_running = *state.keep_running_on_close.lock().unwrap();
                    println!("keep_running_on_close = {}", keep_running);
                    
                    if !keep_running {
                        // Get the stored PID for process group killing
                        let pid = state.server_pid.lock().unwrap().take();
                        // Also take the child to clean up
                        let _child = state.child.lock().unwrap().take();
                        
                        if let Some(pid) = pid {
                            println!("Killing server process group with PID: {}", pid);
                            
                            // Kill the entire process group on Unix systems
                            // Using negative PID sends signal to all processes in the group
                            #[cfg(unix)]
                            {
                                use std::process::Command;
                                // First try SIGTERM to the process group
                                let pgid_kill = Command::new("kill")
                                    .args(["-TERM", "--", &format!("-{}", pid)])
                                    .output();
                                
                                match pgid_kill {
                                    Ok(output) => {
                                        if output.status.success() {
                                            println!("SIGTERM sent to process group -{}", pid);
                                        } else {
                                            // Process group kill failed, try direct kill
                                            println!("Process group kill failed, trying direct kill");
                                            let _ = Command::new("kill")
                                                .args(["-TERM", &pid.to_string()])
                                                .output();
                                        }
                                    }
                                    Err(e) => {
                                        eprintln!("Failed to execute kill command: {}", e);
                                    }
                                }
                                
                                // Give it a moment, then force kill if needed
                                std::thread::sleep(std::time::Duration::from_millis(100));
                                
                                // Force kill with SIGKILL
                                let _ = Command::new("kill")
                                    .args(["-9", "--", &format!("-{}", pid)])
                                    .output();
                                let _ = Command::new("kill")
                                    .args(["-9", &pid.to_string()])
                                    .output();
                                
                                println!("Server process group kill completed");
                            }
                            
                            #[cfg(windows)]
                            {
                                // On Windows, use taskkill with /T to kill child processes
                                use std::process::Command;
                                let _ = Command::new("taskkill")
                                    .args(["/PID", &pid.to_string(), "/T", "/F"])
                                    .output();
                                println!("Server process tree kill completed");
                            }
                        } else {
                            println!("No server PID found (already stopped or never started)");
                        }
                    } else {
                        println!("Keeping server running per user setting");
                    }
                    println!("=================================================================");
                }
                RunEvent::ExitRequested { api, .. } => {
                    println!("RunEvent::ExitRequested received");
                    // Don't prevent exit, just log it
                    let _ = api;
                }
                _ => {}
            }
        });
}

fn main() {
    run();
}
