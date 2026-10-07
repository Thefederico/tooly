# Tooly 🎮⚡

**Tooly** is a modern desktop companion application for PlayStation 5 homebrew management, automated updates, payload deployment, and commercial game update scanning built with **Tauri v2 (Rust Backend)**, **Vite**, **React 19**, and **Tailwind CSS 4**.

---

## 🌟 Key Features

- **🚀 Subnet Auto-Discovery**: Automatically scan your local LAN subnet for active PS5 consoles running FTP (`:2121`) or etaHEN Direct Package Installer (`:12800`).
- **📦 Dual-Mode PS5 App Scanner**:
  - Scans `/user/app/` and `/data/homebrew/` for installed PKGs, parsing binary `PARAM.SFO` and `param.json` on the fly.
  - Scans `/data/pldmgr/payloads/` for `.elf` and `.bin` payloads and their metadata descriptors.
  - Seamless deduplication and smart pairing of frontend web launchers (`FMGR88888`, `FAKE10101`, `PKGM00001`) with their corresponding payload daemons.
- **🔄 GitHub Releases Integration**: Built-in verified catalog of 30+ popular PS5 homebrews and payloads comparing installed versions with the latest GitHub releases.
- **📥 1-Click Remote Installation**:
  - Direct Package Installer (DPI) push over LAN via an embedded ephemeral high-performance HTTP server in Rust.
  - Direct FTP remote binary swap and metadata synchronization for Payload Manager.
- **🏛️ Archive.org Game Updates Finder**: Automatic search for game update PKGs (CUSA / PPSA) directly on the Internet Archive with firmware and backport compatibility hints.
- **💎 Antigravity 2026 x PS Retrofuturism UI**: Liquid glass aesthetic, glowing indicators, PS symbols (△ ◯ ✕ □), bento grid dashboard, and built-in English/Spanish internationalization.

---

## 🛠️ Tech Stack

- **Desktop Framework**: [Tauri v2](https://v2.tauri.app/)
- **Backend**: Rust (2021 edition), Tokio, `suppaftp`, `reqwest`, `axum`, `serde`
- **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [pnpm](https://pnpm.io/) (`corepack enable pnpm` or `npm i -g pnpm`)
- [Rust](https://www.rust-lang.org/) (`rustup default stable`)
- Platform dependencies for Tauri v2 (see [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/))

### Installation

```bash
# Clone the repository
git clone https://github.com/Thefederico/tooly.git
cd tooly

# Install frontend dependencies
pnpm install
```

### Development

```bash
# Run in development mode (with Hot Reload for both React and Rust)
pnpm tauri dev

# Run only Vite frontend
pnpm dev
```

### Build

```bash
# Check Rust backend tests
cd src-tauri && cargo test && cd ..

# Build native desktop bundle (.dmg, .deb, .msi / .exe)
pnpm tauri build
```

---

## 🔒 Security & Console Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| `2121` | FTP | Reading installed metadata & uploading payloads |
| `12800` | HTTP / DPI | etaHEN Direct Package Installer trigger |
| `9090` | TCP Socket | Alternative etaHEN JSON command socket |
| `8844` / `8888` / `10101` | HTTP | PS5 web daemons (PKG-Manager, WebFileManager, ShadowMount+) |

---

## 📄 License

MIT © [Federico Upegui](https://github.com/Thefederico)
