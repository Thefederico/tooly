import React, { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  RefreshCw,
  Languages,
  ArrowUpCircle,
  ExternalLink,
  Terminal,
  Folder,
} from "lucide-react";
import { DownloadProgressPayload, LocalPayload } from "../lib/types";
import { subscribeServerEvents, tauriApi } from "../lib/tauri-client";
import { translations } from "../lib/i18n";
import { PsSymbols } from "./ps-symbols";
import { DeviceScanner } from "./device-scanner";
import { AppGrid } from "./app-grid";
import { LogTerminal } from "./log-terminal";
import { ArchiveModal } from "./archive-modal";
import { PayloadsDrawer } from "./payloads-drawer";
import { TerminalDrawer } from "./terminal-drawer";

import { useAppStore } from "../stores/use-app-store";
import { usePs5Discovery } from "../hooks/use-ps5-discovery";
import { useUpdateEngine } from "../hooks/use-update-engine";
import { useActivityLog } from "../hooks/use-activity-log";

export function Dashboard() {
  const lang = useAppStore((state) => state.lang);
  const toggleLanguage = useAppStore((state) => state.toggleLanguage);
  const setProgressState = useAppStore((state) => state.setProgressState);

  // Payloads & Drawers State from Zustand Store
  const payloadDir = useAppStore((state) => state.payloadDir);
  const setPayloadDir = useAppStore((state) => state.setPayloadDir);
  const localPayloads = useAppStore((state) => state.localPayloads);
  const setLocalPayloads = useAppStore((state) => state.setLocalPayloads);
  const isScanningPayloads = useAppStore((state) => state.isScanningPayloads);
  const setIsScanningPayloads = useAppStore((state) => state.setIsScanningPayloads);
  const isSendingPayload = useAppStore((state) => state.isSendingPayload);
  const setIsSendingPayload = useAppStore((state) => state.setIsSendingPayload);

  const isPayloadsDrawerOpen = useAppStore((state) => state.isPayloadsDrawerOpen);
  const setIsPayloadsDrawerOpen = useAppStore((state) => state.setIsPayloadsDrawerOpen);
  const isLogsDrawerOpen = useAppStore((state) => state.isLogsDrawerOpen);
  const setIsLogsDrawerOpen = useAppStore((state) => state.setIsLogsDrawerOpen);

  const t = translations[lang];

  // Custom Hooks por dominio
  const { activityLogs, isCopied, copyLogs } = useActivityLog();
  const addLog = useAppStore((state) => state.addLog);

  const {
    installedApps,
    updatesState,
    isScanningFtp,
    updatingId,
    progressState,
    appUpdate,
    isCheckingAppUpdate,
    scanPs5,
    updateApp,
    checkToolyAppUpdate,
    handleOpenArchiveModal,
    handleInstallArchiveDirect,
  } = useUpdateEngine();

  const {
    ps5Ip,
    setPs5Ip,
    showManualIp,
    setShowManualIp,
    isDiscovering,
    hasDiscoveredConsole,
    discoverPs5,
  } = usePs5Discovery((autoTargetIp) => {
    scanPs5(autoTargetIp);
  });

  // Handler para escanear payloads locales
  const handleScanPayloads = async () => {
    if (!payloadDir.trim()) {
      addLog("Directorio de payloads no configurado");
      return;
    }
    setIsScanningPayloads(true);
    addLog(`Escaneando payloads en: ${payloadDir}`);
    try {
      const results = await tauriApi.scanLocalPayloads(payloadDir);
      setLocalPayloads(results);
      addLog(`Escaneo completado: ${results.length} payloads encontrados`);
    } catch (err: any) {
      addLog(`Error al escanear payloads: ${err}`);
    } finally {
      setIsScanningPayloads(false);
    }
  };

  // Handler para enviar payload a PS5 mediante socket
  const handleSendPayloadToPs5 = async (payload: LocalPayload) => {
    if (!ps5Ip.trim()) {
      addLog("IP de PS5 no configurada para inyección");
      return;
    }
    setIsSendingPayload(true);
    const targetPort = 9021; // elfldr default port
    addLog(`Enviando ${payload.file_name} a ${ps5Ip}:${targetPort}...`);
    try {
      const res = await tauriApi.injectLocalPayload(ps5Ip, targetPort, payload.full_path);
      addLog(`Inyección exitosa: ${res}`);
    } catch (err: any) {
      addLog(`Fallo al enviar payload: ${err}`);
    } finally {
      setIsSendingPayload(false);
    }
  };

  // Listeners de eventos para progreso de descargas en tiempo real (Tauri Desktop o Web SSE)
  useEffect(() => {
    const handleProgress = (payload: DownloadProgressPayload) => {
      setProgressState(payload);
      if (
        payload.status === "installed_success" ||
        payload.status === "error"
      ) {
        setTimeout(() => {
          setProgressState(null);
        }, 5000);
      }
    };

    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      const unlistenPromise = listen<DownloadProgressPayload>("dpi-progress", (event) => {
        handleProgress(event.payload);
      });
      return () => {
        unlistenPromise.then((unlisten) => unlisten());
      };
    } else {
      // Modo Web / PS5 Daemon: suscripción Server-Sent Events (SSE)
      const unsubscribe = subscribeServerEvents((event) => {
        if (event.type === "dpi-progress") {
          handleProgress(event.payload);
        }
      });
      return () => {
        unsubscribe();
      };
    }
  }, [setProgressState]);

  // Auto-comprobación pasiva de versión de Tooly y auto-detección pasiva de consola LAN al montar
  useEffect(() => {
    checkToolyAppUpdate(true);
    const autoScanTimer = setTimeout(() => {
      discoverPs5();
    }, 600);
    return () => clearTimeout(autoScanTimer);
  }, []);

  return (
    <div className="h-screen bg-[#05070f] text-slate-100 flex flex-col font-sans ambient-radial-glow select-none overflow-hidden">
      {/* Top Header / Navigation Bar with Mobile Safe Area Support */}
      <header className="glass-panel px-6 pt-12 pb-3.5 safe-top flex items-center justify-between border-b border-cyan-500/20 shrink-0 z-50">
        <div className="flex items-center gap-3">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl blur-xs opacity-70 group-hover:opacity-100 transition duration-300"></div>
            <img
              src="/logo.png"
              alt="Tooly Logo"
              className="relative w-9 h-9 rounded-xl object-contain bg-slate-950/80 p-0.5 border border-cyan-400/30"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base tracking-wide bg-gradient-to-r from-white via-slate-200 to-cyan-300 bg-clip-text text-transparent">
                TOOLY
              </h1>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border border-cyan-500/30 text-cyan-400 bg-cyan-950/40">
                Core v0.1.0
              </span>

              {/* Tooly App Self-Update Indicator */}
              {appUpdate?.has_update ? (
                <a
                  href={
                    appUpdate.html_url ||
                    appUpdate.download_url ||
                    "https://github.com/Thefederico/tooly/releases"
                  }
                  target="_blank"
                  rel="noreferrer"
                  title={`${t.toolyUpdateAvailable} ${appUpdate.latest_version}`}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/40 text-[10px] font-mono text-cyan-300 transition duration-200 animate-pulse hover:animate-none cursor-pointer"
                >
                  <ArrowUpCircle className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span className="font-semibold">v{appUpdate.latest_version}</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                </a>
              ) : isCheckingAppUpdate ? (
                <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin text-cyan-400/50" />
                </span>
              ) : null}
            </div>
            <p className="text-[11px] text-slate-400 tracking-wider">
              PlayStation 5 Homebrew & Package Deployment Companion
            </p>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          <PsSymbols className="hidden md:flex text-slate-700/60" />

          {/* Botón para cambiar idioma */}
          <button
            onClick={toggleLanguage}
            title={lang === "es" ? "Cambiar idioma a inglés" : "Switch language to Spanish"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/70 hover:bg-slate-800 border border-slate-700/60 hover:border-cyan-400/50 text-[11px] font-mono text-slate-300 hover:text-cyan-300 transition-all cursor-pointer active:scale-95"
          >
            <Languages className="w-3.5 h-3.5 text-cyan-400" />
            <span className="uppercase font-bold">{lang}</span>
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/60 border border-slate-700/50 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-300 font-mono text-[11px]">{t.portsStatus}</span>
          </div>
        </div>
      </header>

      {/* Live Global Progress Bar for Active Operations */}
      {progressState && (
        <section className="bg-slate-950/90 border-b border-cyan-500/30 px-6 py-2.5 transition-all duration-300 shrink-0">
          <div className="max-w-7xl mx-auto flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                <span className="font-semibold text-slate-200">
                  {progressState.status === "downloading"
                    ? `${t.downloading} ${progressState.file_name}`
                    : progressState.status === "starting_dpi_server"
                    ? t.startingDpiServer
                    : progressState.status === "triggering_dpi"
                    ? t.triggeringDpi
                    : progressState.status === "installed_success"
                    ? t.installSuccess
                    : t.processingUpdate}
                </span>
              </div>
              <span className="font-mono text-cyan-400 font-bold">
                {progressState.percentage.toFixed(1)}%
              </span>
            </div>

            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-emerald-400 transition-all duration-200 shadow-[0_0_12px_rgba(0,240,255,0.6)]"
                style={{
                  width: `${Math.min(100, Math.max(0, progressState.percentage))}%`,
                }}
              />
            </div>

            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>
                {(progressState.downloaded_bytes / (1024 * 1024)).toFixed(2)} MB{" "}
                {progressState.total_bytes
                  ? `/ ${(progressState.total_bytes / (1024 * 1024)).toFixed(2)} MB`
                  : ""}
              </span>
              <span className="uppercase text-cyan-500/80">{progressState.status}</span>
            </div>
          </div>
        </section>
      )}

      {/* Main Cockpit Bento Grid */}
      <main className="p-5 max-w-7xl mx-auto w-full flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0 overflow-hidden">
        {/* Left Column: Console Connect, Local Directory & Terminal (4 cols) */}
        <section className="lg:col-span-4 flex flex-col gap-4 min-h-0 overflow-y-auto pr-1">
          <DeviceScanner
            ps5Ip={ps5Ip}
            onIpChange={setPs5Ip}
            showManualIp={showManualIp}
            onToggleManualIp={() => setShowManualIp(!showManualIp)}
            isDiscovering={isDiscovering}
            hasDiscoveredConsole={hasDiscoveredConsole}
            isScanningFtp={isScanningFtp}
            onDiscoverPs5={discoverPs5}
            onScanPs5={() => {
              if (!ps5Ip.trim()) {
                discoverPs5();
              } else {
                scanPs5();
              }
            }}
            appsCount={installedApps.length}
          />

          <LogTerminal logs={activityLogs} isCopied={isCopied} onCopyLogs={copyLogs} />
        </section>

        {/* Right Column: Homebrew Apps & Update Feed (8 cols) */}
        <section className="lg:col-span-8 flex flex-col min-h-0 overflow-y-auto pr-1">
          <AppGrid
            installedApps={installedApps}
            updatesState={updatesState}
            updatingId={updatingId}
            progressState={progressState}
            isScanningFtp={isScanningFtp}
            onScanPs5={() => {
              if (!ps5Ip.trim()) {
                discoverPs5();
              } else {
                scanPs5();
              }
            }}
            onUpdateApp={updateApp}
            onOpenArchiveModal={handleOpenArchiveModal}
          />
        </section>
      </main>

      {/* Bottom Floating Telemetry & Progress Dock (68px) */}
      <footer className="h-[68px] px-8 bg-[#13161f] border-t border-[#212634] flex items-center justify-between shrink-0 gap-6 z-20">
        {/* Left: Console Link info */}
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-[#4e9a78] shrink-0 animate-pulse"></span>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[#eceff4]">
              {ps5Ip ? `PS5 CONSOLE LINKED (${ps5Ip})` : "NO PS5 DETECTED"}
            </span>
            <span className="text-[10px] font-mono text-[#64748b]">
              FTP: :2121 · DPI: :12800 · ELFLDR: :9021
            </span>
          </div>
        </div>

        {/* Center: Live Status summary */}
        <div className="hidden md:flex items-center gap-4 text-xs font-mono text-[#64748b]">
          <span>LAN HTTP Server: Standby</span>
          <span>·</span>
          <span>Direct Package Installer: Ready</span>
        </div>

        {/* Right: Quick actions for Drawers */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLogsDrawerOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-[#1c212e] hover:bg-[#252c3d] border border-[#282f42] text-xs font-mono text-[#828fa3] hover:text-[#eceff4] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5 text-[#4e9a78]" />
            <span>Console Log ↗</span>
          </button>
          <button
            onClick={() => setIsPayloadsDrawerOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-[#1c212e] hover:bg-[#252c3d] border border-[#282f42] text-xs font-mono text-[#828fa3] hover:text-[#eceff4] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Folder className="w-3.5 h-3.5 text-[#7e6e9c]" />
            <span>Payloads</span>
          </button>
        </div>
      </footer>

      {/* Drawers y Modales */}
      <PayloadsDrawer
        isOpen={isPayloadsDrawerOpen}
        onClose={() => setIsPayloadsDrawerOpen(false)}
        payloadDir={payloadDir}
        setPayloadDir={setPayloadDir}
        localPayloads={localPayloads}
        isScanningPayloads={isScanningPayloads}
        onScanPayloads={handleScanPayloads}
        onSendPayload={handleSendPayloadToPs5}
        isSendingPayload={isSendingPayload}
        lang={lang}
      />

      <TerminalDrawer
        isOpen={isLogsDrawerOpen}
        onClose={() => setIsLogsDrawerOpen(false)}
        activityLogs={activityLogs}
        onCopyLogs={copyLogs}
        isCopied={isCopied}
        lang={lang}
      />

      {/* Modal de Actualizaciones de Archive.org */}
      <ArchiveModal onInstallDirect={handleInstallArchiveDirect} />
    </div>
  );
}

export default Dashboard;
