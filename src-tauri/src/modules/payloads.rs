use serde::{Deserialize, Serialize};
use regex::Regex;
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct LocalPayload {
    pub file_name: String,
    pub full_path: String,
    pub detected_name: String,
    pub detected_version: Option<String>,
    pub file_size: u64,
    pub extension: String,
}

pub struct PayloadScanner;

impl PayloadScanner {
    /// Extrae versión y nombre a partir del nombre base de archivo
    pub fn parse_payload_filename(stem: &str) -> (String, Option<String>) {
        let ver_regex = Regex::new(r"(?i)[-_vV]?(\d+\.\d+([a-zA-Z0-9_\-\.]+)?)$").unwrap();

        let detected_version = ver_regex
            .captures(stem)
            .and_then(|caps| caps.get(1).map(|m| m.as_str().to_string()));

        let detected_name = stem
            .replace(['_', '-'], " ")
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");

        (detected_name, detected_version)
    }

    /// Escanea un directorio local o unidad USB en busca de payloads .bin y .elf
    pub fn scan_directory(dir_path: &str) -> Result<Vec<LocalPayload>, String> {
        let path = Path::new(dir_path);
        if !path.exists() || !path.is_dir() {
            return Err(format!("El directorio '{}' no existe o no es accesible", dir_path));
        }

        let mut payloads = Vec::new();
        let entries = fs::read_dir(path).map_err(|e| format!("Error leyendo directorio: {}", e))?;

        for entry in entries.flatten() {
            let file_path = entry.path();
            if file_path.is_file() {
                if let Some(ext) = file_path.extension().and_then(|e| e.to_str()) {
                    let ext_lower = ext.to_lowercase();
                    if ext_lower == "bin" || ext_lower == "elf" {
                        let file_name = file_path.file_name().unwrap().to_string_lossy().to_string();
                        let stem = file_path.file_stem().unwrap().to_string_lossy().to_string();
                        let meta = entry.metadata().map_err(|e| e.to_string())?;

                        let (detected_name, detected_version) = Self::parse_payload_filename(&stem);

                        payloads.push(LocalPayload {
                            file_name,
                            full_path: file_path.to_string_lossy().to_string(),
                            detected_name,
                            detected_version,
                            file_size: meta.len(),
                            extension: ext_lower,
                        });
                    }
                }
            }
        }

        Ok(payloads)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_payload_versions() {
        let (name1, ver1) = PayloadScanner::parse_payload_filename("etaHEN_2.0b");
        assert_eq!(ver1, Some("2.0b".to_string()));
        assert_eq!(name1, "etaHEN 2.0b");

        let (_, ver2) = PayloadScanner::parse_payload_filename("ps5-kstuff-v1.4");
        assert_eq!(ver2, Some("1.4".to_string()));

        let (_, ver3) = PayloadScanner::parse_payload_filename("payload_without_version");
        assert_eq!(ver3, None);
    }
}
