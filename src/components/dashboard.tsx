import React, { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  RefreshCw,
  Languages,
  ArrowUpCircle,
  ExternalLink,
} from "lucide-react";
import { DownloadProgressPayload } from "../lib/types";
import { subscribeServerEvents, tauriApi } from "../lib/tauri-client";
import { translations } from "../lib/i18n";
import { PsSymbols } from "./ps-symbols";
import { DeviceScanner } from "./device-scanner";
import { AppGrid } from "./app-grid";
import { LogTerminal } from "./log-terminal";
import { ArchiveModal } from "./archive-modal";

import { useAppStore } from "../stores/use-app-store";
import { usePs5Discovery } from "../hooks/use-ps5-discovery";
import { useUpdateEngine } from "../hooks/use-update-engine";
import { useActivityLog } from "../hooks/use-activity-log";

export function Dashboard() {
  const lang = useAppStore((state) => state.lang);
  const toggleLanguage = useAppStore((state) => state.toggleLanguage);
  const setProgressState = useAppStore((state) => state.setProgressState);

  const t = translations[lang];

  // Custom Hooks por dominio
  const { activityLogs, isCopied, copyLogs } = useActivityLog();

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

  // Auto-comprobación pasiva de versión de Tooly, modo PS5 local y auto-detección pasiva de consola LAN al montar
  useEffect(() => {
    checkToolyAppUpdate(true);

    tauriApi
      .getSystemInfo()
      .then((info) => {
        if (info.is_ps5 && info.default_ip) {
          setPs5Ip(info.default_ip);
          scanPs5(info.default_ip);
        } else {
          discoverPs5();
        }
      })
      .catch(() => {
        discoverPs5();
      });
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
                  className="flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-950/70 border border-amber-500/50 px-2 py-0.5 rounded-full hover:bg-amber-900/80 transition-all shadow-[0_0_10px_rgba(245,158,11,0.3)] animate-pulse"
                >
                  <ArrowUpCircle className="w-3 h-3 text-amber-400" />
                  <span>v{appUpdate.latest_version}</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                </a>
              ) : (
                <button
                  onClick={() => checkToolyAppUpdate(false)}
                  disabled={isCheckingAppUpdate}
                  title={t.checkToolyUpdate}
                  className="text-slate-500 hover:text-cyan-400 text-[10px] font-mono flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RefreshCw
                    className={`w-2.5 h-2.5 ${
                      isCheckingAppUpdate ? "animate-spin text-cyan-400" : ""
                    }`}
                  />
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400">{t.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <PsSymbols className="hidden sm:flex" />

          {/* Selector/Toggle de idioma OS (EN/ES) con persistencia */}
          <button
            onClick={toggleLanguage}
            title={lang === "es" ? "Cambiar a Inglés" : "Switch to Spanish"}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/70 hover:bg-slate-800 border border-slate-700/60 hover:border-cyan-400/50 text-[11px] font-mono text-slate-300 hover:text-cyan-300 transition-all cursor-pointer active:scale-95"
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

      {/* Modal de Actualizaciones de Archive.org */}
      <ArchiveModal onInstallDirect={handleInstallArchiveDirect} />
    </div>
  );
}
