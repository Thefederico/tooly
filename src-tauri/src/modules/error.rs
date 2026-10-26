use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", content = "message")]
pub enum ToolyError {
    SfoBufferTooSmall { len: usize },
    SfoInvalidMagic { found: [u8; 4] },
    SfoMalformedKeyTable,
    JsonParseError(String),
    FtpError(String),
    FtpTimeout { ip: String, port: u16, seconds: u64 },
    DpiError(String),
    GitHubError(String),
    ArchiveOrgError(String),
    PayloadInjectionError(String),
    InvalidInput(String),
    InternalError(String),
    IoError(String),
}

impl fmt::Display for ToolyError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::SfoBufferTooSmall { len } => {
                write!(f, "SFO buffer is too small ({} bytes, expected >= 20)", len)
            }
            Self::SfoInvalidMagic { found } => {
                write!(f, "Invalid SFO magic header: {:02X?}", found)
            }
            Self::SfoMalformedKeyTable => write!(f, "Malformed SFO key or data table offsets"),
            Self::JsonParseError(err) => write!(f, "Failed to parse param.json: {}", err),
            Self::FtpError(err) => write!(f, "PS5 FTP communication failed: {}", err),
            Self::FtpTimeout { ip, port, seconds } => {
                write!(
                    f,
                    "Tiempo de espera agotado ({seconds}s) conectando a PS5 FTP ({ip}:{port}). Verifica que la consola esté encendida y etaHEN/FTP activo."
                )
            }
            Self::DpiError(err) => write!(f, "DPI deployment failed: {}", err),
            Self::GitHubError(err) => write!(f, "GitHub API error: {}", err),
            Self::ArchiveOrgError(err) => write!(f, "Archive.org API error: {}", err),
            Self::PayloadInjectionError(err) => write!(f, "Error inyectando payload en PS5: {}", err),
            Self::InvalidInput(err) => write!(f, "Invalid input: {}", err),
            Self::InternalError(err) => write!(f, "Internal error: {}", err),
            Self::IoError(err) => write!(f, "I/O operation failed: {}", err),
        }
    }
}

impl std::error::Error for ToolyError {}

impl From<tokio::task::JoinError> for ToolyError {
    fn from(err: tokio::task::JoinError) -> Self {
        Self::InternalError(format!("Task spawn/join error: {}", err))
    }
}

impl From<ToolyError> for String {
    fn from(err: ToolyError) -> Self {
        err.to_string()
    }
}
