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

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

#[derive(Debug, Clone)]
pub struct CacheEntry<T> {
    pub data: T,
    pub created_at: Instant,
    pub ttl: Duration,
}

impl<T> CacheEntry<T> {
    pub fn new(data: T, ttl: Duration) -> Self {
        Self {
            data,
            created_at: Instant::now(),
            ttl,
        }
    }

    pub fn is_expired(&self) -> bool {
        self.created_at.elapsed() >= self.ttl
    }
}

// Caché global en memoria con TTL configurable (por defecto 15 minutos)
fn get_global_cache() -> &'static Arc<RwLock<HashMap<String, CacheEntry<GitHubReleaseInfo>>>> {
    static CACHE: std::sync::OnceLock<Arc<RwLock<HashMap<String, CacheEntry<GitHubReleaseInfo>>>>> = std::sync::OnceLock::new();
    CACHE.get_or_init(|| Arc::new(RwLock::new(HashMap::new())))
}

pub struct GitHubClient;

impl GitHubClient {
    pub const DEFAULT_CACHE_TTL: Duration = Duration::from_secs(15 * 60); // 15 minutos

    /// Obtiene el release más reciente consultando primero la caché en memoria TTL
    pub async fn get_latest_release(repo: &str) -> Result<GitHubReleaseInfo, String> {
        // 1. Verificar si existe en caché y sigue fresco
        if let Some(cached) = Self::get_cached(repo).await {
            return Ok(cached);
        }

        // 2. Si no está en caché o expiró, solicitar a GitHub API
        let url = format!("https://api.github.com/repos/{}/releases/latest", repo);
        let client = reqwest::Client::builder()
            .user_agent("Tooly-PS5-Updater/0.1.0")
            .build()
            .map_err(|e| e.to_string())?;

        let res = client.get(&url).send().await.map_err(|e| format!("Fallo al conectar con GitHub: {}", e))?;

        if res.status() == reqwest::StatusCode::FORBIDDEN || res.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
            return Err("Rate limit de GitHub alcanzado (60 req/hora). Reintenta en unos minutos.".to_string());
        }

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

        let release_info = GitHubReleaseInfo {
            tag_name,
            name,
            body,
            published_at,
            assets,
        };

        // 3. Guardar en caché
        Self::insert_cache(repo, release_info.clone(), Self::DEFAULT_CACHE_TTL).await;

