#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Tooly — PS5 On-Console Daemon (.elf) Build Script
# Targets: PlayStation 5 (Prospero OS / FreeBSD 12 derivative)
# Standard: Standalone ELF payload (0x02) listening on port :8888
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TAURI_DIR="${ROOT_DIR}/src-tauri"
DIST_DIR="${ROOT_DIR}/dist"
OUTPUT_DIR="${ROOT_DIR}/build-ps5"

echo "🎮 [1/4] Compilando Frontend Unificado (Vite + React 19)..."
cd "${ROOT_DIR}"
pnpm build

if [ ! -d "${DIST_DIR}" ]; then
    echo "❌ Error: dist/ directory not found after building frontend."
    exit 1
fi
echo "✅ Frontend web listo en ${DIST_DIR}"

echo "🦀 [2/4] Verificando compilador de Rust para el target daemon..."
cd "${TAURI_DIR}"

# Comprobación de target: si se solicita FreeBSD/PS5 o compilación nativa/local
TARGET="${1:-x86_64-unknown-freebsd}"

if rustup target list | grep -q "${TARGET} (installed)"; then
    echo "📦 Compilando release estático para ${TARGET}..."
    cargo build --release --bin tooly-daemon --no-default-features --target "${TARGET}"
    TARGET_BIN="${TAURI_DIR}/target/${TARGET}/release/tooly-daemon"
else
    echo "⚠️ Target ${TARGET} no instalado localmente en rustup. Compilando en release nativo..."
    cargo build --release --bin tooly-daemon --no-default-features
    TARGET_BIN="${TAURI_DIR}/target/release/tooly-daemon"
fi


echo "📦 [3/4] Empaquetando binario para PlayStation 5..."
mkdir -p "${OUTPUT_DIR}"
cp "${TARGET_BIN}" "${OUTPUT_DIR}/tooly-daemon.elf"

echo "✅ [4/4] Binario generado exitosamente:"
ls -lh "${OUTPUT_DIR}/tooly-daemon.elf"

echo ""
echo "🚀 Instrucciones de despliegue en PS5:"
echo "1. Transfiere '${OUTPUT_DIR}/tooly-daemon.elf' a '/data/etaHEN/payloads/' o '/data/pldmgr/payloads/' vía FTP (:2121)."
echo "2. O ejecútalo directamente en la consola mediante netcat/elfldr (:9020 / :9021):"
echo "   nc -w 3 <IP_PS5> 9021 < ${OUTPUT_DIR}/tooly-daemon.elf"
echo "3. Abre http://<IP_PS5>:8888 desde el navegador de la PS5, teléfono o PC en la misma red LAN."
