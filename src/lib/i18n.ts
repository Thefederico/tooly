export type Language = "en" | "es";

export const translations = {
  en: {
    // Header
    subtitle: "PS5 Homebrew Updater & Direct PKG Installer",
    portsStatus: "DPI: :12800 | FTP: :2121",
    checkToolyUpdate: "Check Tooly update",
    checkingToolyUpdate: "Checking...",
    toolyUpToDate: "Tooly is up to date",
    toolyUpdateAvailable: "New Tooly release available:",
    downloadUpdate: "Download Update",

    // Progress Bar
    downloading: "Downloading",
    startingDpiServer: "Starting local LAN HTTP server...",
    triggeringDpi: "Sending install trigger to etaHEN DPI (:12800)...",
    installSuccess: "Update successfully sent to PS5!",
    processingUpdate: "Processing update...",

    // Left Panel: Console
    ps5Console: "PS5 Console (LAN)",
    etaHenTarget: "etaHEN Target",
    consoleIpLabel: "Console IP Address",
    scan: "Scan",
    scanning: "Scanning...",
    autoDetect: "Auto-detect",
    autoDetecting: "Detecting...",
    autoDetectTooltip: "Scan local LAN subnet (/24) for active PS5 consoles (:2121 / :12800)",
    autoDetectRadarBtn: "Auto-Detect Console",
    autoDetectRadarScanning: "Searching LAN Subnet...",
    autoDetectRadarSubtext: "Scans ports :2121 (FTP) & :12800 (DPI)",
    manualIpToggle: "Manual IP configuration",
    consoleFoundStatus: "Console detected on LAN",
    consoleNotFoundStatus: "No console detected yet",
    rescanRadar: "Scan Subnet Again",
    appsDetected: "Apps detected on console:",
    scannedPaths: "Scanned paths:",

    // Left Panel: Local Payloads
    localPayloads: "Local Payloads (PC/USB)",
    payloadExt: ".bin / .elf",
    folderPathLabel: "Local Folder Path",
    folderPlaceholder: "/Volumes/USB/payloads or C:\\payloads",
    noPayloadsPrompt: "Enter a folder with payloads to extract versions",

    // Left Panel: Terminal
    operationsLog: "Operations Log",
    copy: "Copy",
    copied: "Copied",
    copyLogsTooltip: "Copy all log entries to clipboard",

    // Right Panel: Apps & Updates
    installedAppsTitle: "Installed Apps & Updates",
    installedAppsSubtitle: "Remote PARAM.SFO detection & direct sync with GitHub Releases",
    pendingUpdates: "pending",
    noAppsTitle: "No apps scanned yet",
    noAppsDesc: "Enter your PS5 IP with etaHEN active and click \"Scan\" to inspect apps in /user/app/ and check for real-time updates.",
    scanPs5Now: "Scan PS5 Now",
    scanningConsole: "Scanning console...",

    // App Card & Filters
    filterAll: "All",
    filterUpdates: "Updates",
    filterHomebrew: "Homebrew",
    filterGames: "Games",
    filterPayloads: "Payloads",
    searchPlaceholder: "Search app by name or Title ID...",
    standalonePayload: "Standalone payload",
    noDirectPkg: "No direct PKG/ZIP",
    updateBadge: "Update",
    upToDateBadge: "Up to date",
    installedVer: "Installed",
    onGithubVer: "On GitHub",
    statusScanned: "Scanned",
    statusNoMapping: "No registry mapping",
    statusGithubError: "Error querying GitHub",
    updateAvailable: "Update available:",
    installingBtn: "Installing...",
    updateBtn: "Update",
    archiveUpdatesBtn: "Archive.org Updates",
    searchingArchive: "Searching Archive.org...",
    noArchiveUpdates: "No updates found on Archive.org",
    recommendedBadge: "Recommended",
    backportBadge: "Backport",
    installDirectDpi: "1-Click Direct Install (PS5)",
    archiveModalTitle: "Updates on Archive.org",
    archiveModalSubtitle: "Direct .pkg installation without using PC disk space",

    // Logs
    logInit: "Tooly Core v0.1.0 initialized. Ready to scan PS5 LAN.",
    logDiscovering: "Scanning local subnet for PS5 consoles (:2121 / :12800)...",
    logDiscoveredSuccess: (count: number, ip: string) => `Found ${count} PS5 device(s). Selected: ${ip}`,
    logNoPs5Discovered: "No PS5 consoles responding on port 2121/12800 in local subnet.",
    logConnectingFtp: (ip: string) => `Connecting to PS5 FTP (${ip}:2121)...`,
    logFtpDone: (count: number) => `FTP scan complete. Detected ${count} installed apps.`,
    logFtpError: (err: string) => `FTP scan error: ${err}`,
    logScanningPayloads: (dir: string) => `Scanning payloads in: ${dir}...`,
    logPayloadsDone: (count: number) => `Found ${count} payloads (.bin / .elf).`,
    logPayloadsError: (err: string) => `Error scanning payloads: ${err}`,
    logCheckingGithub: (name: string, repo: string) => `Checking GitHub Release for ${name} (${repo})...`,
    logNoPkgFound: (tag: string) => `No .pkg file found in release ${tag}.`,
    logDpiSuccess: (file: string) => `Installation of ${file} completed on PS5.`,
    logDpiError: (file: string) => `Error during installation of ${file}.`,
  },
  es: {
    // Header
    subtitle: "Actualizador de Homebrew y Lanzador Directo de PKG para PS5",
    portsStatus: "DPI: :12800 | FTP: :2121",
    checkToolyUpdate: "Buscar actualización de Tooly",
    checkingToolyUpdate: "Comprobando...",
    toolyUpToDate: "Tooly está al día",
    toolyUpdateAvailable: "Nueva versión de Tooly disponible:",
    downloadUpdate: "Descargar Actualización",

    // Progress Bar
    downloading: "Descargando",
    startingDpiServer: "Iniciando servidor HTTP LAN...",
    triggeringDpi: "Enviando trigger a etaHEN DPI (:12800)...",
    installSuccess: "¡Actualización enviada con éxito a la PS5!",
    processingUpdate: "Procesando actualización...",

    // Left Panel: Console
    ps5Console: "Consola PS5 (LAN)",
    etaHenTarget: "etaHEN Target",
    consoleIpLabel: "Dirección IP de la Consola",
    scan: "Escanear",
    scanning: "Buscando...",
    autoDetect: "Auto-detectar",
    autoDetecting: "Buscando...",
    autoDetectTooltip: "Escanear la subred LAN (/24) buscando consolas PS5 activas (:2121 / :12800)",
    autoDetectRadarBtn: "Auto-Detectar Consola",
    autoDetectRadarScanning: "Buscando en la subred LAN...",
    autoDetectRadarSubtext: "Escanea puertos :2121 (FTP) y :12800 (DPI)",
    manualIpToggle: "Configuración manual de IP",
    consoleFoundStatus: "Consola detectada en LAN",
    consoleNotFoundStatus: "Sin consola detectada aún",
    rescanRadar: "Volver a buscar en subred",
    appsDetected: "Apps detectadas en consola:",
    scannedPaths: "Rutas escaneadas:",

    // Left Panel: Local Payloads
    localPayloads: "Payloads Locales (PC/USB)",
    payloadExt: ".bin / .elf",
    folderPathLabel: "Ruta de Carpeta Local",
    folderPlaceholder: "/Volumes/USB/payloads o C:\\payloads",
    noPayloadsPrompt: "Ingresa una carpeta con payloads para extraer versiones",

    // Left Panel: Terminal
    operationsLog: "Registro de Operaciones",
    copy: "Copiar",
    copied: "Copiado",
    copyLogsTooltip: "Copiar todo el registro al portapapeles",

    // Right Panel: Apps & Updates
    installedAppsTitle: "Aplicaciones Instaladas & Actualizaciones",
    installedAppsSubtitle: "Detección remota de PARAM.SFO y sincronización directa con GitHub Releases",
    pendingUpdates: "pendientes",
    noAppsTitle: "Sin aplicaciones escaneadas",
    noAppsDesc: "Ingresa la IP de tu PS5 con etaHEN activo y presiona \"Escanear\" para inspeccionar las apps en /user/app/ y comprobar actualizaciones en tiempo real.",
    scanPs5Now: "Escanear PS5 Ahora",
    scanningConsole: "Escaneando consola...",

    // App Card & Filters
    filterAll: "Todas",
    filterUpdates: "Actualizaciones",
    filterHomebrew: "Homebrew",
    filterGames: "Juegos",
    filterPayloads: "Payloads",
    searchPlaceholder: "Buscar por nombre o Title ID...",
    standalonePayload: "Payload local/directo",
    noDirectPkg: "Sin PKG/ZIP directo",
    updateBadge: "Update",
    upToDateBadge: "Al día",
    installedVer: "Instalada",
    onGithubVer: "En GitHub",
    statusScanned: "Escaneado",
    statusNoMapping: "Sin mapeo en registro",
    statusGithubError: "Error consultando GitHub",
    updateAvailable: "Actualización disponible:",
    installingBtn: "Instalando...",
    updateBtn: "Actualizar",
    archiveUpdatesBtn: "Updates en Archive.org",
    searchingArchive: "Buscando en Archive.org...",
    noArchiveUpdates: "Sin updates encontrados en Archive.org",
    recommendedBadge: "Recomendado",
    backportBadge: "Backport",
    installDirectDpi: "1-Click Instalar Directo (PS5)",
    archiveModalTitle: "Actualizaciones en Archive.org",
    archiveModalSubtitle: "Instalación directa de .pkg sin ocupar espacio en la PC",

    // Logs
    logInit: "Tooly Core v0.1.0 inicializado. Listo para escanear PS5 LAN.",
    logDiscovering: "Escaneando subred LAN en busca de consolas PS5 (:2121 / :12800)...",
    logDiscoveredSuccess: (count: number, ip: string) => `Se detectaron ${count} dispositivo(s) PS5. Seleccionada: ${ip}`,
    logNoPs5Discovered: "No se detectaron consolas PS5 respondiendo en puertos 2121/12800 en la subred.",
    logConnectingFtp: (ip: string) => `Conectando al FTP de la PS5 (${ip}:2121)...`,
    logFtpDone: (count: number) => `Escaneo FTP completado. Se detectaron ${count} aplicaciones instaladas.`,
    logFtpError: (err: string) => `Error en escaneo FTP: ${err}`,
    logScanningPayloads: (dir: string) => `Escaneando payloads en: ${dir}...`,
    logPayloadsDone: (count: number) => `Se encontraron ${count} payloads (.bin / .elf).`,
    logPayloadsError: (err: string) => `Error escaneando payloads: ${err}`,
    logCheckingGithub: (name: string, repo: string) => `Consultando GitHub Release para ${name} (${repo})...`,
    logNoPkgFound: (tag: string) => `No se encontró un archivo .pkg en el release ${tag}.`,
    logDpiSuccess: (file: string) => `Instalación de ${file} completada en PS5.`,
    logDpiError: (file: string) => `Error durante la instalación de ${file}.`,
  },
} as const;

export function getSavedOrSystemLanguage(): Language {
  if (typeof window === "undefined") return "en";

  // 1. Si el usuario ya eligió o alternó un idioma previamente
  const saved = localStorage.getItem("tooly_language");
  if (saved === "es" || saved === "en") return saved;

  // 2. Si no hay elección previa guardada, revisar si el sistema del usuario está en español
  if (navigator) {
    const rawLangs = navigator.languages || [navigator.language || "en"];
    for (const l of rawLangs) {
      const code = l.toLowerCase();
      if (code.startsWith("es")) return "es";
      if (code.startsWith("en")) return "en";
    }
  }

  // 3. Fallback por defecto: EN
  return "en";
}

export function saveLanguage(lang: Language) {
  if (typeof window !== "undefined") {
    localStorage.setItem("tooly_language", lang);
  }
}
