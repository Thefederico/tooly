use serde::{Deserialize, Serialize};
use suppaftp::FtpStream;
use std::io::Read;
use std::net::{SocketAddr, ToSocketAddrs};
use std::time::Duration;
use super::error::ToolyError;
use super::sfo::SfoParser;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct InstalledApp {
    pub title_id: String,
    pub app_name: Option<String>,
    pub app_ver: String,
    pub path: String,
    pub icon_base64: Option<String>,
}

pub struct FtpScanner;

impl FtpScanner {
    pub const DEFAULT_TIMEOUT_SECS: u64 = 4;

    /// Resuelve la dirección y establece conexión con timeout estricto a nivel de socket
    pub fn connect_with_timeout(
        ip: &str,
        port: u16,
        timeout: Duration,
    ) -> Result<FtpStream, ToolyError> {
        let addr_str = format!("{}:{}", ip, port);
        let socket_addr: SocketAddr = addr_str
            .to_socket_addrs()
            .map_err(|e| ToolyError::FtpError(format!("Dirección inválida ({addr_str}): {e}")))?
            .next()
            .ok_or_else(|| ToolyError::FtpError(format!("No se pudo resolver la dirección {addr_str}")))?;

        FtpStream::connect_timeout(socket_addr, timeout).map_err(|e| {
            let err_str = e.to_string();
            if err_str.contains("timed out") || err_str.contains("os error 60") || err_str.contains("os error 110") {
                ToolyError::FtpTimeout {
                    ip: ip.to_string(),
                    port,
                    seconds: timeout.as_secs(),
                }
            } else {
                ToolyError::FtpError(format!("Error conectando a PS5 FTP ({addr_str}): {e}"))
            }
        })
    }

