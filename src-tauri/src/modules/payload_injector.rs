use serde::{Deserialize, Serialize};
use std::net::{IpAddr, SocketAddr};
use std::path::Path;
use std::time::Duration;
use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;
use tokio::time::{sleep, timeout};

pub const PS5_FTP_PORT: u16 = 2121;
pub const PS5_PAYLOAD_MANAGER_PORT: u16 = 8084;
pub const PS5_ELF_LOADER_PORT_9021: u16 = 9021;
pub const PS5_ELF_LOADER_PORT_9020: u16 = 9020;
pub const FTPSRV_GITHUB_REPO: &str = "ps5-payload-dev/ftpsrv";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Ps5ServicesStatus {
    pub ftp_open: bool,
    pub payload_manager_open: bool,
    pub elf_loader_port: Option<u16>,
}

#[derive(Debug, Deserialize)]
struct PldmgrPayloadItem {
    name: Option<String>,
    id: Option<String>,
    slot: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
}

#[derive(Debug, Deserialize)]
struct GitHubRelease {
    assets: Vec<GitHubAsset>,
}

pub struct PayloadInjectorService;

impl PayloadInjectorService {
    /// Sondea de forma no bloqueante si un puerto TCP está abierto
    pub async fn probe_port(ip: &str, port: u16, timeout_ms: u64) -> bool {
        let Ok(ip_addr) = ip.parse::<IpAddr>() else {
            return false;
        };
        let addr = SocketAddr::new(ip_addr, port);
        matches!(timeout(Duration::from_millis(timeout_ms), TcpStream::connect(addr)).await, Ok(Ok(_)))
    }

    /// Detecta el estado de todos los servicios relevantes en la PS5
    pub async fn check_services(ip: &str) -> Ps5ServicesStatus {
        let ftp_fut = Self::probe_port(ip, PS5_FTP_PORT, 300);
        let pldmgr_fut = Self::probe_port(ip, PS5_PAYLOAD_MANAGER_PORT, 300);
        let loader_9021_fut = Self::probe_port(ip, PS5_ELF_LOADER_PORT_9021, 300);
        let loader_9020_fut = Self::probe_port(ip, PS5_ELF_LOADER_PORT_9020, 300);

        let (ftp_open, payload_manager_open, loader_9021, loader_9020) =
            tokio::join!(ftp_fut, pldmgr_fut, loader_9021_fut, loader_9020_fut);

        let elf_loader_port = if loader_9021 {
            Some(PS5_ELF_LOADER_PORT_9021)
        } else if loader_9020 {
            Some(PS5_ELF_LOADER_PORT_9020)
        } else {
            None
        };

        Ps5ServicesStatus {
            ftp_open,
            payload_manager_open,
            elf_loader_port,
        }
    }

    /// Envía un payload crudo a un socket TCP (ej. port 9020 o 9021)
    pub async fn inject_via_socket(ip: &str, port: u16, payload_bytes: &[u8]) -> Result<(), String> {
        let ip_addr = ip.parse::<IpAddr>().map_err(|e| format!("IP inválida '{ip}': {e}"))?;
        let addr = SocketAddr::new(ip_addr, port);

        let connect_timeout = Duration::from_secs(4);
        let mut stream = timeout(connect_timeout, TcpStream::connect(addr))
            .await
            .map_err(|_| format!("Timeout conectando al ELF loader en {addr}"))?
            .map_err(|e| format!("Error conectando a {addr}: {e}"))?;

        stream
            .write_all(payload_bytes)
            .await
            .map_err(|e| format!("Error enviando bytes del payload a {addr}: {e}"))?;

        stream
            .flush()
            .await
            .map_err(|e| format!("Error finalizando transmisión a {addr}: {e}"))?;

        // Breve pausa para asegurar entrega al stack TCP
        sleep(Duration::from_millis(200)).await;
        Ok(())
    }

