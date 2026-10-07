use serde::{Deserialize, Serialize};
use regex::Regex;
use std::sync::LazyLock;
use super::error::ToolyError;

static REGEX_VERSION: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)[vV]?(\d+\.\d+)").unwrap()
});

static REGEX_BACKPORT: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)(backport|fix|5\.05|6\.72|7\.02|7\.55|9\.00|mod)").unwrap()
});

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ArchiveOrgGameUpdate {
    pub identifier: String,
    pub file_name: String,
    pub title_id: String,
    pub version: String,
    pub download_url: String,
    pub size_bytes: Option<u64>,
    pub is_update: bool,
    pub is_backport: bool,
    pub is_recommended: bool,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ArchiveSearchResponse {
    response: ArchiveSearchBody,
}

#[derive(Debug, Deserialize)]
struct ArchiveSearchBody {
    docs: Vec<ArchiveSearchDoc>,
}

#[derive(Debug, Deserialize)]
struct ArchiveSearchDoc {
    identifier: String,
    title: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ArchiveMetadataFilesResponse {
    result: Vec<ArchiveFileItem>,
}

#[derive(Debug, Deserialize)]
struct ArchiveFileItem {
    name: String,
    size: Option<serde_json::Value>,
    format: Option<String>,
}

pub struct ArchiveOrgClient {
    client: reqwest::Client,
}

impl Default for ArchiveOrgClient {
    fn default() -> Self {
        Self::new()
    }
}

impl ArchiveOrgClient {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .user_agent("Tooly/0.1.0 (PS5-Homebrew-Updater)")
            .timeout(std::time::Duration::from_secs(12))
            .build()
            .unwrap_or_default();

        Self { client }
    }

    /// Parsea el nombre de un archivo .pkg para extraer semver y flags
    pub fn parse_pkg_filename(
        identifier: &str,
        file_name: &str,
        size_bytes: Option<u64>,
        target_title_id: &str,
        current_version: Option<&str>,
    ) -> Option<ArchiveOrgGameUpdate> {
        let lower_name = file_name.to_lowercase();
        if !lower_name.ends_with(".pkg") {
            return None;
        }

        let is_update = lower_name.contains("update") 
            || lower_name.contains("patch")
            || lower_name.contains("-a")
            || lower_name.contains("v1.")
            || lower_name.contains("v01.");

        let is_backport = REGEX_BACKPORT.is_match(file_name);

        // Extraer versión mediante regex
        let version = if let Some(caps) = REGEX_VERSION.captures(file_name) {
            caps.get(1).map(|m| m.as_str().to_string()).unwrap_or_else(|| "1.00".into())
        } else {
            "1.00".to_string()
        };

        // Formar URL de descarga directa
        let encoded_filename = file_name
            .split('/')
            .map(|seg| urlencoding::encode(seg).to_string())
            .collect::<Vec<String>>()
            .join("/");
        let download_url = format!("https://archive.org/download/{}/{}", identifier, encoded_filename);

        // Criterio de recomendación: es update y es versión superior
        let is_recommended = is_update && current_version.map_or(true, |cur| {
            let cur_clean = cur.trim_start_matches(['v', 'V']).trim();
            version.as_str() > cur_clean
        });

        Some(ArchiveOrgGameUpdate {
            identifier: identifier.to_string(),
            file_name: file_name.to_string(),
            title_id: target_title_id.to_uppercase(),
            version,
            download_url,
            size_bytes,
            is_update,
            is_backport,
            is_recommended,
            description: None,
        })
    }

    /// Busca paquetes .pkg y updates de un Title ID en Archive.org
    pub async fn search_updates(
        &self,
        title_id: &str,
        game_name: Option<&str>,
        current_version: Option<&str>,
    ) -> Result<Vec<ArchiveOrgGameUpdate>, ToolyError> {
        let clean_id = title_id.trim().to_uppercase();
        if clean_id.is_empty() {
            return Ok(Vec::new());
        }

        // 1. Construir query flexible en Archive.org
        let mut query = format!("(\"{clean_id}\" OR description:\"{clean_id}\")");
        if let Some(name) = game_name {
            let clean_name = name.replace(['\"', ':', '/'], " ").trim().to_string();
            if !clean_name.is_empty() {
                query.push_str(&format!(" OR \"{clean_name}\""));
            }
        }

        let search_url = format!(
            "https://archive.org/advancedsearch.php?q={}&fl[]=identifier,title&sort[]=downloads+desc&rows=8&output=json",
            urlencoding::encode(&query)
        );

        let search_res = self.client.get(&search_url).send().await
            .map_err(|e| ToolyError::GitHubError(format!("Error buscando en Archive.org: {e}")))?;

        if !search_res.status().is_success() {
            return Ok(Vec::new());
        }

        let search_data: ArchiveSearchResponse = search_res.json().await
            .map_err(|e| ToolyError::JsonParseError(format!("Error parseando resultados de Archive.org: {e}")))?;

        let mut all_updates = Vec::new();

        // 2. Para cada item encontrado, consultar sus archivos
        for doc in search_data.response.docs {
            let meta_url = format!("https://archive.org/metadata/{}/files", doc.identifier);
            if let Ok(meta_res) = self.client.get(&meta_url).send().await {
                if meta_res.status().is_success() {
                    if let Ok(meta_data) = meta_res.json::<ArchiveMetadataFilesResponse>().await {
                        for f in meta_data.result {
                            // Extraer tamaño si existe
                            let size_num = f.size.and_then(|v| {
                                if let Some(n) = v.as_u64() {
                                    Some(n)
                                } else if let Some(s) = v.as_str() {
                                    s.parse::<u64>().ok()
                                } else {
                                    None
                                }
                            });

                            if let Some(update) = Self::parse_pkg_filename(
                                &doc.identifier,
                                &f.name,
                                size_num,
                                &clean_id,
                                current_version,
                            ) {
                                all_updates.push(update);
                            }
                        }
                    }
                }
            }
        }

        // Ordenar: recomendados primero, luego por versión descendente
        all_updates.sort_by(|a, b| {
            b.is_recommended.cmp(&a.is_recommended)
                .then_with(|| b.version.cmp(&a.version))
        });

        Ok(all_updates)
    }
}

// Helper mínimo para urlencoding sin añadir nuevas crates pesadas
mod urlencoding {
    pub fn encode(data: &str) -> String {
        let mut encoded = String::new();
        for byte in data.bytes() {
            match byte {
                b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    encoded.push(byte as char);
                }
                _ => {
                    encoded.push_str(&format!("%{:02X}", byte));
                }
            }
        }
        encoded
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_pkg_filename_update_detection() {
        let fname = "Grand_Theft_Auto_V[CUSA00411][EU][v1.57][No_Mod_Menu][Update].pkg";
        let parsed = ArchiveOrgClient::parse_pkg_filename(
            "GTA5_PS4",
            fname,
            Some(52751958016),
            "CUSA00411",
            Some("1.00"),
        );

        assert!(parsed.is_some());
        let item = parsed.unwrap();
        assert_eq!(item.title_id, "CUSA00411");
        assert_eq!(item.version, "1.57");
        assert!(item.is_update);
        assert!(item.is_recommended);
        assert_eq!(item.size_bytes, Some(52751958016));
        assert!(item.download_url.contains("https://archive.org/download/GTA5_PS4/"));
    }

    #[test]
    fn test_parse_pkg_filename_backport_detection() {
        let fname = "Down the Rabbit Hole (CUSA17418) - 1.01 Update (Fix Game Info).pkg";
        let parsed = ArchiveOrgClient::parse_pkg_filename(
            "rabbit-hole",
            fname,
            Some(6094848),
            "CUSA17418",
            Some("1.00"),
        );

        assert!(parsed.is_some());
        let item = parsed.unwrap();
        assert_eq!(item.version, "1.01");
        assert!(item.is_update);
        assert!(item.is_backport); // Tiene "Fix"
    }

    #[test]
    fn test_ignores_non_pkg_files() {
        let fname = "readme.txt";
        let parsed = ArchiveOrgClient::parse_pkg_filename(
            "test_id",
            fname,
            None,
            "CUSA00001",
            None,
        );
        assert!(parsed.is_none());
    }
}
