use serde::{Deserialize, Serialize};

pub const TOOLY_CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");
pub const TOOLY_DEFAULT_REPO: &str = "Thefederico/tooly";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AppUpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub has_update: bool,
    pub release_notes: Option<String>,
    pub published_at: Option<String>,
    pub download_url: Option<String>,
    pub asset_name: Option<String>,
    pub html_url: Option<String>,
}

pub struct SelfUpdateService;

impl SelfUpdateService {
    /// Limpia un string de versión quitando prefijos 'v'/'V', espacios y caracteres no deseados
    pub fn clean_version_tag(tag: &str) -> String {
        tag.trim()
            .trim_start_matches(|c| c == 'v' || c == 'V')
            .to_string()
    }

    /// Compara semánticamente (mayor que) si `latest` es una versión posterior a `current`
    pub fn is_newer_version(current: &str, latest: &str) -> bool {
        let curr_clean = Self::clean_version_tag(current);
        let lat_clean = Self::clean_version_tag(latest);

        if curr_clean.is_empty() || lat_clean.is_empty() {
            return false;
        }

        let curr_parts: Vec<u64> = curr_clean
            .split('.')
            .filter_map(|p| p.split('-').next().and_then(|num| num.parse().ok()))
            .collect();

        let lat_parts: Vec<u64> = lat_clean
            .split('.')
            .filter_map(|p| p.split('-').next().and_then(|num| num.parse().ok()))
            .collect();

        let max_len = curr_parts.len().max(lat_parts.len());
        for i in 0..max_len {
            let c = curr_parts.get(i).copied().unwrap_or(0);
            let l = lat_parts.get(i).copied().unwrap_or(0);
            if l > c {
                return true;
            } else if l < c {
                return false;
            }
        }

        false
    }

    /// Determina la extensión de binario adecuada según la plataforma operativa compilada
    pub fn get_platform_asset_hint() -> (&'static str, &'static str) {
        #[cfg(target_os = "macos")]
        {
            ("dmg", "app")
        }
        #[cfg(target_os = "windows")]
        {
            ("exe", "msi")
        }
        #[cfg(target_os = "linux")]
        {
            ("AppImage", "deb")
        }
        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        {
            ("tar.gz", "zip")
        }
    }

    /// Comprueba actualizaciones de Tooly contra el repositorio configurado
    pub async fn check_for_updates(repo_override: Option<&str>) -> Result<AppUpdateInfo, String> {
        let repo = repo_override.unwrap_or(TOOLY_DEFAULT_REPO);
        let url = format!("https://api.github.com/repos/{}/releases/latest", repo);

        let client = reqwest::Client::builder()
            .user_agent(format!("Tooly-Desktop/{}", TOOLY_CURRENT_VERSION))
            .build()
            .map_err(|e| e.to_string())?;

        let res = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Error conectando a GitHub para Tooly update: {e}"))?;

        if !res.status().is_success() {
            return Err(format!("GitHub API retornó status: {}", res.status()));
        }

        let raw: serde_json::Value = res
            .json()
            .await
            .map_err(|e| format!("Error parseando release de Tooly: {e}"))?;

        let tag_name = raw["tag_name"]
            .as_str()
            .ok_or_else(|| "El release no contiene 'tag_name'".to_string())?
            .to_string();

        let release_notes = raw["body"].as_str().map(|s| s.to_string());
        let published_at = raw["published_at"].as_str().map(|s| s.to_string());
        let html_url = raw["html_url"].as_str().map(|s| s.to_string());

        let (ext1, ext2) = Self::get_platform_asset_hint();
        let mut download_url = None;
        let mut asset_name = None;

        if let Some(assets) = raw["assets"].as_array() {
            for a in assets {
                if let (Some(name), Some(url)) = (a["name"].as_str(), a["browser_download_url"].as_str()) {
                    let lower = name.to_lowercase();
                    if lower.ends_with(ext1) || lower.ends_with(ext2) {
                        download_url = Some(url.to_string());
                        asset_name = Some(name.to_string());
                        break;
                    }
                }
            }
        }

        let has_update = Self::is_newer_version(TOOLY_CURRENT_VERSION, &tag_name);

        Ok(AppUpdateInfo {
            current_version: TOOLY_CURRENT_VERSION.to_string(),
            latest_version: tag_name,
            has_update,
            release_notes,
            published_at,
            download_url,
            asset_name,
            html_url,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_version_tag() {
        assert_eq!(SelfUpdateService::clean_version_tag("v0.2.0"), "0.2.0");
        assert_eq!(SelfUpdateService::clean_version_tag("V1.0.5 "), "1.0.5");
        assert_eq!(SelfUpdateService::clean_version_tag("0.1.0"), "0.1.0");
    }

    #[test]
    fn test_is_newer_version_detection() {
        // Mayores
        assert!(SelfUpdateService::is_newer_version("0.1.0", "0.2.0"));
        assert!(SelfUpdateService::is_newer_version("0.1.0", "1.0.0"));
        assert!(SelfUpdateService::is_newer_version("0.1.0", "0.1.1"));
        assert!(SelfUpdateService::is_newer_version("v0.1.0", "v0.1.1"));

        // Iguales
        assert!(!SelfUpdateService::is_newer_version("0.1.0", "0.1.0"));
        assert!(!SelfUpdateService::is_newer_version("v0.1.0", "0.1.0"));

        // Menores
        assert!(!SelfUpdateService::is_newer_version("0.2.0", "0.1.0"));
        assert!(!SelfUpdateService::is_newer_version("1.0.0", "0.9.9"));
    }

    #[test]
    fn test_platform_asset_hint_returns_valid_extensions() {
        let (e1, e2) = SelfUpdateService::get_platform_asset_hint();
        assert!(!e1.is_empty());
        assert!(!e2.is_empty());
    }

    #[test]
    fn test_default_repo_is_thefederico_tooly() {
        assert_eq!(TOOLY_DEFAULT_REPO, "Thefederico/tooly");
    }

    #[test]
    fn test_app_update_info_serialization() {
        let info = AppUpdateInfo {
            current_version: "0.1.0".to_string(),
            latest_version: "0.2.0".to_string(),
            has_update: true,
            release_notes: Some("Changelog test".to_string()),
            published_at: Some("2026-10-07T00:00:00Z".to_string()),
            download_url: Some("https://example.com/tooly.dmg".to_string()),
            asset_name: Some("tooly-0.2.0.dmg".to_string()),
            html_url: Some("https://github.com/Thefederico/tooly/releases/v0.2.0".to_string()),
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("0.2.0"));
        assert!(json.contains("has_update\":true"));
    }
}