    /// Dispara la ejecución de un payload en el daemon HTTP de Payload Manager (:8084)
    pub async fn trigger_payload_manager(ip: &str, payload_target: &str) -> Result<String, String> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .map_err(|e| e.to_string())?;

        let url = format!("http://{ip}:{PS5_PAYLOAD_MANAGER_PORT}/loadpayload:{payload_target}");
        let resp = client
            .post(&url)
            .header("X-PLDMGR-Request", "1")
            .send()
            .await
            .map_err(|e| format!("Error enviando trigger a Payload Manager: {e}"))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Payload Manager respondió con código {status}: {body}"));
        }

        Ok(format!("Payload '{payload_target}' ejecutado con éxito vía Payload Manager (:8084)"))
    }

    /// Lista los payloads registrados en Payload Manager (:8084)
    pub async fn list_payloads_from_manager(ip: &str) -> Result<Vec<String>, String> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(3))
            .build()
            .map_err(|e| e.to_string())?;

        let url = format!("http://{ip}:{PS5_PAYLOAD_MANAGER_PORT}/list_payloads");
        let resp = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Error consultando /list_payloads: {e}"))?;

        if !resp.status().is_success() {
            return Err(format!("Fallo listando payloads con código {}", resp.status()));
        }

        let body = resp.text().await.map_err(|e| e.to_string())?;
        let mut results = Vec::new();

        if let Ok(items) = serde_json::from_str::<Vec<PldmgrPayloadItem>>(&body) {
            for item in items {
                if let Some(name) = item.name {
                    results.push(name);
                } else if let Some(id) = item.id {
                    results.push(id);
                } else if let Some(slot) = item.slot {
                    results.push(slot);
                }
            }
        } else if let Ok(val) = serde_json::from_str::<serde_json::Value>(&body) {
            // Si viene estructurado en un objeto raíz { "payloads": [...] }
            if let Some(arr) = val.get("payloads").and_then(|v| v.as_array()) {
                for item in arr {
                    if let Some(name) = item.get("name").and_then(|v| v.as_str()) {
                        results.push(name.to_string());
                    } else if let Some(id) = item.get("id").and_then(|v| v.as_str()) {
                        results.push(id.to_string());
                    }
                }
            }
        }

        Ok(results)
    }

    /// Sube un archivo .elf al Payload Manager (:8084) vía /manage:upload
    pub async fn upload_payload_to_manager(ip: &str, file_name: &str, bytes: &[u8]) -> Result<(), String> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .map_err(|e| e.to_string())?;

        let url = format!("http://{ip}:{PS5_PAYLOAD_MANAGER_PORT}/manage:upload");
        let part = reqwest::multipart::Part::bytes(bytes.to_vec())
            .file_name(file_name.to_string())
            .mime_str("application/octet-stream")
            .map_err(|e| e.to_string())?;

        let form = reqwest::multipart::Form::new().part("file", part);

        let resp = client
            .post(&url)
            .header("X-PLDMGR-Request", "1")
            .multipart(form)
            .send()
            .await
            .map_err(|e| format!("Error subiendo payload a Payload Manager: {e}"))?;

        if !resp.status().is_success() {
            return Err(format!("Upload falló con código HTTP {}", resp.status()));
        }

        Ok(())
    }

    /// Obtiene los bytes de ftpsrv-ps5.elf ya sea desde una ruta local o descargándolo desde GitHub Releases
    pub async fn resolve_ftpsrv_bytes(local_path: Option<&str>) -> Result<Vec<u8>, String> {
        if let Some(path_str) = local_path {
            let path = Path::new(path_str);
            if path.exists() && path.is_file() {
                return tokio::fs::read(path)
                    .await
                    .map_err(|e| format!("Error leyendo payload local '{path_str}': {e}"));
            }
        }

        // Descarga de última release oficial de ps5-payload-dev/ftpsrv
        let client = reqwest::Client::builder()
            .user_agent("Tooly-PS5-Payload-Injector")
            .timeout(Duration::from_secs(15))
            .build()
            .map_err(|e| e.to_string())?;

        let release_url = format!("https://api.github.com/repos/{FTPSRV_GITHUB_REPO}/releases/latest");
        let release: GitHubRelease = client
            .get(&release_url)
            .send()
            .await
            .map_err(|e| format!("Error consultando GitHub Releases de ftpsrv: {e}"))?
            .json()
            .await
            .map_err(|e| format!("Error parseando release de ftpsrv: {e}"))?;

        let asset = release
            .assets
            .into_iter()
            .find(|a| a.name == "ftpsrv-ps5.elf" || a.name.contains("ps5") && a.name.ends_with(".elf"))
            .ok_or_else(|| "No se encontró el asset ftpsrv-ps5.elf en la release de GitHub".to_string())?;

        let bytes = client
            .get(&asset.browser_download_url)
            .send()
            .await
            .map_err(|e| format!("Error descargando {}: {e}", asset.name))?
            .bytes()
            .await
            .map_err(|e| format!("Error leyendo bytes de descarga: {e}"))?;

        Ok(bytes.to_vec())
    }

    /// Inyecta y arranca el servidor FTP orquestando Payload Manager o Socket Directo y verificando :2121
    pub async fn inject_ftp_server(
        ip: &str,
        preferred_port: Option<u16>,
        local_elf_path: Option<&str>,
    ) -> Result<String, String> {
        // 1. Verificar si FTP ya está activo
        if Self::probe_port(ip, PS5_FTP_PORT, 250).await {
            return Ok("El servidor FTP ya está corriendo en el puerto 2121.".to_string());
        }

        let services = Self::check_services(ip).await;
        let injection_method = if services.payload_manager_open {
            // Intentar vía Payload Manager
            let manager_payloads = Self::list_payloads_from_manager(ip).await.unwrap_or_default();
            let ftpsrv_match = manager_payloads.iter().find(|name| {
                let n = name.to_lowercase();
                n.contains("ftp") || n.contains("ftpsrv")
            });

            if let Some(target) = ftpsrv_match {
                Self::trigger_payload_manager(ip, target).await?;
                format!("Payload Manager (:8084) -> {target}")
            } else {
                // Descargar / leer ftpsrv y subirlo
                let bytes = Self::resolve_ftpsrv_bytes(local_elf_path).await?;
                Self::upload_payload_to_manager(ip, "ftpsrv-ps5.elf", &bytes).await?;
                Self::trigger_payload_manager(ip, "ftpsrv-ps5.elf").await?;
                "Payload Manager (:8084) [Subido y lanzado]".to_string()
            }
        } else {
            // Fallback a socket directo ELF Loader
            let target_port = preferred_port
                .or(services.elf_loader_port)
                .unwrap_or(PS5_ELF_LOADER_PORT_9021);

            let bytes = Self::resolve_ftpsrv_bytes(local_elf_path).await?;
            Self::inject_via_socket(ip, target_port, &bytes).await?;
            format!("ELF Loader Socket (puerto {target_port})")
        };

        // 3. Polling activo a puerto 2121 hasta 8 segundos
        let poll_deadline = Duration::from_secs(8);
        let start_time = tokio::time::Instant::now();
        let mut ftp_started = false;

        while start_time.elapsed() < poll_deadline {
            sleep(Duration::from_millis(400)).await;
            if Self::probe_port(ip, PS5_FTP_PORT, 250).await {
                ftp_started = true;
                break;
            }
        }

        if ftp_started {
            Ok(format!("Servidor FTP inyectado exitosamente vía {injection_method} y escuchando en el puerto 2121."))
        } else {
            Err(format!(
                "Payload enviado vía {injection_method}, pero el puerto 2121 aún no respondió tras 8 segundos."
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ps5_services_status_struct() {
        let status = Ps5ServicesStatus {
            ftp_open: false,
            payload_manager_open: true,
            elf_loader_port: Some(9021),
        };
        assert!(!status.ftp_open);
        assert!(status.payload_manager_open);
        assert_eq!(status.elf_loader_port, Some(9021));
    }
}
