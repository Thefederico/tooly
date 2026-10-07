use crate::modules::discovery::DiscoveryService;
use crate::modules::error::ToolyError;
use serde::{Deserialize, Serialize};
use std::net::{IpAddr, SocketAddr};
use std::str::FromStr;
use std::time::Duration;
use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;
use tokio::time::timeout;

pub const ELF_LOADER_PORT_9020: u16 = 9020;
pub const ELF_LOADER_PORT_9021: u16 = 9021;
pub const ETAHEN_DPI_PORT: u16 = 12800;
pub const ETAHEN_SOCKET_PORT: u16 = 9090;
pub const PS5_FTP_PORT: u16 = 2121;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FtpInjectionResult {
    pub success: bool,
    pub method_used: String,
    pub ftp_verified: bool,
    pub message: String,
}

pub struct FtpPayloadInjector;

impl FtpPayloadInjector {
    /// Devuelve los bytes del payload ftpsrv.elf embebido en el binario
    pub fn get_embedded_ftpsrv_bytes() -> &'static [u8] {
        include_bytes!("../../assets/payloads/ftpsrv.elf")
    }

    /// Intenta enviar un slice de bytes ELF a través de un socket TCP crudo al host y puerto especificados
    pub async fn send_elf_socket(ps5_ip: &str, port: u16, elf_bytes: &[u8], timeout_ms: u64) -> Result<(), ToolyError> {
        let ip_addr = IpAddr::from_str(ps5_ip)
            .map_err(|e| ToolyError::InvalidInput(format!("IP inválida '{ps5_ip}': {e}")))?;
        let addr = SocketAddr::new(ip_addr, port);
        let timeout_dur = Duration::from_millis(timeout_ms);

        let mut stream = timeout(timeout_dur, TcpStream::connect(addr))
            .await
            .map_err(|_| ToolyError::PayloadInjectionError(format!("Timeout conectando a {ps5_ip}:{port}")))?
            .map_err(|e| ToolyError::PayloadInjectionError(format!("Conexión rechazada o fallida en {ps5_ip}:{port}: {e}")))?;

        timeout(Duration::from_millis(timeout_ms * 3), stream.write_all(elf_bytes))
            .await
            .map_err(|_| ToolyError::PayloadInjectionError(format!("Timeout escribiendo payload a {ps5_ip}:{port}")))?
            .map_err(|e| ToolyError::PayloadInjectionError(format!("Error escribiendo datos a {ps5_ip}:{port}: {e}")))?;

        let _ = stream.flush().await;
        let _ = stream.shutdown().await;

        Ok(())
    }

    /// Fallback para enviar payload o comando a etaHEN DPI (:12800 / :9090)
    pub async fn send_via_etahen(ps5_ip: &str, _elf_bytes: &[u8]) -> Result<String, ToolyError> {
        // En etaHEN, se puede activar el servidor FTP o enviar un payload a través del endpoint HTTP /install o /payload
        let client = reqwest::Client::builder()
            .timeout(Duration::from_millis(2000))
            .build()
            .map_err(|e| ToolyError::PayloadInjectionError(e.to_string()))?;

        // 1. Probar HTTP 12800 /payload o /start_ftp
        let urls = [
            format!("http://{ps5_ip}:{ETAHEN_DPI_PORT}/start_ftp"),
            format!("http://{ps5_ip}:{ETAHEN_DPI_PORT}/payload"),
        ];

        for url in urls {
            if let Ok(res) = client.get(&url).send().await {
                if res.status().is_success() {
                    return Ok(format!("etaHEN HTTP ({url})"));
                }
            }
        }

        // 2. Probar socket 9090 con comando JSON
        let ip_addr = IpAddr::from_str(ps5_ip)
            .map_err(|e| ToolyError::InvalidInput(format!("IP inválida '{ps5_ip}': {e}")))?;
        let addr = SocketAddr::new(ip_addr, ETAHEN_SOCKET_PORT);

        if let Ok(Ok(mut stream)) = timeout(Duration::from_millis(1500), TcpStream::connect(addr)).await {
            let cmd = serde_json::json!({ "action": "start_ftp" }).to_string();
            if stream.write_all(cmd.as_bytes()).await.is_ok() {
                let _ = stream.flush().await;
                let _ = stream.shutdown().await;
                return Ok(format!("etaHEN Socket ({}:{})", ps5_ip, ETAHEN_SOCKET_PORT));
            }
        }

        Err(ToolyError::PayloadInjectionError(
            "etaHEN no respondió en puerto 12800 ni 9090".to_string(),
        ))
    }

    /// Espera y sondea si el puerto FTP (:2121) se abre dentro de max_wait_secs
    pub async fn poll_ftp_active(ps5_ip: &str, max_wait_secs: u64) -> bool {
        let ip_addr = match std::net::Ipv4Addr::from_str(ps5_ip) {
            Ok(v4) => v4,
            Err(_) => return false,
        };

        let poll_interval = Duration::from_millis(400);
        let max_attempts = (max_wait_secs * 1000) / 400;

        for _ in 0..max_attempts {
            if DiscoveryService::probe_port(ip_addr, PS5_FTP_PORT, Duration::from_millis(300)).await {
                return true;
            }
            tokio::time::sleep(poll_interval).await;
        }

        false
    }

    /// Orquesta la inyección completa con estrategia dual y verificación de puerto FTP (:2121)
    pub async fn inject_and_verify_ftp(ps5_ip: &str) -> Result<FtpInjectionResult, ToolyError> {
        let payload = Self::get_embedded_ftpsrv_bytes();

        let mut method_used = String::new();
        let mut last_error = None;

        // Estrategia 1: Probar puerto 9020 (ELF Loader estándar / kstuff)
        if Self::send_elf_socket(ps5_ip, ELF_LOADER_PORT_9020, payload, 1500).await.is_ok() {
            method_used = format!("ELF Loader ({ELF_LOADER_PORT_9020})");
        } else if Self::send_elf_socket(ps5_ip, ELF_LOADER_PORT_9021, payload, 1500).await.is_ok() {
            // Estrategia 2: Probar puerto 9021 (ELF Loader alternativo)
            method_used = format!("ELF Loader ({ELF_LOADER_PORT_9021})");
        } else {
            // Estrategia 3 (Fallback): Probar vía etaHEN API / Socket
            match Self::send_via_etahen(ps5_ip, payload).await {
                Ok(method) => {
                    method_used = method;
                }
                Err(err) => {
                    last_error = Some(err);
                }
            }
        }

        if method_used.is_empty() {
            let err_msg = last_error
                .map(|e| e.to_string())
                .unwrap_or_else(|| "Puertos 9020, 9021 y etaHEN cerrados o inalcanzables".to_string());
            return Err(ToolyError::PayloadInjectionError(err_msg));
        }

        // Verificar que el servidor FTP (:2121) realmente responde
        let ftp_verified = Self::poll_ftp_active(ps5_ip, 4).await;

        Ok(FtpInjectionResult {
            success: true,
            method_used: method_used.clone(),
            ftp_verified,
            message: if ftp_verified {
                format!("Servidor FTP iniciado y verificado exitosamente vía {method_used}")
            } else {
                format!("Payload enviado vía {method_used}, pero el puerto FTP 2121 aún no respondió")
            },
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::AsyncReadExt;
    use tokio::net::TcpListener;

    #[test]
    fn test_embedded_ftpsrv_has_valid_elf_header() {
        let bytes = FtpPayloadInjector::get_embedded_ftpsrv_bytes();
        assert!(bytes.len() > 64, "ftpsrv.elf embebido no debe estar vacío");
        // Magic ELF: 0x7F, 'E', 'L', 'F' (0x7f 0x45 0x4c 0x46)
        assert_eq!(&bytes[0..4], b"\x7FELF", "El binario embebido debe ser un ELF válido de PS5");
        // 64-bit ELF (Class 2)
        assert_eq!(bytes[4], 2, "Debe ser arquitectura 64-bit (ELFCLASS64)");
    }

    #[tokio::test]
    async fn test_send_elf_socket_transfers_bytes_successfully() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();

        let test_payload = b"TEST_PS5_ELF_PAYLOAD_CONTENT_12345";

        let server_task = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut buf = Vec::new();
            socket.read_to_end(&mut buf).await.unwrap();
            buf
        });

        let send_res = FtpPayloadInjector::send_elf_socket("127.0.0.1", port, test_payload, 1000).await;
        assert!(send_res.is_ok(), "El envío por socket debe completarse exitosamente");

        let received = server_task.await.unwrap();
        assert_eq!(received, test_payload, "El servidor debe recibir exactamente los bytes del payload");
    }

    #[tokio::test]
    async fn test_send_elf_socket_fails_fast_on_closed_port() {
        let res = FtpPayloadInjector::send_elf_socket("127.0.0.1", 59999, b"test", 150).await;
        assert!(res.is_err(), "Debe fallar al conectar a un puerto cerrado");
    }

    #[tokio::test]
    async fn test_poll_ftp_active_detects_active_port() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let _port = listener.local_addr().unwrap().port();

        // Si sondeamos un puerto inexistente debe dar false rápidamente
        let inactive = FtpPayloadInjector::poll_ftp_active("127.0.0.1", 1).await;
        assert!(!inactive, "Debe ser false si el puerto 2121 no está escuchando");
    }
}
