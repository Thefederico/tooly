use std::collections::HashMap;
use super::error::ToolyError;

/// Sony PARAM.SFO Binary PSF Parser
/// Specification:
/// - 0x00..0x04: Magic "\0PSF" (0x00, 0x50, 0x53, 0x46)
/// - 0x04..0x08: Version (e.g. 0x0101)
/// - 0x08..0x0C: Key Table Offset (u32 LE)
/// - 0x0C..0x10: Data Table Offset (u32 LE)
/// - 0x10..0x14: Number of Entries (u32 LE)
/// Entry descriptor (16 bytes each):
/// - 0x00..0x02: Key offset (u16 LE) relative to Key Table Offset
/// - 0x02..0x04: Param format (0x0204 = UTF-8, 0x0004 = UTF-8 special, 0x0404 = u32)
/// - 0x04..0x08: Param data length (u32 LE)
/// - 0x08..0x0C: Max length (u32 LE)
/// - 0x0C..0x10: Data offset (u32 LE) relative to Data Table Offset
pub struct SfoParser;

impl SfoParser {
    pub fn parse(bytes: &[u8]) -> Result<HashMap<String, String>, ToolyError> {
        if bytes.len() < 20 {
            return Err(ToolyError::SfoBufferTooSmall { len: bytes.len() });
        }

        // Check Magic "\0PSF"
        if bytes[0..4] != [0x00, 0x50, 0x53, 0x46] {
            let mut found = [0u8; 4];
            found.copy_from_slice(&bytes[0..4]);
            return Err(ToolyError::SfoInvalidMagic { found });
        }

        let key_table_offset = u32::from_le_bytes(bytes[8..12].try_into().unwrap()) as usize;
        let data_table_offset = u32::from_le_bytes(bytes[12..16].try_into().unwrap()) as usize;
        let num_entries = u32::from_le_bytes(bytes[16..20].try_into().unwrap()) as usize;

        if key_table_offset > bytes.len() || data_table_offset > bytes.len() {
            return Err(ToolyError::SfoMalformedKeyTable);
        }

        let mut entries = HashMap::with_capacity(num_entries);
        let mut index_ptr = 20;

        for _ in 0..num_entries {
            if index_ptr + 16 > bytes.len() {
                break;
            }

            let key_offset = u16::from_le_bytes(bytes[index_ptr..index_ptr + 2].try_into().unwrap()) as usize;
            let param_data_len = u32::from_le_bytes(bytes[index_ptr + 4..index_ptr + 8].try_into().unwrap()) as usize;
            let data_offset = u32::from_le_bytes(bytes[index_ptr + 12..index_ptr + 16].try_into().unwrap()) as usize;

            let abs_key = key_table_offset + key_offset;
            if abs_key < bytes.len() {
                let key_bytes: Vec<u8> = bytes[abs_key..]
                    .iter()
                    .take_while(|&&b| b != 0)
                    .copied()
                    .collect();
                if let Ok(key) = String::from_utf8(key_bytes) {
                    let abs_data = data_table_offset + data_offset;
                    if abs_data + param_data_len <= bytes.len() {
                        let val_slice = &bytes[abs_data..abs_data + param_data_len];
                        // Strip null padding
                        let clean_bytes: Vec<u8> = val_slice.iter().take_while(|&&b| b != 0).copied().collect();
                        let val = String::from_utf8_lossy(&clean_bytes).trim().to_string();
                        entries.insert(key, val);
                    }
                }
            }

            index_ptr += 16;
        }

        Ok(entries)
    }

