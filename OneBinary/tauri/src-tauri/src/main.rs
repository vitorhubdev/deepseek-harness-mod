//! OneBinary Tauri 2 host — spawns the harness as a Node sidecar.
//! The harness itself (Cordis tree) stays 100% Node; Rust only owns the
//! WebView window, single-instance lock, resource-dir plumbing, and graceful
//! shutdown. DSH_HOME stays external so sessions survive reboot.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Stdio;
use tauri::{
    async_runtime::spawn as tauri_spawn,
    Manager,
};
use tauri_plugin_shell::ShellExt;

/// Resolve the bundled resource dir and expose it to the Node sidecar as env.
fn resource_dir_env(app: &tauri::AppHandle) -> String {
    app.path()
        .resource_dir()
        .expect("resource dir")
        .to_string_lossy()
        .to_string()
}

fn dsh_home_for_tauri(app: &tauri::AppHandle) -> String {
    if let Ok(explicit) = std::env::var("DSH_HOME") {
        if !explicit.trim().is_empty() {
            return explicit;
        }
    }
    // Tauri appDataDir() ≈ Electron app.getPath('userData')
    let base = app
        .path()
        .app_data_dir()
        .expect("app data dir");
    base.join(".dsh").to_string_lossy().to_string()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let resource_dir = resource_dir_env(&handle);
            let dsh_home = dsh_home_for_tauri(&handle);

            // Guard: refuse to boot if DSH_HOME would be inside resources
            if dsh_home.to_lowercase().startsWith(&resource_dir.to_lowercase()) {
                eprintln!(
                    "OneBinary: DSH_HOME must be outside resources, got {} inside {}",
                    dsh_home, resource_dir
                );
                std::process::exit(1);
            }

            // Spawn the Node sidecar that boots the Cordis harness.
            // The sidecar is `node` from externalBin; the harness entry is
            // `apps/cli/lib/bin.js --profile web` (built via `pnpm run build:official`).
            let harness_entry = format!("{}/apps/cli/lib/bin.js", resource_dir);
            let sidecar = handle
                .shell()
                .sidecar("node")
                .expect("node sidecar not found — add it as externalBin and place node binary in OneBinary/tauri/src-tauri/binaries/")
                .args([&harness_entry, "--profile", "web"]);

            tauri_spawn(async move {
                let mut cmd = sidecar
                    .env("ONEBINARY_RESOURCE_DIR", resource_dir)
                    .env("DSH_HOME", dsh_home)
                    // Keep layered .env loading inside the sidecar; don't inherit Tauri env noise
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .spawn()
                    .expect("failed to spawn harness sidecar");

                // Stream sidecar logs to the Tauri log (visible in `cargo tauri dev`)
                let stdout = cmd.stdout.take();
                let stderr = cmd.stderr.take();
                if let Some(out) = stdout {
                    tauri_spawn(async move {
                        use tokio::io::AsyncReadExt;
                        let mut reader = tokio::io::BufReader::new(out);
                        let mut buf = String::new();
                        while reader.read_to_string(&mut buf).await.unwrap_or(0) > 0 {
                            print!("{}", buf);
                            buf.clear();
                        }
                    });
                }
                if let Some(err) = stderr {
                    tauri_spawn(async move {
                        use tokio::io::AsyncReadExt;
                        let mut reader = tokio::io::BufReader::new(err);
                        let mut buf = String::new();
                        while reader.read_to_string(&mut buf).await.unwrap_or(0) > 0 {
                            eprint!("{}", buf);
                            buf.clear();
                        }
                    });
                }

                let status = cmd.wait().await.expect("sidecar wait failed");
                eprintln!("OneBinary: harness sidecar exited with {}", status);
            });

            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // The sidecar is a child of this process; Tauri's shell plugin
                // terminates sidecars on app exit. Cordis' own SIGTERM handler
                // (apps/cli/src/process-shutdown.ts) then does the 5s graceful drain.
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
