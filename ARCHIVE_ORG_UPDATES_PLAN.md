# Plan de Implementación: Búsqueda e Instalación de Updates desde Archive.org

## 1. Resumen de Decisiones (Alineación con el Usuario)
- **Disparador**: Búsqueda automática en segundo plano tras el escaneo FTP para títulos comerciales (CUSAxxxxx / PPSAxxxxx).
- **Flujo de Instalación**: Envío directo de la URL de descarga de Archive.org a etaHEN DPI (`:12800` / `:9090`) para evitar ocupar espacio innecesario en la PC.
- **Selector de Versiones**: Modal interactivo con todas las versiones encontradas, destacando la **Versión Recomendada** (la más alta compatible o con indicación de backport).
- **Alcance de Búsqueda**: Búsqueda flexible por Title ID + nombre del juego + `.pkg` en Archive.org, filtrando y extrayendo versiones semver mediante regex.

---

## 2. Componentes a Desarrollar

### Backend Rust (`src-tauri`)
1. **`src-tauri/src/modules/archive_org.rs`**:
   - `search_game_updates(title_id: &str, title_name: Option<&str>) -> Result<Vec<ArchiveOrgGameUpdate>, ToolyError>`
   - Query a `https://archive.org/advancedsearch.php` filtrando items que contengan el Title ID y archivos `.pkg`.
   - Consulta a `https://archive.org/metadata/{id}/files` para extraer nombres de archivo, tamaño, URLs de descarga y versiones deducidas (`v01.20`, etc.).
   - Detección de tags de compatibilidad (`[5.05]`, `[9.00]`, `[Backport]`, etc.).
2. **Comando Tauri IPC (`src-tauri/src/lib.rs`)**:
   - `#[tauri::command] search_archive_updates(title_id: String, title_name: Option<String>) -> Result<Vec<ArchiveOrgGameUpdate>, String>`
   - `#[tauri::command] install_archive_update_direct(ps5_ip: String, download_url: String, file_name: String) -> Result<DpiInstallResponse, String>`
3. **Tests TDD (`archive_org.rs`)**:
   - Test de parsing de respuestas reales de metadata de Archive.org.
   - Test de extracción de versión y Title ID por regex.

### Frontend React (`src`)
1. **`src/lib/types.ts` & `src/lib/tauri-client.ts`**:
   - Definición de tipos `ArchiveOrgGameUpdate`.
   - Enlace typed para `search_archive_updates` e `install_archive_update_direct`.
2. **Componente Modal Selector de Updates (`src/components/archive-updates-modal.tsx`)**:
   - Visualización de versiones encontradas con tamaño, fecha y tag de firmware.
   - Badge "Recomendado" en la versión óptima.
   - Botón "1-Click Install via DPI".
3. **Integración en `src/components/dashboard.tsx`**:
   - Búsqueda en background para juegos de PS4/PS5 detectados.
   - Badge o botón "Updates disponibles en Archive.org (X)" en la tarjeta del juego.

---

## 3. Verificación
- Ejecución de tests de Rust: `cargo test`
- Verificación de compilación del frontend: `pnpm build`
- Prueba con Title IDs reales (ej: `CUSA07104`, `CUSA03041`).