    /// Parse PS5 native param.json format
    pub fn parse_json(bytes: &[u8]) -> Result<HashMap<String, String>, ToolyError> {
        let json_val: serde_json::Value = serde_json::from_slice(bytes)
            .map_err(|e| ToolyError::JsonParseError(e.to_string()))?;

        let mut map = HashMap::new();
        if let Some(obj) = json_val.as_object() {
            for (k, v) in obj {
                if let Some(s) = v.as_str() {
                    map.insert(k.clone(), s.to_string());
                } else if !v.is_null() && !v.is_object() && !v.is_array() {
                    map.insert(k.clone(), v.to_string());
                }
            }

            // PS5 param.json stores titleName inside localizedParameters:
            // "localizedParameters": {
            //     "defaultLanguage": "en-US",
            //     "en-US": { "titleName": "PS5SX2" },
            //     "es-ES": { "titleName": "..." }
            // }
            if !map.contains_key("titleName") {
                if let Some(loc_params) = obj.get("localizedParameters").and_then(|v| v.as_object()) {
                    let mut extracted_name = None;

                    // 1. Check defaultLanguage if specified
                    if let Some(default_lang) = loc_params.get("defaultLanguage").and_then(|d| d.as_str()) {
                        if let Some(lang_obj) = loc_params.get(default_lang).and_then(|l| l.as_object()) {
                            if let Some(t_name) = lang_obj.get("titleName").and_then(|n| n.as_str()) {
                                extracted_name = Some(t_name.to_string());
                            }
                        }
                    }

                    // 2. Fallback to common language keys (en-US, es-ES, etc.)
                    if extracted_name.is_none() {
                        for lang_key in &["en-US", "en", "es-ES", "es", "default"] {
                            if let Some(lang_obj) = loc_params.get(*lang_key).and_then(|l| l.as_object()) {
                                if let Some(t_name) = lang_obj.get("titleName").and_then(|n| n.as_str()) {
                                    extracted_name = Some(t_name.to_string());
                                    break;
                                }
                            }
                        }
                    }

                    // 3. Fallback to any child object that has titleName
                    if extracted_name.is_none() {
                        for (_lang_key, val) in loc_params {
                            if let Some(lang_obj) = val.as_object() {
                                if let Some(t_name) = lang_obj.get("titleName").and_then(|n| n.as_str()) {
                                    extracted_name = Some(t_name.to_string());
                                    break;
                                }
                            }
                        }
                    }

                    if let Some(name) = extracted_name {
                        map.insert("titleName".to_string(), name);
                    }
                }
            }
        }
        Ok(map)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sfo_buffer_too_small() {
        let small_buf = vec![0x00, 0x50, 0x53];
        let res = SfoParser::parse(&small_buf);
        assert_eq!(res, Err(ToolyError::SfoBufferTooSmall { len: 3 }));
    }

    #[test]
    fn test_sfo_invalid_magic() {
        let mut buf = vec![0u8; 32];
        buf[0..4].copy_from_slice(b"NOPE");
        let res = SfoParser::parse(&buf);
        assert_eq!(
            res,
            Err(ToolyError::SfoInvalidMagic {
                found: [b'N', b'O', b'P', b'E']
            })
        );
    }

    #[test]
    fn test_sfo_synthetic_valid_binary() {
        // Construct a genuine binary PSF structure with 2 entries:
        // Key 0: "TITLE_ID" -> Value: "ITEM00001"
        // Key 1: "APP_VER"  -> Value: "01.05"
        let mut buf = Vec::new();

        // 1. Header (20 bytes)
        buf.extend_from_slice(&[0x00, 0x50, 0x53, 0x46]); // Magic \0PSF
        buf.extend_from_slice(&[0x01, 0x01, 0x00, 0x00]); // Version 1.1

        let num_entries = 2u32;
        let index_table_len = (num_entries * 16) as usize;
        let key_table_offset = (20 + index_table_len) as u32;

        let key0 = b"TITLE_ID\0";
        let key1 = b"APP_VER\0";
        let key_table_len = key0.len() + key1.len();

        let data_table_offset = key_table_offset + key_table_len as u32;

        buf.extend_from_slice(&key_table_offset.to_le_bytes());
        buf.extend_from_slice(&data_table_offset.to_le_bytes());
        buf.extend_from_slice(&num_entries.to_le_bytes());

        // 2. Index Entries (16 bytes each)
        let val0 = b"ITEM00001\0";
        let val1 = b"01.05\0";

        // Entry 0: TITLE_ID
        buf.extend_from_slice(&0u16.to_le_bytes()); // key_offset: 0
        buf.extend_from_slice(&[0x04, 0x02]); // param_fmt UTF-8
        buf.extend_from_slice(&(val0.len() as u32).to_le_bytes()); // param_data_len
        buf.extend_from_slice(&(val0.len() as u32).to_le_bytes()); // param_max_len
        buf.extend_from_slice(&0u32.to_le_bytes()); // data_offset: 0

        // Entry 1: APP_VER
        let key1_offset = key0.len() as u16;
        let val1_offset = val0.len() as u32;
        buf.extend_from_slice(&key1_offset.to_le_bytes()); // key_offset
        buf.extend_from_slice(&[0x04, 0x02]); // param_fmt UTF-8
        buf.extend_from_slice(&(val1.len() as u32).to_le_bytes()); // param_data_len
        buf.extend_from_slice(&(val1.len() as u32).to_le_bytes()); // param_max_len
        buf.extend_from_slice(&val1_offset.to_le_bytes()); // data_offset

        // 3. Key Table
        buf.extend_from_slice(key0);
        buf.extend_from_slice(key1);

        // 4. Data Table
        buf.extend_from_slice(val0);
        buf.extend_from_slice(val1);

        let parsed = SfoParser::parse(&buf).expect("Debe parsear SFO sintético válido");
        assert_eq!(parsed.get("TITLE_ID").map(|s| s.as_str()), Some("ITEM00001"));
        assert_eq!(parsed.get("APP_VER").map(|s| s.as_str()), Some("01.05"));
    }

    #[test]
    fn test_param_json_valid_and_invalid() {
        let valid_json = br#"{"titleId":"PPSA01234","contentVersion":"02.00","titleName":"Test App"}"#;
        let map = SfoParser::parse_json(valid_json).expect("Debe parsear JSON");
        assert_eq!(map.get("titleId").map(|s| s.as_str()), Some("PPSA01234"));
        assert_eq!(map.get("contentVersion").map(|s| s.as_str()), Some("02.00"));
        assert_eq!(map.get("titleName").map(|s| s.as_str()), Some("Test App"));

        let invalid_json = b"not a json";
        let err = SfoParser::parse_json(invalid_json);
        assert!(matches!(err, Err(ToolyError::JsonParseError(_))));
    }

    #[test]
    fn test_param_json_localized_parameters() {
        let ps5_json = br#"{
            "titleId": "PPSA99203",
            "contentVersion": "01.00",
            "localizedParameters": {
                "defaultLanguage": "en-US",
                "en-US": {
                    "titleName": "PS5SX2"
                }
            }
        }"#;

        let map = SfoParser::parse_json(ps5_json).expect("Debe parsear JSON con localizedParameters");
        assert_eq!(map.get("titleId").map(|s| s.as_str()), Some("PPSA99203"));
        assert_eq!(map.get("contentVersion").map(|s| s.as_str()), Some("01.00"));
        assert_eq!(map.get("titleName").map(|s| s.as_str()), Some("PS5SX2"));
    }
}
