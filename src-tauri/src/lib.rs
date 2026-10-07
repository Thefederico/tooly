mod modules;

use modules::error::ToolyError;
use modules::discovery::{DiscoveredPs5, DiscoveryService};
use modules::dpi::{DpiInstallResponse, DpiService};
use modules::ftp_scanner::{
    FtpScanner, InstalledApp, ScanCompletePayload, ScanErrorPayload, ScanProgressPayload,
    ScanSessionResponse,
};
use modules::ftp_injector::{FtpInjectionResult, FtpPayloadInjector};
use modules::github::{GitHubClient, GitHubReleaseInfo};
use modules::payloads::{LocalPayload, PayloadScanner};
use std::collections::HashMap;
use std::net::Ipv4Addr;
use std::str::FromStr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

/// Gestor de sesiones de escaneo activas en background para permitir cancelación atómica
#[derive(Default)]
pub struct ScanManager {
    sessions: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl ScanManager {
    pub fn register(&self, session_id: String) -> Arc<AtomicBool> {
        let flag = Arc::new(AtomicBool::new(false));
        let mut map = self.sessions.lock().unwrap();
        map.insert(session_id, flag.clone());
        flag
    }

    pub fn cancel(&self, session_id: &str) -> bool {
        let map = self.sessions.lock().unwrap();
        if let Some(flag) = map.get(session_id) {
            flag.store(true, Ordering::Relaxed);
            true
        } else {
            false
        }
    }

    pub fn remove(&self, session_id: &str) {
        let mut map = self.sessions.lock().unwrap();
        map.remove(session_id);
    }
}

#[tauri::command]
async fn discover_ps5_consoles(
    base_ip: Option<String>,
    timeout_ms: Option<u64>,
) -> Result<Vec<DiscoveredPs5>, ToolyError> {
    let resolved_ip = match base_ip {
        Some(ip_str) => Ipv4Addr::from_str(&ip_str)
            .map_err(|e| ToolyError::InvalidInput(format!("IP inválida '{ip_str}': {e}")))?,
        None => DiscoveryService::detect_local_lan_ip()
            .ok_or_else(|| ToolyError::IoError("No se pudo detectar la IP de la interfaz de red local".to_string()))?,
    };

    Ok(DiscoveryService::scan_subnet_for_ps5(resolved_ip, timeout_ms).await)
}

#[tauri::command]
async fn start_scan_ps5_apps(
    app: AppHandle,
    scan_manager: State<'_, Arc<ScanManager>>,
    ip: String,
    port: Option<u16>,
    timeout_secs: Option<u64>,
) -> Result<ScanSessionResponse, ToolyError> {
    static NEXT_SCAN_ID: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);
    let session_id = format!(
        "scan-{}-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0),
        NEXT_SCAN_ID.fetch_add(1, Ordering::Relaxed)
    );
    let cancel_flag = scan_manager.register(session_id.clone());
    let port = port.unwrap_or(2121);

    let app_handle = app.clone();
    let session_id_clone = session_id.clone();
    let scan_manager_inner = scan_manager.inner().clone();
    let cancel_flag_check = cancel_flag.clone();

    tokio::task::spawn_blocking(move || {
        let sid = session_id_clone.clone();
        let app_h = app_handle.clone();
        let app_h2 = app_handle.clone();

        let res = FtpScanner::scan_ps5_stream(
            &ip,
            port,
            timeout_secs,
            &sid,
            cancel_flag,
            move |app_item: InstalledApp| {
                let _ = app_h.emit("scan:discovered", app_item);
            },
            move |prog: ScanProgressPayload| {
                let _ = app_h2.emit("scan:progress", prog);
            },
        );

        match res {
            Ok(apps) => {
                if cancel_flag_check.load(Ordering::Relaxed) {
                    let _ = app_handle.emit(
                        "scan:cancelled",
                        ScanCompletePayload {
                            session_id: sid.clone(),
                            total_apps: apps.len(),
                        },
                    );
                } else {
                    let _ = app_handle.emit(
                        "scan:complete",
                        ScanCompletePayload {
                            session_id: sid.clone(),
                            total_apps: apps.len(),
                        },
                    );
                }
            }
            Err(err) => {
                let _ = app_handle.emit(
                    "scan:error",
                    ScanErrorPayload {
                        session_id: sid.clone(),
                        error: err,
                    },
                );
            }
        }

        scan_manager_inner.remove(&sid);
    });

