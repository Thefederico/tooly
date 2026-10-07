use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReleaseAsset {
    pub name: String,
    pub size: u64,
    pub browser_download_url: String,
    pub content_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitHubReleaseInfo {
    pub tag_name: String,
    pub name: Option<String>,
    pub body: Option<String>,
    pub published_at: Option<String>,
    pub assets: Vec<ReleaseAsset>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateCheckResult {
    pub repo: String,
    pub current_version: String,
    pub latest_version: String,
    pub has_update: bool,
    pub release: Option<GitHubReleaseInfo>,
    pub download_url: Option<String>,
}

pub struct GitHubClient;

impl GitHubClient {
    pub async fn get_latest_release(repo: &str) -> Result<GitHubReleaseInfo, String> {
        let url = format!("https://api.github.com/repos/{}/releases/latest", repo);
        let client = reqwest::Client::builder()
            .user_agent("Tooly-PS5-Updater/0.1.0")
            .build()
            .map_err(|e| e.to_string())?;

        let res = client.get(&url).send().await.map_err(|e| format!("Fallo al conectar con GitHub: {}", e))?;

        if !res.status().is_success() {
            return Err(format!("GitHub API retornó status: {}", res.status()));
        }

        let raw_json: serde_json::Value = res.json().await.map_err(|e| format!("Error decodificando respuesta JSON: {}", e))?;

        let tag_name = raw_json["tag_name"]
            .as_str()
            .ok_or_else(|| "No se encontró tag_name".to_string())?
            .to_string();

        let name = raw_json["name"].as_str().map(|s| s.to_string());
        let body = raw_json["body"].as_str().map(|s| s.to_string());
        let published_at = raw_json["published_at"].as_str().map(|s| s.to_string());

        let mut assets = Vec::new();
        if let Some(assets_arr) = raw_json["assets"].as_array() {
            for a in assets_arr {
                if let (Some(name), Some(url)) = (a["name"].as_str(), a["browser_download_url"].as_str()) {
                    let size = a["size"].as_u64().unwrap_or(0);
                    let content_type = a["content_type"].as_str().map(|s| s.to_string());
                    assets.push(ReleaseAsset {
                        name: name.to_string(),
                        size,
                        browser_download_url: url.to_string(),
                        content_type,
                    });
                }
            }
        }

        Ok(GitHubReleaseInfo {
            tag_name,
            name,
            body,
            published_at,
            assets,
        })
    }

    /// Compara versión instalada vs versión en GitHub (remueve prefijos 'v')
    pub fn is_update_available(current: &str, latest: &str) -> bool {
        let clean_curr = current.trim_start_matches('v').trim_start_matches('V');
        let clean_lat = latest.trim_start_matches('v').trim_start_matches('V');
        clean_curr != clean_lat && !clean_lat.is_empty()
    }
}
