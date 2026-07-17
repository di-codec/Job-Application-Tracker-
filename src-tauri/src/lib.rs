use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

use tauri::Manager;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

enum BackendChild {
    Shell(CommandChild),
    Native(Child),
}

impl BackendChild {
    fn kill(self) {
        match self {
            BackendChild::Shell(child) => {
                let _ = child.kill();
            }
            BackendChild::Native(mut child) => {
                let _ = child.kill();
            }
        }
    }
}

struct BackendProcess(Mutex<Option<BackendChild>>);

const API_PORT: &str = "3001";
const SIDECAR_NAME: &str = "binaries/job-tracker-api";

fn project_root() -> std::path::PathBuf {
    std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("project root")
        .to_path_buf()
}

fn wait_for_backend(port: &str) {
    let address = format!("127.0.0.1:{port}");
    for _ in 0..50 {
        if std::net::TcpStream::connect(&address).is_ok() {
            return;
        }
        std::thread::sleep(std::time::Duration::from_millis(200));
    }
    eprintln!("Backend did not become ready on {address}");
}

fn migrate_legacy_data(data_dir: &std::path::Path) -> Result<(), Box<dyn std::error::Error>> {
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
                std::fs::copy(entry.path(), target)?;
            }
        }
    }

    log::info!("Migrated legacy data from backend/data to app data dir");
    Ok(())
}

fn spawn_backend(app: &tauri::App) -> Result<BackendChild, Box<dyn std::error::Error>> {
    let data_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&data_dir)?;
    migrate_legacy_data(&data_dir)?;

    let data_dir_str = data_dir.to_string_lossy().to_string();

    let child = if cfg!(debug_assertions) {
        let backend_dir = project_root().join("backend");
        let server_js = backend_dir.join("server.js");

        let native_child = Command::new("node")
            .arg(server_js)
            .current_dir(&backend_dir)
            .env("JOB_TRACKER_DATA_DIR", &data_dir_str)
            .env("PORT", API_PORT)
            .env("HOST", "127.0.0.1")
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .spawn()?;

        BackendChild::Native(native_child)
    } else {
        let shell = app.shell();
        let (_, shell_child) = shell
            .sidecar(SIDECAR_NAME)?
            .env("JOB_TRACKER_DATA_DIR", &data_dir_str)
            .env("PORT", API_PORT)
            .env("HOST", "127.0.0.1")
            .spawn()?;

        BackendChild::Shell(shell_child)
    };

    wait_for_backend(API_PORT);
    Ok(child)
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

            let child = spawn_backend(app).map_err(|error| {
                eprintln!("Failed to start backend: {error}");
                std::io::Error::other(error.to_string())
            })?;

            app.manage(BackendProcess(Mutex::new(Some(child))));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            if let Some(state) = app_handle.try_state::<BackendProcess>() {
                if let Ok(mut guard) = state.0.lock() {
                    if let Some(child) = guard.take() {
                        child.kill();
                    }
                }
            }
        }
    });
}
