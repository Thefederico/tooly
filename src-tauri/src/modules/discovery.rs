use serde::{Deserialize, Serialize};
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::time::Duration;
use tokio::net::TcpStream;
use tokio::task::JoinSet;
use tokio::time::timeout;

pub const PS5_FTP_PORT: u16 = 2121;
pub const PS5_DPI_PORT: u16 = 12800;
pub const DEFAULT_PROBE_TIMEOUT_MS: u64 = 250;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DiscoveredPs5 {
    pub ip: String,
    pub ftp_open: bool,
    pub dpi_open: bool,
}

pub struct DiscoveryService;

impl DiscoveryService {
    /// Genera la lista de direcciones IPv4 dentro de la subred /24 de una IP base (omitiendo red .0 y broadcast .255)
    pub fn get_subnet_ips(base_ip: Ipv4Addr) -> Vec<Ipv4Addr> {
        let octets = base_ip.octets();
        (1..=254)
            .map(|last| Ipv4Addr::new(octets[0], octets[1], octets[2], last))
            .collect()
    }

    /// Sondea de forma no bloqueante si un puerto TCP responde antes del timeout dado
    pub async fn probe_port(ip: Ipv4Addr, port: u16, timeout_duration: Duration) -> bool {
        let addr = SocketAddr::new(IpAddr::V4(ip), port);
        match timeout(timeout_duration, TcpStream::connect(addr)).await {
            Ok(Ok(_)) => true,
            _ => false,
        }
    }

    /// Intenta detectar la IP local LAN mediante un socket UDP conectado a una IP pública común
    pub fn detect_local_lan_ip() -> Option<Ipv4Addr> {
        let socket = std::net::UdpSocket::bind("0.0.0.0:0").ok()?;
        socket.connect("1.1.1.1:80").ok()?;
        let local_addr = socket.local_addr().ok()?;
        match local_addr.ip() {
            IpAddr::V4(ipv4) => Some(ipv4),
            _ => None,
        }
    }

    /// Escanea concurrentemente toda la subred dada buscando consolas PS5 con FTP (:2121) o DPI (:12800)
    pub async fn scan_subnet_for_ps5(
        base_ip: Ipv4Addr,
        timeout_ms: Option<u64>,
    ) -> Vec<DiscoveredPs5> {
        let ips = Self::get_subnet_ips(base_ip);
        let probe_timeout = Duration::from_millis(timeout_ms.unwrap_or(DEFAULT_PROBE_TIMEOUT_MS));
        let mut join_set = JoinSet::new();

        for ip in ips {
            let dur = probe_timeout;
            join_set.spawn(async move {
                // Primero sondeamos FTP (puerto más común para el homebrew daemon)
                let ftp_open = DiscoveryService::probe_port(ip, PS5_FTP_PORT, dur).await;
                let dpi_open = DiscoveryService::probe_port(ip, PS5_DPI_PORT, dur).await;

                if ftp_open || dpi_open {
                    Some(DiscoveredPs5 {
                        ip: ip.to_string(),
                        ftp_open,
                        dpi_open,
                    })
                } else {
                    None
                }
            });
        }

        let mut results = Vec::new();
        while let Some(res) = join_set.join_next().await {
            if let Ok(Some(ps5)) = res {
                results.push(ps5);
            }
        }

        // Ordenamos por IP para salida determinista
        results.sort_by(|a, b| a.ip.cmp(&b.ip));
        results
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;

    #[test]
    fn test_subnet_generation_produces_254_ips() {
        let base = Ipv4Addr::new(192, 168, 1, 45);
        let ips = DiscoveryService::get_subnet_ips(base);
        assert_eq!(ips.len(), 254);
        assert_eq!(ips[0], Ipv4Addr::new(192, 168, 1, 1));
        assert_eq!(ips[253], Ipv4Addr::new(192, 168, 1, 254));
    }

    #[tokio::test]
    async fn test_probe_port_success_on_active_listener() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("Failed to bind ephemeral test listener");
        let local_port = listener.local_addr().unwrap().port();

        let is_open = DiscoveryService::probe_port(
            Ipv4Addr::new(127, 0, 0, 1),
            local_port,
            Duration::from_millis(100),
        )
        .await;

        assert!(is_open, "Probe debe detectar puerto local abierto");
    }

    #[tokio::test]
    async fn test_probe_port_fails_fast_on_closed_port() {
        // Reservamos un puerto y lo cerramos inmediatamente
        let listener = TcpListener::bind("127.0.0.1:0").expect("Failed to bind ephemeral test listener");
        let local_port = listener.local_addr().unwrap().port();
        drop(listener);

        let start = std::time::Instant::now();
        let is_open = DiscoveryService::probe_port(
            Ipv4Addr::new(127, 0, 0, 1),
            local_port,
            Duration::from_millis(50),
        )
        .await;

        assert!(!is_open, "Probe debe indicar que el puerto cerrado no responde");
        assert!(start.elapsed() < Duration::from_millis(500), "No debe demorarse en puerto cerrado");
    }

    #[test]
    fn test_detect_local_lan_ip_returns_valid_v4() {
        if let Some(ip) = DiscoveryService::detect_local_lan_ip() {
            assert!(!ip.is_unspecified());
            assert!(!ip.is_loopback());
        }
    }
}