    Ok(ScanSessionResponse { session_id })
}

#[tauri::command]
async fn cancel_scan(
    scan_manager: State<'_, Arc<ScanManager>>,
    session_id: String,
) -> Result<bool, ToolyError> {
    Ok(scan_manager.cancel(&session_id))
}

#[tauri::command]
async fn scan_ps5_apps(
    ip: String,
    port: Option<u16>,
    timeout_secs: Option<u64>,
) -> Result<Vec<InstalledApp>, ToolyError> {
    let port = port.unwrap_or(2121);
    tokio::task::spawn_blocking(move || FtpScanner::scan_ps5(&ip, port, timeout_secs))
        .await?
}

#[tauri::command]
async fn scan_local_payloads(directory: String) -> Result<Vec<LocalPayload>, ToolyError> {
    tokio::task::spawn_blocking(move || PayloadScanner::scan_directory(&directory))
        .await?
        .map_err(ToolyError::IoError)
}

#[tauri::command]
async fn check_github_update(repo: String) -> Result<GitHubReleaseInfo, ToolyError> {
    GitHubClient::get_latest_release(&repo)
        .await
        .map_err(ToolyError::GitHubError)
}

#[tauri::command]
async fn check_batch_github_updates(
    repos: Vec<String>,
    concurrency: Option<usize>,
) -> Result<Vec<(String, Option<GitHubReleaseInfo>)>, ToolyError> {
    let limit = concurrency.unwrap_or(4);
    let results = GitHubClient::check_batch_updates(repos, limit).await;
    let serialized: Vec<(String, Option<GitHubReleaseInfo>)> = results
        .into_iter()
        .map(|(repo, res)| (repo, res.ok()))
        .collect();
    Ok(serialized)
}

#[tauri::command]
async fn trigger_dpi_update(
    app: AppHandle,
    ps5_ip: String,
    download_url: String,
    file_name: String,
) -> Result<DpiInstallResponse, ToolyError> {
    let app_handle = app.clone();
    let cb = Arc::new(move |payload| {
        let _ = app_handle.emit("dpi-progress", payload);
    });

    DpiService::push_update_to_dpi(&ps5_ip, &download_url, &file_name, cb)
        .await
        .map_err(ToolyError::DpiError)
}

#[tauri::command]
async fn search_archive_updates(
    title_id: String,
    game_name: Option<String>,
    current_version: Option<String>,
) -> Result<Vec<modules::archive_org::ArchiveOrgGameUpdate>, ToolyError> {
    let client = modules::archive_org::ArchiveOrgClient::new();
    client
        .search_updates(&title_id, game_name.as_deref(), current_version.as_deref())
        .await
}

#[tauri::command]
async fn install_archive_update_direct(
    ps5_ip: String,
    download_url: String,
) -> Result<DpiInstallResponse, ToolyError> {
    DpiService::send_direct_url_to_dpi(&ps5_ip, &download_url)
        .await
        .map_err(ToolyError::DpiError)
}

#[tauri::command]
async fn update_payload_via_ftp(
    ps5_ip: String,
    port: Option<u16>,
    target_folder: String,
    download_url: String,
    new_filename: String,
    new_version: String,
) -> Result<String, ToolyError> {
    let port = port.unwrap_or(2121);
    FtpScanner::update_remote_payload(
        &ps5_ip,
        port,
        &target_folder,
        &download_url,
        &new_filename,
        &new_version,
    )
    .await
}

#[tauri::command]
async fn check_app_update(repo: Option<String>) -> Result<modules::self_update::AppUpdateInfo, ToolyError> {
    modules::self_update::SelfUpdateService::check_for_updates(repo.as_deref())
        .await
        .map_err(ToolyError::GitHubError)
}

#[tauri::command]
async fn start_ps5_ftp_server(ps5_ip: String) -> Result<FtpInjectionResult, ToolyError> {
    FtpPayloadInjector::inject_and_verify_ftp(&ps5_ip).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let scan_manager = Arc::new(ScanManager::default());

    tauri::Builder::default()
        .manage(scan_manager)
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            discover_ps5_consoles,
            start_scan_ps5_apps,
            cancel_scan,
            scan_ps5_apps,
            scan_local_payloads,
            check_github_update,
            check_batch_github_updates,
            trigger_dpi_update,
            check_app_update,
            search_archive_updates,
            install_archive_update_direct,
            update_payload_via_ftp,
            start_ps5_ftp_server
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