    /// Escanea las carpetas de aplicaciones en la PS5 (/user/app/ y /data/)
    /// con timeout rápido configurable (default 4 segundos)
    pub fn scan_ps5(ip: &str, port: u16, timeout_secs: Option<u64>) -> Result<Vec<InstalledApp>, ToolyError> {
        let timeout = Duration::from_secs(timeout_secs.unwrap_or(Self::DEFAULT_TIMEOUT_SECS));
        let mut ftp = Self::connect_with_timeout(ip, port, timeout)?;

        ftp.login("anonymous", "tooly@ps5")
            .map_err(|e| ToolyError::FtpError(format!("Fallo de autenticación FTP: {e}")))?;

        let mut installed_apps = Vec::new();
        let scan_paths = vec!["/user/app", "/data/homebrew", "/data/app"];

        for base_path in scan_paths {
            if let Ok(entries) = ftp.list(Some(base_path)) {
                for line in entries {
                    if let Some(folder_name) = Self::extract_folder_name(&line) {
                        let app_dir = format!("{}/{}", base_path, folder_name);

                        // 1. Intentar sce_sys/param.sfo
                        let sfo_path = format!("{}/sce_sys/param.sfo", app_dir);
                        if let Ok(mut cursor) = ftp.retr_as_buffer(&sfo_path) {
                            let mut buffer = Vec::new();
                            if cursor.read_to_end(&mut buffer).is_ok() {
                                if let Ok(sfo_map) = SfoParser::parse(&buffer) {
                                    let title_id = sfo_map
                                        .get("TITLE_ID")
                                        .cloned()
                                        .unwrap_or_else(|| folder_name.clone());
                                    let app_ver = sfo_map
                                        .get("APP_VER")
                                        .cloned()
                                        .unwrap_or_else(|| "1.00".into());
                                    let app_name = sfo_map.get("TITLE").cloned();

                                    installed_apps.push(InstalledApp {
                                        title_id,
                                        app_name,
                                        app_ver,
                                        path: app_dir.clone(),
                                        icon_base64: None,
                                    });
                                    continue;
                                }
                            }
                        }

                        // 2. Fallback a sce_sys/param.json
                        let json_path = format!("{}/sce_sys/param.json", app_dir);
                        if let Ok(mut cursor) = ftp.retr_as_buffer(&json_path) {
                            let mut buffer = Vec::new();
                            if cursor.read_to_end(&mut buffer).is_ok() {
                                if let Ok(json_map) = SfoParser::parse_json(&buffer) {
                                    let title_id = json_map
                                        .get("titleId")
                                        .cloned()
                                        .unwrap_or_else(|| folder_name.clone());
                                    let app_ver = json_map
                                        .get("contentVersion")
                                        .or_else(|| json_map.get("version"))
                                        .cloned()
                                        .unwrap_or_else(|| "1.00".into());
                                    let app_name = json_map.get("titleName").cloned();

                                    installed_apps.push(InstalledApp {
                                        title_id,
                                        app_name,
                                        app_ver,
                                        path: app_dir,
                                        icon_base64: None,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        // 3. Escaneo de Payloads instalados en Payload Manager (/data/pldmgr/payloads)
        let pldmgr_base = "/data/pldmgr/payloads";
        if let Ok(pld_entries) = ftp.list(Some(pldmgr_base)) {
            for line in pld_entries {
                if let Some(folder_name) = Self::extract_folder_name(&line) {
                    let folder_path = format!("{}/{}", pldmgr_base, folder_name);
                    // Buscar archivos en esta carpeta de payload
                    if let Ok(files) = ftp.list(Some(&folder_path)) {
                        let mut json_metadata_files: Vec<String> = Vec::new();
                        let mut payload_binaries: Vec<String> = Vec::new();

                        for fline in files {
                            if let Some(fname) = Self::extract_folder_name(&fline) {
                                if fname.ends_with(".elf.json") || fname.ends_with(".bin.json") || fname.ends_with(".json") {
                                    json_metadata_files.push(format!("{}/{}", folder_path, fname));
                                } else if fname.ends_with(".elf") || fname.ends_with(".bin") {
                                    payload_binaries.push(fname);
                                }
                            }
                        }

                        // Si hay varios binarios (ej: anterior y nuevo), ordenarlos para tomar el más reciente
                        payload_binaries.sort();

                        // Buscar metadata correspondiente
                        let mut parsed_meta: Option<(String, String)> = None;
                        for meta_path in json_metadata_files {
                            if let Ok(mut cursor) = ftp.retr_as_buffer(&meta_path) {
                                let mut buffer = Vec::new();
                                if cursor.read_to_end(&mut buffer).is_ok() {
                                    if let Ok(val) = serde_json::from_slice::<serde_json::Value>(&buffer) {
                                        let name = val.get("name")
                                            .and_then(|v| v.as_str())
                                            .map(|s| s.to_string())
                                            .unwrap_or_else(|| folder_name.clone());

                                        let ver = val.get("version")
                                            .and_then(|v| v.as_str())
                                            .map(|s| s.to_string())
                                            .filter(|s| !s.is_empty())
                                            .unwrap_or_else(|| "1.00".into());

                                        parsed_meta = Some((name, ver));
                                        break;
                                    }
                                }
                            }
                        }

                        let newest_bin = payload_binaries.last();
                        let has_info = newest_bin.is_some() || parsed_meta.is_some();

                        // Si el nombre del binario tiene versión más alta que el json, extraer versión del binario
                        let (final_name, final_ver) = if let Some((mname, mver)) = parsed_meta {
                            let mut ver = mver;
                            if let Some(bin) = newest_bin {
                                if let Some(caps) = regex::Regex::new(r"(?i)[vV]?(\d+\.\d+)").unwrap().captures(bin) {
                                    if let Some(extracted) = caps.get(1) {
                                        let bin_ver = extracted.as_str();
                                        if bin_ver > ver.as_str() {
                                            ver = bin_ver.to_string();
                                        }
                                    }
                                }
                            }
                            (mname, ver)
                        } else if let Some(bin) = newest_bin {
                            let ver = if let Some(caps) = regex::Regex::new(r"(?i)[vV]?(\d+\.\d+)").unwrap().captures(bin) {
                                caps.get(1).map(|m| m.as_str().to_string()).unwrap_or_else(|| "1.00".into())
                            } else {
                                "1.00".into()
                            };
                            (folder_name.clone(), ver)
                        } else {
                            (folder_name.clone(), "1.00".into())
                        };

                        if has_info {
                            let binary_title_id = format!("PAYLOAD_{}", folder_name.to_uppercase().replace('-', "_"));
                            installed_apps.push(InstalledApp {
                                title_id: binary_title_id,
                                app_name: Some(final_name),
                                app_ver: final_ver,
                                path: folder_path.clone(),
                                icon_base64: None,
                            });
                        }
                    }
                }
            }
        }

        let _ = ftp.quit();

        // 1. Deduplicar por TITLE_ID exacto (priorizando las que tienen app_name)
        let mut deduplicated_by_id: Vec<InstalledApp> = Vec::new();
        for app in installed_apps {
            if let Some(existing) = deduplicated_by_id.iter_mut().find(|a| a.title_id.eq_ignore_ascii_case(&app.title_id)) {
                if existing.app_name.is_none() && app.app_name.is_some() {
                    *existing = app;
                }
            } else {
                deduplicated_by_id.push(app);
            }
        }

        // 2. Fusionar lanzadores web (/user/app) con sus daemons/payloads (/data/pldmgr/payloads)
        // Mapeo conocido de lanzadores PKG a sus carpetas de payload correspondientes
        let launcher_payload_links: &[(&str, &str)] = &[
            ("FMGR88888", "PAYLOAD_PS5_WEB_FILE_MANAGER"),
            ("FAKE10101", "PAYLOAD_SHADOWMOUNTPLUS"),
            ("PKGM00001", "PAYLOAD_PKG_MANAGER"),
        ];

        let mut merged_apps: Vec<InstalledApp> = Vec::new();
        let mut consumed_payload_ids: std::collections::HashSet<String> = std::collections::HashSet::new();

        for link in launcher_payload_links {
            let (launcher_id, payload_id) = *link;
            if let Some(payload_app) = deduplicated_by_id.iter().find(|a| a.title_id.eq_ignore_ascii_case(payload_id)) {
                if let Some(launcher_app) = deduplicated_by_id.iter().find(|a| a.title_id.eq_ignore_ascii_case(launcher_id)) {
                    // Hay un lanzador y un payload simultáneos:
                    // Preservar el launcher (nombre y TITLE_ID visibles en el menú de la consola),
                    // pero usar la ruta del payload y la versión real del payload binario.
                    let mut unified = launcher_app.clone();
                    if payload_app.app_ver != "1.00" && !payload_app.app_ver.is_empty() {
                        unified.app_ver = payload_app.app_ver.clone();
                    }
                    unified.path = payload_app.path.clone();
                    merged_apps.push(unified);
                    consumed_payload_ids.insert(payload_id.to_uppercase());
                    consumed_payload_ids.insert(launcher_id.to_uppercase());
                }
            }
        }

        // Agregar las demás aplicaciones que no fueron fusionadas
        for app in deduplicated_by_id {
            if !consumed_payload_ids.contains(&app.title_id.to_uppercase()) {
                merged_apps.push(app);
            }
        }

        Ok(merged_apps)
    }

    pub fn extract_folder_name(line: &str) -> Option<String> {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.is_empty() {
            return None;
        }
        let last = parts.last()?.trim();
        if last == "." || last == ".." {
            return None;
        }
        Some(last.to_string())
    }

    /// Descarga un payload (.bin o .elf) y lo transfiere directamente por FTP a la carpeta de la PS5
    /// actualizando también su archivo .json de metadatos si existe.
    pub async fn update_remote_payload(
        ip: &str,
        port: u16,
        target_folder: &str,
        download_url: &str,
        new_filename: &str,
        new_version: &str,
    ) -> Result<String, ToolyError> {
        // Descargar el binario asíncronamente con reqwest
        let resp = reqwest::Client::builder()
            .user_agent("Tooly/0.1.0")
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| ToolyError::IoError(e.to_string()))?
            .get(download_url)
            .send()
            .await
            .map_err(|e| ToolyError::IoError(format!("Error descargando payload: {e}")))?;

        if !resp.status().is_success() {
            return Err(ToolyError::IoError(format!("Fallo descarga con status {}", resp.status())));
        }

        let bytes = resp.bytes().await.map_err(|e| ToolyError::IoError(e.to_string()))?.to_vec();

        let ip_owned = ip.to_string();
        let target_folder_owned = target_folder.to_string();
        let new_filename_owned = new_filename.to_string();
        let new_version_owned = new_version.to_string();

        tokio::task::spawn_blocking(move || {
            let timeout = Duration::from_secs(Self::DEFAULT_TIMEOUT_SECS);
            let mut ftp = Self::connect_with_timeout(&ip_owned, port, timeout)?;

            ftp.login("anonymous", "tooly@ps5")
                .map_err(|e| ToolyError::FtpError(format!("Fallo de autenticación FTP: {e}")))?;

            // 1. Obtener lista de archivos existentes en la carpeta de la PS5
            let mut existing_files: Vec<String> = Vec::new();
            if let Ok(dir_entries) = ftp.list(Some(&target_folder_owned)) {
                for line in dir_entries {
                    if let Some(fname) = Self::extract_folder_name(&line) {
                        existing_files.push(fname);
                    }
                }
            }

            // 2. Localizar y leer el archivo .json de metadatos existente antes de borrar
            let mut existing_json_name = None;
            let mut existing_json_content = None;

            for fname in &existing_files {
                if fname.ends_with(".elf.json") || fname.ends_with(".bin.json") || fname.ends_with(".json") {
                    let remote_json = format!("{}/{}", target_folder_owned, fname);
                    if let Ok(mut c) = ftp.retr_as_buffer(&remote_json) {
                        let mut buf = Vec::new();
                        if c.read_to_end(&mut buf).is_ok() {
                            existing_json_name = Some(fname.clone());
                            existing_json_content = Some(buf);
                            break;
                        }
                    }
                }
            }

            // 3. Subir el nuevo binario
            let mut reader = std::io::Cursor::new(&bytes);
            let remote_dest = format!("{}/{}", target_folder_owned, new_filename_owned);
            ftp.put_file(&remote_dest, &mut reader)
                .map_err(|e| ToolyError::FtpError(format!("Error subiendo payload por FTP: {e}")))?;

            // 4. Actualizar o crear el archivo .json con el nuevo nombre y versión
            let clean_ver = new_version_owned.trim_start_matches(['v', 'V']).to_string();
            let new_json_name = format!("{}.json", new_filename_owned);
            let new_json_path = format!("{}/{}", target_folder_owned, new_json_name);

            let mut meta_val = if let Some(buf) = existing_json_content {
                serde_json::from_slice::<serde_json::Value>(&buf).unwrap_or(serde_json::json!({}))
            } else {
                serde_json::json!({})
            };

            if let Some(obj) = meta_val.as_object_mut() {
                obj.insert("version".to_string(), serde_json::Value::String(clean_ver.clone()));
                obj.insert("filename".to_string(), serde_json::Value::String(new_filename_owned.clone()));
            }

            if let Ok(updated_bytes) = serde_json::to_vec_pretty(&meta_val) {
                let mut meta_reader = std::io::Cursor::new(updated_bytes);
                let _ = ftp.put_file(&new_json_path, &mut meta_reader);
            }

            // 5. Eliminar el archivo .json anterior si tenía nombre diferente
            if let Some(old_jname) = existing_json_name {
                if old_jname != new_json_name {
                    let old_jpath = format!("{}/{}", target_folder_owned, old_jname);
                    let _ = ftp.rm(&old_jpath);
                }
            }

            // 6. Eliminar binarios antiguos para no dejar archivos duplicados
            for fname in existing_files {
                if (fname.ends_with(".elf") || fname.ends_with(".bin")) && fname != new_filename_owned {
                    let old_bin_path = format!("{}/{}", target_folder_owned, fname);
                    let _ = ftp.rm(&old_bin_path);
                }
            }

            let _ = ftp.quit();
            Ok(format!("Payload {} actualizado con éxito a versión {}", new_filename_owned, clean_ver))
        })
        .await
        .map_err(|e| ToolyError::IoError(e.to_string()))?
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_folder_name_unix_ls() {
        let line = "drwxr-xr-x  2 ftp ftp 4096 Oct 07 00:00 ITEM00001";
        assert_eq!(
            FtpScanner::extract_folder_name(line),
            Some("ITEM00001".to_string())
        );

        let dot_line = "drwxr-xr-x  2 ftp ftp 4096 Oct 07 00:00 .";
        assert_eq!(FtpScanner::extract_folder_name(dot_line), None);

        let dot_dot_line = "drwxr-xr-x  2 ftp ftp 4096 Oct 07 00:00 ..";
        assert_eq!(FtpScanner::extract_folder_name(dot_dot_line), None);

        let empty = "";
        assert_eq!(FtpScanner::extract_folder_name(empty), None);
    }

    #[test]
    fn test_connect_with_timeout_fails_fast_on_unreachable_ip() {
        // IP no enrutable del rango TEST-NET-1 (RFC 5737)
        let unreachable_ip = "192.0.2.1";
        let timeout = Duration::from_millis(400); // 400ms para test rápido

        let start = std::time::Instant::now();
        let result = FtpScanner::connect_with_timeout(unreachable_ip, 2121, timeout);
        let elapsed = start.elapsed();

        match result {
            Err(err) => {
                assert!(
                    matches!(err, ToolyError::FtpTimeout { .. } | ToolyError::FtpError(_)),
                    "Debe retornar error tipado de FTP/Timeout, obtuvo: {:?}",
                    err
                );
            }
            Ok(_) => panic!("Expected connection failure to unreachable IP"),
        }
        // Debe fallar en ~400ms y NUNCA superar 1.5s
        assert!(
            elapsed < Duration::from_secs(2),
            "La llamada tardó demasiado ({:?}), el timeout no está siendo respetado",
            elapsed
        );
    }
}
