# 📚 Documentación de Tooly (Tooly Documentation)

Bienvenido a la documentación oficial de **Tooly**, el centro de control y actualización de homebrew y payloads para PlayStation 5.

---

## 🧭 Contenido

1. [Arquitectura del Sistema](architecture.md)
2. [Guía de Red y Puertos de la Consola](network-ports.md)
3. [Guía de Envío de Homebrews (Catalog)](../SUBMITTING_APPS.md)
4. [Capturas de Pantalla y Recursos Visuales](assets/)

---

## ⚡ Vista Rápida

- **Frontend**: React 19 + Tailwind CSS 4 + Vite
- **Backend**: Rust + Tokio + Tauri v2
- **Protocolos Clave**:
  - FTP (`:2121`) — Escaneo y lectura de cabeceras binarias `PARAM.SFO` y `param.json`.
  - DPI (`:12800` / `:9090`) — Instalación remota sin cables vía servidor HTTP efímero en Rust.
  - Releases — Sincronización en tiempo real contra la API de GitHub Releases.
