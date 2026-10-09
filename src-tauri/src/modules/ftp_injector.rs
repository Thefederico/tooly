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
#[allow(dead_code)]
pub const ETAHEN_DPI_PORT: u16 = 12800;
#[allow(dead_code)]
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
        let _ = IpAddr::from_str(ps5_ip)
            .map_err(|e| ToolyError::InvalidInput(format!("IP inválida '{ps5_ip}': {e}")))?;

        // etaHEN en puerto 12800 es un servidor HTTP DPI (instalador de PKGs) y en 9090 es un socket IPC.
        // No proporciona un endpoint documentado para la inyección de binarios ELF arbitrarios ni
        // para el arranque remoto del daemon FTP. Por tanto, evitamos falsos positivos y retornamos error.
        Err(ToolyError::PayloadInjectionError(
            "etaHEN no dispone de una API documentada para inyección de binarios ELF o inicio remoto de FTP".to_string(),
        ))
    }

    /// Espera y sondea si un puerto específico se abre dentro de max_wait_secs
    pub async fn poll_port_active(ps5_ip: &str, port: u16, max_wait_secs: u64) -> bool {
        let ip_addr = match std::net::Ipv4Addr::from_str(ps5_ip) {
            Ok(v4) => v4,
            Err(_) => return false,
        };

        let poll_interval = Duration::from_millis(300);
        let max_attempts = ((max_wait_secs * 1000) / 300).max(1);

        for _ in 0..max_attempts {
            if DiscoveryService::probe_port(ip_addr, port, Duration::from_millis(250)).await {
                return true;
            }
            tokio::time::sleep(poll_interval).await;
        }

        false
    }

    /// Espera y sondea si el puerto FTP (:2121) se abre dentro de max_wait_secs
    pub async fn poll_ftp_active(ps5_ip: &str, max_wait_secs: u64) -> bool {
        Self::poll_port_active(ps5_ip, PS5_FTP_PORT, max_wait_secs).await
    }

    /// Orquesta la inyección completa con estrategia dual y verificación de puerto FTP (:2121)
    pub async fn inject_and_verify_ftp(ps5_ip: &str) -> Result<FtpInjectionResult, ToolyError> {
        let payload = Self::get_embedded_ftpsrv_bytes();
        let mut last_error = None;

        // Estrategia 1 & 2: Probar puertos de ELF Loader (9020 y 9021)
        for &port in &[ELF_LOADER_PORT_9020, ELF_LOADER_PORT_9021] {
            match Self::send_elf_socket(ps5_ip, port, payload, 1500).await {
                Ok(()) => {
                    // Dar tiempo a ftpsrv para inicializarse (hasta 3s)
                    if Self::poll_ftp_active(ps5_ip, 3).await {
                        let method = format!("ELF Loader ({port})");
                        return Ok(FtpInjectionResult {
                            success: true,
                            method_used: method.clone(),
                            ftp_verified: true,
                            message: format!("Servidor FTP iniciado y verificado exitosamente vía {method}"),
                        });
                    } else {
                        last_error = Some(ToolyError::PayloadInjectionError(format!(
                            "Payload enviado a ELF Loader ({port}), pero el puerto FTP 2121 no respondió"
                        )));
                        // Continuar al siguiente puerto/método si no verificó FTP
                    }
                }
                Err(err) => {
                    last_error = Some(err);
                }
            }
        }

        // Estrategia 3 (Fallback): Probar vía etaHEN si los anteriores no lograron verificar FTP
        match Self::send_via_etahen(ps5_ip, payload).await {
            Ok(method) => {
                let ftp_verified = Self::poll_ftp_active(ps5_ip, 3).await;
                return Ok(FtpInjectionResult {
                    success: ftp_verified,
                    method_used: method.clone(),
                    ftp_verified,
                    message: if ftp_verified {
                        format!("Servidor FTP iniciado y verificado exitosamente vía {method}")
                    } else {
                        format!("Payload enviado vía {method}, pero el puerto FTP 2121 aún no respondió")
                    },
                });
            }
            Err(err) => {
                if last_error.is_none() {
                    last_error = Some(err);
                }
            }
        }

        let err_msg = last_error
            .map(|e| format!("{e}. Verifica que el exploit / ELF Loader esté activo en la PS5"))
            .unwrap_or_else(|| format!("Puertos ELF Loader (9020, 9021) cerrados en {ps5_ip}. Ejecuta el exploit o etaHEN en tu PS5 primero"));
        Err(ToolyError::PayloadInjectionError(err_msg))
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
        let port = listener.local_addr().unwrap().port();

        // Probar que el helper detecta el listener activo
        let active = FtpPayloadInjector::poll_port_active("127.0.0.1", port, 1).await;
        assert!(active, "Debe detectar el puerto activo como true");

        // Cerrar el listener y verificar que detecta el puerto inactivo
        drop(listener);
        let inactive = FtpPayloadInjector::poll_port_active("127.0.0.1", port, 1).await;
        assert!(!inactive, "Debe detectar el puerto cerrado como false");
    }
}
