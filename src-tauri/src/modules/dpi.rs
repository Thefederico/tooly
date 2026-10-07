use axum::Router;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::fs::File;
use tokio::io::AsyncWriteExt;
use tokio::net::TcpListener;
use tokio::sync::oneshot;
use tower_http::services::ServeFile;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct DownloadProgressPayload {
    pub file_name: String,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub percentage: f32,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DpiInstallResponse {
    pub success: bool,
    pub message: String,
}

pub struct DpiService;

impl DpiService {
    /// Descarga un archivo PKG en disco temporal por chunks emitiendo progreso mediante callback Arc
    pub async fn stream_download_to_temp_with_progress(
        download_url: &str,
        file_name: &str,
        progress_cb: Arc<dyn Fn(DownloadProgressPayload) + Send + Sync>,
    ) -> Result<PathBuf, String> {
        let client = reqwest::Client::builder()
            .user_agent("Tooly-PS5-Updater")
            .build()
            .map_err(|e| format!("Error creando cliente HTTP: {}", e))?;

        let mut resp = client
            .get(download_url)
            .send()
            .await
            .map_err(|e| format!("Error descargando PKG de GitHub: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("Fallo descarga de PKG: status {}", resp.status()));
        }

        let total_bytes = resp.content_length();
        let mut downloaded_bytes: u64 = 0;

        let temp_dir = std::env::temp_dir().join("tooly_pkgs");
        tokio::fs::create_dir_all(&temp_dir)
            .await
            .map_err(|e| format!("Error creando directorio temporal: {}", e))?;

        let target_path = temp_dir.join(file_name);
        let mut file = File::create(&target_path)
            .await
            .map_err(|e| format!("Error creando archivo temporal en disco: {}", e))?;

        progress_cb(DownloadProgressPayload {
            file_name: file_name.to_string(),
            downloaded_bytes: 0,
            total_bytes,
            percentage: 0.0,
            status: "downloading".to_string(),
        });

        while let Some(chunk) = resp
            .chunk()
            .await
            .map_err(|e| format!("Error leyendo chunk: {}", e))?
        {
            file.write_all(&chunk)
                .await
                .map_err(|e| format!("Error escribiendo chunk a disco: {}", e))?;

            downloaded_bytes += chunk.len() as u64;

            let percentage = if let Some(tot) = total_bytes {
                if tot > 0 {
                    ((downloaded_bytes as f64 / tot as f64) * 100.0) as f32
                } else {
                    0.0
                }
            } else {
                0.0
            };

            progress_cb(DownloadProgressPayload {
                file_name: file_name.to_string(),
                downloaded_bytes,
                total_bytes,
                percentage,
                status: "downloading".to_string(),
            });
        }

        file.flush()
            .await
            .map_err(|e| format!("Error en flush de archivo: {}", e))?;

        progress_cb(DownloadProgressPayload {
            file_name: file_name.to_string(),
            downloaded_bytes,
            total_bytes,
            percentage: 100.0,
            status: "ready_to_send".to_string(),
        });

        Ok(target_path)
    }

    /// Construye el router Axum con ServeFile
    pub fn build_file_router(file_path: PathBuf) -> Router {
        Router::new().route_service("/pkg", ServeFile::new(file_path))
    }

    /// Levanta servidor efímero en disco y notifica al DPI
    pub async fn push_update_to_dpi(
        ps5_ip: &str,
        download_url: &str,
        file_name: &str,
        progress_cb: Arc<dyn Fn(DownloadProgressPayload) + Send + Sync>,
    ) -> Result<DpiInstallResponse, String> {
        let temp_path = Self::stream_download_to_temp_with_progress(
            download_url,
            file_name,
            Arc::clone(&progress_cb),
        )
        .await?;

        progress_cb(DownloadProgressPayload {
            file_name: file_name.to_string(),
            downloaded_bytes: 0,
            total_bytes: None,
            percentage: 100.0,
            status: "starting_dpi_server".to_string(),
        });

        let listener = TcpListener::bind("0.0.0.0:0")
            .await
            .map_err(|e| format!("No se pudo bindear puerto local: {}", e))?;

        let local_port = listener
            .local_addr()
            .map_err(|e| e.to_string())?
            .port();

        let local_ip = Self::get_local_ip_to(ps5_ip)?;
        let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

        let app = Self::build_file_router(temp_path.clone());

        tokio::spawn(async move {
            let server = axum::serve(listener, app);
            tokio::select! {
                _ = server => {},
                _ = shutdown_rx => {},
            }
            let _ = tokio::fs::remove_file(temp_path).await;
        });

        let pkg_url = format!("http://{}:{}/pkg", local_ip, local_port);

        progress_cb(DownloadProgressPayload {
            file_name: file_name.to_string(),
            downloaded_bytes: 0,
            total_bytes: None,
            percentage: 100.0,
            status: "triggering_dpi".to_string(),
        });

        let client = reqwest::Client::new();
        let dpi_url_v2 = format!("http://{}:12800/install", ps5_ip);
        let dpi_payload = serde_json::json!({
            "url": pkg_url
        });

        let push_res = client
            .post(&dpi_url_v2)
            .json(&dpi_payload)
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await;

        match push_res {
            Ok(res) if res.status().is_success() => {
                tokio::spawn(async move {
                    tokio::time::sleep(tokio::time::Duration::from_secs(300)).await;
                    let _ = shutdown_tx.send(());
                });

                progress_cb(DownloadProgressPayload {
                    file_name: file_name.to_string(),
                    downloaded_bytes: 0,
                    total_bytes: None,
                    percentage: 100.0,
                    status: "installed_success".to_string(),
                });

                Ok(DpiInstallResponse {
                    success: true,
                    message: format!("Instalación enviada exitosamente a etaHEN DPI ({})", dpi_url_v2),
                })
            }
            _ => {
                let legacy_res = Self::send_legacy_dpi(ps5_ip, &pkg_url).await;
                match legacy_res {
                    Ok(_) => {
                        tokio::spawn(async move {
                            tokio::time::sleep(tokio::time::Duration::from_secs(300)).await;
                            let _ = shutdown_tx.send(());
                        });

                        progress_cb(DownloadProgressPayload {
                            file_name: file_name.to_string(),
                            downloaded_bytes: 0,
                            total_bytes: None,
                            percentage: 100.0,
                            status: "installed_success".to_string(),
                        });

                        Ok(DpiInstallResponse {
                            success: true,
                            message: "Instalación enviada a etaHEN DPI v1 (:9090)".to_string(),
                        })
                    }
                    Err(e) => {
                        let _ = shutdown_tx.send(());
                        progress_cb(DownloadProgressPayload {
                            file_name: file_name.to_string(),
                            downloaded_bytes: 0,
                            total_bytes: None,
                            percentage: 0.0,
                            status: "error".to_string(),
                        });
                        Err(format!(
                            "No se pudo contactar con etaHEN DPI en el puerto 12800 ni 9090: {}. ¿Está etaHEN activo?",
                            e
                        ))
                    }
                }
            }
        }
    }

    /// Envía directamente una URL remota (ej: archive.org) a etaHEN DPI (:12800 / :9090)
    /// sin descargar el archivo en la PC ni hostear servidor local.
    pub async fn send_direct_url_to_dpi(ps5_ip: &str, direct_url: &str) -> Result<DpiInstallResponse, String> {
        let client = reqwest::Client::new();
        let dpi_url_v2 = format!("http://{}:12800/install", ps5_ip);
        let dpi_payload = serde_json::json!({
            "url": direct_url
        });

        let push_res = client
            .post(&dpi_url_v2)
            .json(&dpi_payload)
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await;

        match push_res {
            Ok(res) if res.status().is_success() => {
                Ok(DpiInstallResponse {
                    success: true,
                    message: format!("Instalación directa enviada a etaHEN DPI (:12800)"),
                })
            }
            _ => {
                let legacy_res = Self::send_legacy_dpi(ps5_ip, direct_url).await;
                match legacy_res {
                    Ok(_) => Ok(DpiInstallResponse {
                        success: true,
                        message: "Instalación directa enviada a etaHEN DPI (:9090)".to_string(),
                    }),
                    Err(e) => Err(format!(
                        "No se pudo contactar con etaHEN DPI en el puerto 12800 ni 9090: {}. ¿Está etaHEN activo?",
                        e
                    )),
                }
            }
        }
    }

    async fn send_legacy_dpi(ps5_ip: &str, pkg_url: &str) -> Result<(), String> {
        use tokio::io::AsyncWriteExt;
        let mut stream = tokio::net::TcpStream::connect(format!("{}:9090", ps5_ip))
            .await
            .map_err(|e| e.to_string())?;

        let json = serde_json::json!({ "url": pkg_url }).to_string();
        stream.write_all(json.as_bytes()).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    fn get_local_ip_to(target_ip: &str) -> Result<String, String> {
        let socket = std::net::UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
        socket.connect(format!("{}:12800", target_ip)).map_err(|e| e.to_string())?;
        let local_addr = socket.local_addr().map_err(|e| e.to_string())?;
        Ok(local_addr.ip().to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_streaming_file_server_via_tcp() {
        let temp_dir = std::env::temp_dir().join("tooly_tests");
        tokio::fs::create_dir_all(&temp_dir).await.unwrap();
        let test_pkg_path = temp_dir.join("test_game.pkg");

        let fake_pkg_data = b"\x7FCNT_PS5_PKG_HEADER_MOCK_STREAM_DATA_CHUNK";
        tokio::fs::write(&test_pkg_path, fake_pkg_data).await.unwrap();

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();

        let app = DpiService::build_file_router(test_pkg_path.clone());
        let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

        tokio::spawn(async move {
            let server = axum::serve(listener, app);
            tokio::select! {
                _ = server => {},
                _ = shutdown_rx => {},
            }
        });

        let url = format!("http://127.0.0.1:{}/pkg", port);
        let client = reqwest::Client::new();
        let res = client.get(&url).send().await.expect("Debe conectar al servidor local");

        assert_eq!(res.status(), reqwest::StatusCode::OK);
        let content_len = res.content_length().expect("Debe reportar Content-Length");
        assert_eq!(content_len, fake_pkg_data.len() as u64);

        let body = res.bytes().await.expect("Debe descargar bytes por streaming");
        assert_eq!(&body[..], fake_pkg_data);

        let _ = shutdown_tx.send(());
        let _ = tokio::fs::remove_file(test_pkg_path).await;
    }

    #[test]
    fn test_download_progress_payload_percentage_calculation() {
        let total = 1000u64;
        let downloaded = 250u64;
        let percentage = ((downloaded as f64 / total as f64) * 100.0) as f32;

        let payload = DownloadProgressPayload {
            file_name: "test.pkg".to_string(),
            downloaded_bytes: downloaded,
            total_bytes: Some(total),
            percentage,
            status: "downloading".to_string(),
        };

        assert_eq!(payload.percentage, 25.0);
        assert_eq!(payload.status, "downloading");
    }
}
