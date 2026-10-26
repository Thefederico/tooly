# 🌐 Puertos de Red y Conectividad con PlayStation 5

Tooly se comunica directamente con los daemons y servicios activos en la PlayStation 5 en la misma red local (LAN).

---

## 🔌 Matriz de Puertos y Protocolos

| Puerto | Protocolo | Servicio / Daemon | Función en Tooly |
|:---:|:---:|---|---|
| **`2121`** | FTP | Daemon FTP (etaHEN / FTPSrv) | Lee metadata de `/user/app/` y `/data/homebrew/` en streaming binario; sube payloads a `/data/pldmgr/payloads/`. |
| **`12800`** | HTTP (REST) | etaHEN Direct Package Installer | Envía órdenes de instalación de PKGs indicando la URL local del servidor HTTP de Tooly. |
| **`9090`** | TCP Socket | etaHEN Socket Server | Puerto alternativo para comandos JSON directos hacia etaHEN. |
| **`8844`** | HTTP | PKG-Manager Web Daemon | Servidor web interno de gestión de paquetes PKG en la consola. |
| **`8888`** | HTTP | WebFileManager | Servidor de archivos web para administración remota. |
| **`10101`** | HTTP | ShadowMount+ Web Server | Interfaz web de montaje de directorios e imágenes virtuales. |

---

## ⚡ Flujo de Instalación por Direct Package Installer (DPI)

1. **Detección**: Tooly detecta la versión instalada y la compara con la última release en GitHub.
2. **Descarga**: Tooly descarga el archivo `.pkg` a la máquina local del usuario.
3. **Servidor Efímero**: Se activa un servidor HTTP en Rust (`axum`) en un puerto local dinámico de la PC.
4. **Disparo DPI**: Se envía una petición HTTP a `http://<PS5_IP>:12800/api/install` con la URL local de la PC.
5. **Descarga en Consola**: La PS5 descarga el PKG directamente a través de la red local a máxima velocidad gigabit.
