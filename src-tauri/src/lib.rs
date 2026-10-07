mod modules;

use modules::discovery::{DiscoveredPs5, DiscoveryService};
use modules::dpi::{DpiInstallResponse, DpiService};
use modules::ftp_scanner::{FtpScanner, InstalledApp};
use modules::github::{GitHubClient, GitHubReleaseInfo};
use modules::payloads::{LocalPayload, PayloadScanner};
use std::net::Ipv4Addr;
use std::str::FromStr;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

#[tauri::command]
async fn discover_ps5_consoles(
    base_ip: Option<String>,
    timeout_ms: Option<u64>,
) -> Result<Vec<DiscoveredPs5>, String> {
    let resolved_ip = match base_ip {
        Some(ip_str) => Ipv4Addr::from_str(&ip_str).map_err(|e| format!("IP inválida '{ip_str}': {e}"))?,
        None => DiscoveryService::detect_local_lan_ip()
            .ok_or_else(|| "No se pudo detectar la IP de la interfaz de red local".to_string())?,
    };

    Ok(DiscoveryService::scan_subnet_for_ps5(resolved_ip, timeout_ms).await)
}

#[tauri::command]
async fn scan_ps5_apps(
    ip: String,
    port: Option<u16>,
    timeout_secs: Option<u64>,
) -> Result<Vec<InstalledApp>, String> {
    let port = port.unwrap_or(2121);
    tokio::task::spawn_blocking(move || FtpScanner::scan_ps5(&ip, port, timeout_secs))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn scan_local_payloads(directory: String) -> Result<Vec<LocalPayload>, String> {
    tokio::task::spawn_blocking(move || PayloadScanner::scan_directory(&directory))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn check_github_update(repo: String) -> Result<GitHubReleaseInfo, String> {
    GitHubClient::get_latest_release(&repo).await
}

#[tauri::command]
async fn trigger_dpi_update(
    app: AppHandle,
    ps5_ip: String,
    download_url: String,
    file_name: String,
) -> Result<DpiInstallResponse, String> {
    let app_handle = app.clone();
    let cb = Arc::new(move |payload| {
        let _ = app_handle.emit("dpi-progress", payload);
    });

    DpiService::push_update_to_dpi(&ps5_ip, &download_url, &file_name, cb).await
}

#[tauri::command]
async fn search_archive_updates(
    title_id: String,
    game_name: Option<String>,
    current_version: Option<String>,
) -> Result<Vec<modules::archive_org::ArchiveOrgGameUpdate>, String> {
    let client = modules::archive_org::ArchiveOrgClient::new();
    client
        .search_updates(&title_id, game_name.as_deref(), current_version.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn install_archive_update_direct(
    ps5_ip: String,
    download_url: String,
) -> Result<DpiInstallResponse, String> {
    DpiService::send_direct_url_to_dpi(&ps5_ip, &download_url).await
}

#[tauri::command]
async fn update_payload_via_ftp(
    ps5_ip: String,
    port: Option<u16>,
    target_folder: String,
    download_url: String,
    new_filename: String,
    new_version: String,
) -> Result<String, String> {
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
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn check_app_update(repo: Option<String>) -> Result<modules::self_update::AppUpdateInfo, String> {
    modules::self_update::SelfUpdateService::check_for_updates(repo.as_deref()).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            discover_ps5_consoles,
            scan_ps5_apps,
            scan_local_payloads,
            check_github_update,
            trigger_dpi_update,
            check_app_update,
            search_archive_updates,
            install_archive_update_direct,
            update_payload_via_ftp
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
