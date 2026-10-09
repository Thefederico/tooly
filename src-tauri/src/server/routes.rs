use crate::modules::archive_org::{ArchiveOrgClient, ArchiveOrgGameUpdate};
use crate::modules::discovery::{DiscoveredPs5, DiscoveryService};
use crate::modules::dpi::{DpiInstallResponse, DpiService};
use crate::modules::error::ToolyError;
use crate::modules::ftp_injector::{FtpInjectionResult, FtpPayloadInjector};
use crate::modules::ftp_scanner::{FtpScanner, InstalledApp};
use crate::modules::github::{GitHubClient, GitHubReleaseInfo};
use crate::modules::payloads::{LocalPayload, PayloadScanner};
use crate::modules::self_update::{AppUpdateInfo, SelfUpdateService};

use axum::extract::{Json, State};
use axum::routing::post;
use axum::Router;
use serde::Deserialize;
use std::collections::HashMap;
use std::net::Ipv4Addr;
use std::str::FromStr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tower_http::cors::CorsLayer;

/// Gestor de sesiones de escaneo compartible entre endpoints
#[derive(Default)]
pub struct DaemonScanManager {
    sessions: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl DaemonScanManager {
    pub fn cancel(&self, session_id: &str) -> bool {
        let map = self.sessions.lock().unwrap();
        if let Some(flag) = map.get(session_id) {
            flag.store(true, Ordering::Relaxed);
            true
        } else {
            false
        }
    }
}

#[derive(Clone, Default)]
pub struct AppState {
    pub scan_manager: Arc<DaemonScanManager>,
}

// DTOs para solicitudes POST JSON

#[derive(Deserialize, Default)]
pub struct DiscoverPs5Params {
    pub base_ip: Option<String>,
    pub timeout_ms: Option<u64>,
}

#[derive(Deserialize)]
pub struct ScanPs5AppsParams {
    pub ip: String,
    pub port: Option<u16>,
    pub timeout_secs: Option<u64>,
}

#[derive(Deserialize)]
pub struct CancelScanParams {
    pub session_id: String,
}

#[derive(Deserialize)]
pub struct ScanLocalPayloadsParams {
    pub directory: String,
}

#[derive(Deserialize)]
pub struct CheckGithubUpdateParams {
    pub repo: String,
}

#[derive(Deserialize)]
pub struct CheckBatchGithubUpdatesParams {
    pub repos: Vec<String>,
    pub concurrency: Option<usize>,
}

#[derive(Deserialize)]
pub struct TriggerDpiUpdateParams {
    pub ps5_ip: String,
    pub download_url: String,
    pub file_name: String,
}

#[derive(Deserialize)]
pub struct SearchArchiveUpdatesParams {
    pub title_id: String,
    pub game_name: Option<String>,
    pub current_version: Option<String>,
}

#[derive(Deserialize)]
pub struct InstallArchiveUpdateDirectParams {
    pub ps5_ip: String,
    pub download_url: String,
}

#[derive(Deserialize)]
pub struct UpdatePayloadViaFtpParams {
    pub ps5_ip: String,
    pub port: Option<u16>,
    pub target_folder: String,
    pub download_url: String,
    pub new_filename: String,
    pub new_version: String,
}

#[derive(Deserialize, Default)]
pub struct CheckAppUpdateParams {
    pub repo: Option<String>,
}

#[derive(Deserialize)]
pub struct StartPs5FtpServerParams {
    pub ps5_ip: String,
}

// Handlers REST

async fn handle_discover_ps5(
    Json(params): Json<DiscoverPs5Params>,
) -> Result<Json<Vec<DiscoveredPs5>>, ToolyError> {
    let resolved_ip = match params.base_ip {
        Some(ip_str) => Ipv4Addr::from_str(&ip_str)
            .map_err(|e| ToolyError::InvalidInput(format!("IP inválida '{ip_str}': {e}")))?,
        None => DiscoveryService::detect_local_lan_ip()
            .ok_or_else(|| ToolyError::IoError("No se pudo detectar la IP local".to_string()))?,
    };

    let consoles = DiscoveryService::scan_subnet_for_ps5(resolved_ip, params.timeout_ms).await;
    Ok(Json(consoles))
}

async fn handle_scan_ps5_apps(
    Json(params): Json<ScanPs5AppsParams>,
) -> Result<Json<Vec<InstalledApp>>, ToolyError> {
    let port = params.port.unwrap_or(2121);
    let apps = tokio::task::spawn_blocking(move || {
        FtpScanner::scan_ps5(&params.ip, port, params.timeout_secs)
    })
    .await??;
    Ok(Json(apps))
}

async fn handle_cancel_scan(
    State(state): State<AppState>,
    Json(params): Json<CancelScanParams>,
) -> Result<Json<bool>, ToolyError> {
    Ok(Json(state.scan_manager.cancel(&params.session_id)))
}

async fn handle_scan_local_payloads(
    Json(params): Json<ScanLocalPayloadsParams>,
) -> Result<Json<Vec<LocalPayload>>, ToolyError> {
    let payloads = tokio::task::spawn_blocking(move || {
        PayloadScanner::scan_directory(&params.directory)
    })
    .await?
    .map_err(ToolyError::IoError)?;
    Ok(Json(payloads))
}

async fn handle_check_github_update(
    Json(params): Json<CheckGithubUpdateParams>,
) -> Result<Json<GitHubReleaseInfo>, ToolyError> {
    let release = GitHubClient::get_latest_release(&params.repo)
        .await
        .map_err(ToolyError::GitHubError)?;
    Ok(Json(release))
}

async fn handle_check_batch_github_updates(
    Json(params): Json<CheckBatchGithubUpdatesParams>,
) -> Result<Json<Vec<(String, Option<GitHubReleaseInfo>)>>, ToolyError> {
    let limit = params.concurrency.unwrap_or(4);
    let results = GitHubClient::check_batch_updates(params.repos, limit).await;
    let serialized: Vec<(String, Option<GitHubReleaseInfo>)> = results
        .into_iter()
        .map(|(repo, res)| (repo, res.ok()))
        .collect();
    Ok(Json(serialized))
}

async fn handle_trigger_dpi_update(
    Json(params): Json<TriggerDpiUpdateParams>,
) -> Result<Json<DpiInstallResponse>, ToolyError> {
    // En modo daemon headless, los eventos de progreso pueden integrarse a SSE o log
    let cb = Arc::new(|_payload| {});
    let res = DpiService::push_update_to_dpi(&params.ps5_ip, &params.download_url, &params.file_name, cb)
        .await
        .map_err(ToolyError::DpiError)?;
    Ok(Json(res))
}

async fn handle_search_archive_updates(
    Json(params): Json<SearchArchiveUpdatesParams>,
) -> Result<Json<Vec<ArchiveOrgGameUpdate>>, ToolyError> {
    let client = ArchiveOrgClient::new();
    let updates = client
        .search_updates(&params.title_id, params.game_name.as_deref(), params.current_version.as_deref())
        .await?;
    Ok(Json(updates))
}

async fn handle_install_archive_update_direct(
    Json(params): Json<InstallArchiveUpdateDirectParams>,
) -> Result<Json<DpiInstallResponse>, ToolyError> {
    let res = DpiService::send_direct_url_to_dpi(&params.ps5_ip, &params.download_url)
        .await
        .map_err(ToolyError::DpiError)?;
    Ok(Json(res))
}

async fn handle_update_payload_via_ftp(
    Json(params): Json<UpdatePayloadViaFtpParams>,
) -> Result<Json<String>, ToolyError> {
    let port = params.port.unwrap_or(2121);
    let msg = FtpScanner::update_remote_payload(
        &params.ps5_ip,
        port,
        &params.target_folder,
        &params.download_url,
        &params.new_filename,
        &params.new_version,
    )
    .await?;
    Ok(Json(msg))
}

async fn handle_check_app_update(
    Json(params): Json<CheckAppUpdateParams>,
) -> Result<Json<AppUpdateInfo>, ToolyError> {
    let info = SelfUpdateService::check_for_updates(params.repo.as_deref())
        .await
        .map_err(ToolyError::GitHubError)?;
    Ok(Json(info))
}

async fn handle_start_ps5_ftp_server(
    Json(params): Json<StartPs5FtpServerParams>,
) -> Result<Json<FtpInjectionResult>, ToolyError> {
    let result = FtpPayloadInjector::inject_and_verify_ftp(&params.ps5_ip).await?;
    Ok(Json(result))
}

async fn handle_system_info() -> Json<serde_json::Value> {
    let is_ps5 = cfg!(target_os = "freebsd") || std::env::var("TOOLY_ON_PS5").is_ok();
    Json(serde_json::json!({
        "app": "Tooly",
        "version": env!("CARGO_PKG_VERSION"),
        "is_ps5": is_ps5,
        "default_ip": if is_ps5 { "127.0.0.1" } else { "" }
    }))
}

pub fn create_api_router(state: AppState) -> Router {
    Router::new()
        .route("/api/system_info", post(handle_system_info))
        .route("/api/discover_ps5_consoles", post(handle_discover_ps5))
        .route("/api/scan_ps5_apps", post(handle_scan_ps5_apps))
        .route("/api/cancel_scan", post(handle_cancel_scan))
        .route("/api/scan_local_payloads", post(handle_scan_local_payloads))
        .route("/api/check_github_update", post(handle_check_github_update))
        .route("/api/check_batch_github_updates", post(handle_check_batch_github_updates))
        .route("/api/trigger_dpi_update", post(handle_trigger_dpi_update))
        .route("/api/search_archive_updates", post(handle_search_archive_updates))
        .route("/api/install_archive_update_direct", post(handle_install_archive_update_direct))
        .route("/api/update_payload_via_ftp", post(handle_update_payload_via_ftp))
        .route("/api/check_app_update", post(handle_check_app_update))
        .route("/api/start_ps5_ftp_server", post(handle_start_ps5_ftp_server))
        .layer(CorsLayer::permissive())
        .with_state(state)
}
