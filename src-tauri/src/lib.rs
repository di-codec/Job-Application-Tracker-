use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::thread;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use tauri::Manager;

struct BackendProcess {
    child: Mutex<Option<Child>>,
    shutting_down: AtomicBool,
}

const API_PORT: &str = "3001";

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn configure_hidden_command(command: &mut Command) {
    command.stdout(Stdio::null()).stderr(Stdio::null());

    #[cfg(windows)]
    {
        // Prevent the Node/caxa console window from flashing on Windows.
        command.creation_flags(CREATE_NO_WINDOW);
    }
}

fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("project root")
        .to_path_buf()
}

fn wait_for_backend(port: &str, attempts: u32) -> bool {
    let address = format!("127.0.0.1:{port}");
    for _ in 0..attempts {
        if std::net::TcpStream::connect(&address).is_ok() {
            return true;
        }
        thread::sleep(std::time::Duration::from_millis(200));
    }
    false
}

fn migrate_legacy_data(data_dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = data_dir.join("applications.db");
    if db_path.exists() {
        return Ok(());
    }

    let legacy_db = project_root()
        .join("backend")
        .join("data")
        .join("applications.db");
    if !legacy_db.exists() {
        return Ok(());
    }

    std::fs::copy(&legacy_db, &db_path)?;

    let legacy_uploads = project_root().join("backend").join("uploads");
    let uploads_dir = data_dir.join("uploads");
    if legacy_uploads.is_dir() {
        std::fs::create_dir_all(&uploads_dir)?;
        for entry in std::fs::read_dir(&legacy_uploads)? {
            let entry = entry?;
            let target = uploads_dir.join(entry.file_name());
            if entry.file_type()?.is_file() && !target.exists() {
                let _ = std::fs::copy(entry.path(), target);
            }
        }
    }

    log::info!("Migrated legacy data from backend/data to app data dir");
    Ok(())
}

fn release_sidecar_path() -> Result<PathBuf, Box<dyn std::error::Error>> {
    let exe_dir = std::env::current_exe()?
        .parent()
        .ok_or("missing exe directory")?
        .to_path_buf();

    let mut candidates = vec![
        exe_dir.join("job-tracker-api.exe"),
        exe_dir.join("binaries").join("job-tracker-api.exe"),
    ];

    if let Ok(entries) = std::fs::read_dir(&exe_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name = name.to_string_lossy();
            if name.starts_with("job-tracker-api") && name.ends_with(".exe") {
                candidates.push(entry.path());
            }
        }
    }

    let binaries_dir = exe_dir.join("binaries");
    if let Ok(entries) = std::fs::read_dir(&binaries_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name = name.to_string_lossy();
            if name.starts_with("job-tracker-api") && name.ends_with(".exe") {
                candidates.push(entry.path());
            }
        }
    }

    for path in candidates {
        if path.is_file() {
            return Ok(path);
        }
    }

    Err(format!(
        "sidecar not found next to app.exe (looked in {})",
        exe_dir.display()
    )
    .into())
}

fn spawn_backend_process(data_dir: &Path) -> Result<Child, Box<dyn std::error::Error>> {
    let data_dir_str = data_dir.to_string_lossy().to_string();

    let child = if cfg!(debug_assertions) {
        let backend_dir = project_root().join("backend");
        let server_js = backend_dir.join("server.js");

        let mut command = Command::new("node");
        command
            .arg(server_js)
            .current_dir(&backend_dir)
            .env("JOB_TRACKER_DATA_DIR", &data_dir_str)
            .env("PORT", API_PORT)
            .env("HOST", "127.0.0.1");
        configure_hidden_command(&mut command);
        command.spawn()?
    } else {
        let sidecar = release_sidecar_path()?;
        let sidecar_dir = sidecar
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_else(|| PathBuf::from("."));

        let mut command = Command::new(&sidecar);
        command
            .current_dir(sidecar_dir)
            .env("JOB_TRACKER_DATA_DIR", &data_dir_str)
            .env("PORT", API_PORT)
            .env("HOST", "127.0.0.1");
        configure_hidden_command(&mut command);
        command.spawn()?
    };

    Ok(child)
}

fn backend_is_listening(port: &str) -> bool {
    let address = format!("127.0.0.1:{port}");
    match address.parse() {
        Ok(addr) => {
            std::net::TcpStream::connect_timeout(&addr, std::time::Duration::from_millis(300)).is_ok()
        }
        Err(_) => false,
    }
}

/// Kill the backend and everything it spawned. The caxa launcher starts a
/// child `node.exe`, so killing only the launcher would leave an orphan
/// holding the port.
fn kill_backend(child: &mut Child) {
    #[cfg(windows)]
    {
        let mut command = Command::new("taskkill");
        command.args(["/PID", &child.id().to_string(), "/T", "/F"]);
        configure_hidden_command(&mut command);
        let _ = command.status();
    }
    let _ = child.kill();
    let _ = child.wait();
}

/// Starts the backend (unless something already serves the port) and keeps
/// it alive: if the process exits, it is started again.
fn supervise_backend(handle: tauri::AppHandle, data_dir: PathBuf) {
    const MAX_RESTARTS: u32 = 5;
    let mut restarts = 0;

    loop {
        let Some(state) = handle.try_state::<BackendProcess>() else {
            return;
        };

        if state.shutting_down.load(Ordering::SeqCst) {
            return;
        }

        let running = {
            let mut guard = match state.child.lock() {
                Ok(guard) => guard,
                Err(_) => return,
            };
            match guard.as_mut() {
                Some(child) => match child.try_wait() {
                    Ok(None) => true,
                    _ => {
                        log::warn!("Backend process exited");
                        *guard = None;
                        false
                    }
                },
                None => false,
            }
        };

        // Nothing to do if our process is alive, or another backend (e.g. a
        // dev server or a previous instance) already answers on the port.
        if !running && !backend_is_listening(API_PORT) {
            if restarts > MAX_RESTARTS {
                log::error!("Backend failed to start {MAX_RESTARTS} times, giving up");
                return;
            }
            restarts += 1;

            match spawn_backend_process(&data_dir) {
                Ok(child) => {
                    if let Ok(mut guard) = state.child.lock() {
                        *guard = Some(child);
                    }
                    // Give it time to come up (first launch unpacks the sidecar,
                    // which can be slow). The process is never killed for being slow.
                    if wait_for_backend(API_PORT, 600) {
                        restarts = 0;
                    } else {
                        log::warn!("Backend is still not listening on 127.0.0.1:{API_PORT}");
                    }
                }
                Err(error) => {
                    log::error!("Failed to start backend: {error}");
                }
            }
        }

        thread::sleep(std::time::Duration::from_secs(2));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let _ = migrate_legacy_data(&data_dir);

            app.manage(BackendProcess {
                child: Mutex::new(None),
                shutting_down: AtomicBool::new(false),
            });

            // Start backend in the background so the UI window opens immediately.
            // The frontend waits for /api/health before making requests.
            let handle = app.handle().clone();
            thread::spawn(move || supervise_backend(handle, data_dir));

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            if let Some(state) = app_handle.try_state::<BackendProcess>() {
                state.shutting_down.store(true, Ordering::SeqCst);
                if let Ok(mut guard) = state.child.lock() {
                    if let Some(mut child) = guard.take() {
                        kill_backend(&mut child);
                    }
                }
            }
        }
    });
}