        Ok(release_info)
    }

    /// Guarda un release en la caché con un TTL específico
    pub async fn insert_cache(repo: &str, data: GitHubReleaseInfo, ttl: Duration) {
        let cache = get_global_cache();
        let mut lock = cache.write().await;
        lock.insert(repo.to_lowercase(), CacheEntry::new(data, ttl));
    }

    /// Obtiene un release de la caché si existe y no ha expirado
    pub async fn get_cached(repo: &str) -> Option<GitHubReleaseInfo> {
        let cache = get_global_cache();
        let lock = cache.read().await;
        if let Some(entry) = lock.get(&repo.to_lowercase()) {
            if !entry.is_expired() {
                return Some(entry.data.clone());
            }
        }
        None
    }

    /// Remueve una entrada de la caché
    pub async fn remove_from_cache(repo: &str) {
        let cache = get_global_cache();
        let mut lock = cache.write().await;
        lock.remove(&repo.to_lowercase());
    }

    /// Limpia por completo la caché de GitHub
    pub async fn clear_cache() {
        let cache = get_global_cache();
        let mut lock = cache.write().await;
        lock.clear();
    }

    /// Verifica actualizaciones para múltiples repositorios concurrentemente con límite de concurrencia
    pub async fn check_batch_updates(repos: Vec<String>, max_concurrency: usize) -> Vec<(String, Result<GitHubReleaseInfo, String>)> {
        use tokio::sync::Semaphore;
        let semaphore = Arc::new(Semaphore::new(max_concurrency.max(1)));
        let mut tasks = Vec::new();

        for repo in repos {
            let sem = semaphore.clone();
            tasks.push(tokio::spawn(async move {
                let _permit = sem.acquire().await;
                let res = Self::get_latest_release(&repo).await;
                (repo, res)
            }));
        }

        let mut results = Vec::new();
        for task in tasks {
            if let Ok(res) = task.await {
                results.push(res);
            }
        }
        results
    }

    /// Compara versión instalada vs versión en GitHub (remueve prefijos 'v')
    pub fn is_update_available(current: &str, latest: &str) -> bool {
        let clean_curr = current.trim_start_matches('v').trim_start_matches('V');
        let clean_lat = latest.trim_start_matches('v').trim_start_matches('V');
        clean_curr != clean_lat && !clean_lat.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn test_is_update_available() {
        assert!(GitHubClient::is_update_available("1.0", "1.1"));
        assert!(GitHubClient::is_update_available("v1.0", "v1.1"));
        assert!(!GitHubClient::is_update_available("1.0", "1.0"));
        assert!(!GitHubClient::is_update_available("v1.0", "1.0"));
    }

    #[test]
    fn test_cache_entry_ttl_freshness() {
        let release = GitHubReleaseInfo {
            tag_name: "v1.0.0".to_string(),
            name: Some("v1.0.0".to_string()),
            body: None,
            published_at: None,
            assets: Vec::new(),
        };

        let entry = CacheEntry::new(release.clone(), Duration::from_secs(60));
        assert!(!entry.is_expired(), "Recién creado no debe estar expirado");
        assert_eq!(entry.data.tag_name, "v1.0.0");

        let expired_entry = CacheEntry::new(release, Duration::from_millis(0));
        std::thread::sleep(Duration::from_millis(10));
        assert!(expired_entry.is_expired(), "Con TTL 0ms debe considerarse expirado");
    }

    #[tokio::test]
    async fn test_cache_storage_retrieval_and_invalidation() {
        let release = GitHubReleaseInfo {
            tag_name: "v2.5.0".to_string(),
            name: Some("Release 2.5.0".to_string()),
            body: None,
            published_at: None,
            assets: Vec::new(),
        };

        let repo = "test-owner/test-repo";
        GitHubClient::insert_cache(repo, release.clone(), Duration::from_secs(60)).await;

        let cached = GitHubClient::get_cached(repo).await;
        assert!(cached.is_some(), "Debe recuperar el release almacenado en caché");
        assert_eq!(cached.unwrap().tag_name, "v2.5.0");

        // Invalidar entrada individual
        GitHubClient::remove_from_cache(repo).await;
        assert!(GitHubClient::get_cached(repo).await.is_none(), "Entrada debe quedar eliminada");
    }

    #[tokio::test]
    async fn test_check_batch_updates_with_cached_results() {
        let release1 = GitHubReleaseInfo {
            tag_name: "v1.0.0".to_string(),
            name: Some("Batch App 1".to_string()),
            body: None,
            published_at: None,
            assets: Vec::new(),
        };

        let release2 = GitHubReleaseInfo {
            tag_name: "v2.0.0".to_string(),
            name: Some("Batch App 2".to_string()),
            body: None,
            published_at: None,
            assets: Vec::new(),
        };

        let repo_a = "batch-isolated-org/batch-isolated-repo-1";
        let repo_b = "batch-isolated-org/batch-isolated-repo-2";

        GitHubClient::insert_cache(repo_a, release1, Duration::from_secs(60)).await;
        GitHubClient::insert_cache(repo_b, release2, Duration::from_secs(60)).await;

        let repos = vec![repo_a.to_string(), repo_b.to_string()];
        let results = GitHubClient::check_batch_updates(repos, 2).await;

        assert_eq!(results.len(), 2);
        for (_repo, res) in results {
            assert!(res.is_ok(), "Los resultados cacheados deben retornar Ok");
        }
    }
}
