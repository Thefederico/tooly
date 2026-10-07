import React, { useState, useEffect } from "react";
import registryData from "../data/registry.json";
import { RegistryItem, InstalledApp, LocalPayload, GitHubReleaseInfo, DownloadProgressPayload, AppUpdateInfo } from "../lib/types";
import { tauriApi } from "../lib/tauri-client";
import { Language, getSavedOrSystemLanguage, saveLanguage, translations } from "../lib/i18n";
import { PsSymbols } from "./ps-symbols";
import { listen } from "@tauri-apps/api/event";
import {
  RefreshCw,
  DownloadCloud,
  Folder,
  Wifi,
  Sparkles,
  Terminal,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  Languages,
  Radar,
  ArrowUpCircle,
  ExternalLink,
  Database,
} from "lucide-react";
import { ArchiveUpdatesModal } from "./archive-updates-modal";
import { ArchiveOrgGameUpdate } from "../lib/types";

interface AppUpdateStatus {
  installed?: InstalledApp;
  registry?: RegistryItem;
  latestRelease?: GitHubReleaseInfo;
  archiveUpdates?: ArchiveOrgGameUpdate[];
  isSearchingArchive?: boolean;
  hasUpdate: boolean;
  statusText: string;
}

export function Dashboard() {
  const [lang, setLang] = useState<Language>(getSavedOrSystemLanguage());
  const t = translations[lang];

  const handleToggleLanguage = () => {
    const nextLang: Language = lang === "es" ? "en" : "es";
    setLang(nextLang);
    saveLanguage(nextLang);
  };

  const [ps5Ip, setPs5Ip] = useState("192.168.1.100");
  const [payloadDir, setPayloadDir] = useState("");
  const [isScanningFtp, setIsScanningFtp] = useState(false);
  const [isScanningPayloads, setIsScanningPayloads] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [localPayloads, setLocalPayloads] = useState<LocalPayload[]>([]);
  const [updatesState, setUpdatesState] = useState<Record<string, AppUpdateStatus>>({});
  const [progressState, setProgressState] = useState<DownloadProgressPayload | null>(null);
  const [activityLogs, setActivityLogs] = useState<string[]>([
    translations[getSavedOrSystemLanguage()].logInit,
  ]);

  const [appUpdate, setAppUpdate] = useState<AppUpdateInfo | null>(null);
  const [isCheckingAppUpdate, setIsCheckingAppUpdate] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Modal de Archive.org
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [selectedArchiveApp, setSelectedArchiveApp] = useState<{ titleId: string; name: string } | null>(null);
  const [activeArchiveUpdates, setActiveArchiveUpdates] = useState<ArchiveOrgGameUpdate[]>([]);
  const [isLoadingArchiveModal, setIsLoadingArchiveModal] = useState(false);
  const [isInstallingArchiveDirect, setIsInstallingArchiveDirect] = useState(false);
  const [installingArchiveUrl, setInstallingArchiveUrl] = useState<string | null>(null);

  const registry = registryData as RegistryItem[];

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setActivityLogs((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 40)]);
  };

  const handleCopyLogs = async () => {
    try {
      const fullLogText = activityLogs.join("\n");
      await navigator.clipboard.writeText(fullLogText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Error al copiar registro:", err);
    }
  };

  // Comprobar actualización de Tooly Desktop (al arrancar y bajo demanda)
  const handleCheckAppUpdate = async (silent = false) => {
    setIsCheckingAppUpdate(true);
    if (!silent) addLog(t.checkToolyUpdate + "...");
    try {
      const updateInfo = await tauriApi.checkAppUpdate();
      setAppUpdate(updateInfo);
      if (updateInfo.has_update) {
        addLog(`${t.toolyUpdateAvailable} ${updateInfo.latest_version}`);
      } else if (!silent) {
        addLog(t.toolyUpToDate);
      }
    } catch (err: any) {
      if (!silent) {
        addLog(`Error al comprobar versión de Tooly: ${err}`);
      }
    } finally {
      setIsCheckingAppUpdate(false);
    }
  };

  // Auto-comprobación pasiva de versión de Tooly al cargar
  useEffect(() => {
    handleCheckAppUpdate(true);
  }, []);

  // Auto-descubrimiento en subred LAN
  const handleDiscoverPs5 = async () => {
    setIsDiscovering(true);
    addLog(t.logDiscovering);
    try {
      // Pasamos la IP actual como hint base o dejamos que detecte la LAN interface
      const baseHint = ps5Ip.trim().length > 0 ? ps5Ip.trim() : undefined;
      const discovered = await tauriApi.discoverPs5Consoles(baseHint);
      if (discovered.length > 0) {
        const selected = discovered[0];
        setPs5Ip(selected.ip);
        addLog(t.logDiscoveredSuccess(discovered.length, selected.ip));
        // Opcional: auto-disparar escaneo si FTP está abierto
        if (selected.ftp_open) {
          setTimeout(() => {
            handleScanPs5WithIp(selected.ip);
          }, 300);
        }
      } else {
        addLog(t.logNoPs5Discovered);
      }
    } catch (err: any) {
      addLog(`Error en auto-descubrimiento LAN: ${err}`);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleScanPs5WithIp = async (targetIp: string) => {
    if (!targetIp.trim()) return;
    setIsScanningFtp(true);
    addLog(t.logConnectingFtp(targetIp));
    try {
      const apps = await tauriApi.scanPs5Apps(targetIp);
      setInstalledApps(apps);
      addLog(t.logFtpDone(apps.length));
      await evaluateUpdates(apps);
    } catch (err: any) {
      addLog(t.logFtpError(String(err)));
    } finally {
      setIsScanningFtp(false);
    }
  };

  // Escaneo FTP de la PS5
  const handleScanPs5 = async () => {
    await handleScanPs5WithIp(ps5Ip);
  };

  // Comparar con GitHub Releases
  const evaluateUpdates = async (apps: InstalledApp[]) => {
    const stateMap: Record<string, AppUpdateStatus> = {};

    for (const app of apps) {
      const reg = registry.find((r) => r.titleId?.toUpperCase() === app.title_id.toUpperCase());
      if (reg && reg.githubRepo) {
        addLog(t.logCheckingGithub(reg.name, reg.githubRepo));
        try {
          const rel = await tauriApi.checkGitHubUpdate(reg.githubRepo);
          const currentClean = app.app_ver.replace(/^[vV]/, "").trim();
          const latestClean = rel.tag_name.replace(/^[vV]/, "").trim();

          const hasCompatibleAsset = rel.assets && rel.assets.some((a) => {
            if (reg.assetPattern) {
              try {
                return new RegExp(reg.assetPattern, "i").test(a.name);
              } catch (_) {}
            }
            return (
              a.name.toLowerCase().endsWith(".pkg") ||
              a.name.toLowerCase().endsWith(".bin") ||
              a.name.toLowerCase().endsWith(".elf") ||
              a.name.toLowerCase().endsWith(".zip")
            );
          });

          const isNewer = currentClean !== latestClean;
          const hasUpdate = isNewer && Boolean(hasCompatibleAsset);

          stateMap[app.title_id] = {
            installed: app,
            registry: reg,
            latestRelease: rel,
            hasUpdate,
            statusText: hasUpdate
              ? `${t.updateAvailable} ${rel.tag_name}`
              : isNewer && !hasCompatibleAsset
              ? `${rel.tag_name} (Sin PKG/ZIP)`
              : t.upToDateBadge,
          };
        } catch (e: any) {
          stateMap[app.title_id] = {
            installed: app,
            registry: reg,
            hasUpdate: false,
            statusText: t.statusGithubError,
          };
        }
      } else {
        stateMap[app.title_id] = {
          installed: app,
          hasUpdate: false,
          statusText: t.statusNoMapping,
        };
      }
    }

    setUpdatesState(stateMap);

    // Búsqueda en segundo plano en Archive.org para juegos comerciales (CUSAxxxxx / PPSAxxxxx)
    for (const app of apps) {
      const isCommercialGame = (app.title_id.startsWith("CUSA") || app.title_id.startsWith("PPSA")) && !app.title_id.startsWith("PAYLOAD_");
      if (isCommercialGame) {
        // Ejecutar en background sin bloquear la interfaz
        tauriApi.searchArchiveUpdates(app.title_id, app.app_name, app.app_ver)
          .then((archiveItems) => {
            if (archiveItems && archiveItems.length > 0) {
              setUpdatesState((prev) => {
                const current = prev[app.title_id] || {
                  installed: app,
                  hasUpdate: false,
                  statusText: "",
                };
                return {
                  ...prev,
                  [app.title_id]: {
                    ...current,
                    archiveUpdates: archiveItems,
                    hasUpdate: current.hasUpdate || archiveItems.some((i) => i.is_recommended),
                  },
                };
              });
              addLog(`[Archive.org] Se detectaron ${archiveItems.length} paquetes para ${app.app_name || app.title_id}`);
            }
          })
          .catch((_err) => {
            // Ignorar errores silenciosos en background
          });
      }
    }
  };

  const handleOpenArchiveModal = async (app: InstalledApp) => {
    const appName = app.app_name || updatesState[app.title_id]?.registry?.name || app.title_id;
    setSelectedArchiveApp({ titleId: app.title_id, name: appName });
    setIsArchiveModalOpen(true);

    const existingUpdates = updatesState[app.title_id]?.archiveUpdates;
    if (existingUpdates && existingUpdates.length > 0) {
      setActiveArchiveUpdates(existingUpdates);
    } else {
      setIsLoadingArchiveModal(true);
      try {
        const results = await tauriApi.searchArchiveUpdates(app.title_id, app.app_name, app.app_ver);
        setActiveArchiveUpdates(results);
        setUpdatesState((prev) => ({
          ...prev,
          [app.title_id]: {
            ...prev[app.title_id],
            archiveUpdates: results,
          },
        }));
      } catch (err: any) {
        addLog(`Error buscando en Archive.org: ${err}`);
      } finally {
        setIsLoadingArchiveModal(false);
      }
    }
  };

  const handleInstallArchiveDirect = async (downloadUrl: string, fileName: string) => {
    if (!ps5Ip.trim()) return;
    setIsInstallingArchiveDirect(true);
    setInstallingArchiveUrl(downloadUrl);
    addLog(`Enviando instalación directa a PS5 DPI (${fileName})...`);

    try {
      const res = await tauriApi.installArchiveUpdateDirect(ps5Ip, downloadUrl);
      addLog(res.message);
    } catch (err: any) {
      addLog(`Error en instalación directa DPI: ${err}`);
    } finally {
      setIsInstallingArchiveDirect(false);
      setInstallingArchiveUrl(null);
    }
  };

  // Escanear payloads locales
  const handleScanPayloads = async () => {
    if (!payloadDir.trim()) return;
    setIsScanningPayloads(true);
    addLog(t.logScanningPayloads(payloadDir));
    try {
      const payloads = await tauriApi.scanLocalPayloads(payloadDir);
      setLocalPayloads(payloads);
      addLog(t.logPayloadsDone(payloads.length));
    } catch (err: any) {
      addLog(t.logPayloadsError(String(err)));
    } finally {
      setIsScanningPayloads(false);
    }
  };

  // Disparar instalación DPI (o actualización directa FTP si es un payload)
  const handleUpdateApp = async (titleId: string) => {
    const item = updatesState[titleId];
    if (!item || !item.latestRelease || !item.latestRelease.assets.length) return;

    const isPayload = titleId.startsWith("PAYLOAD_") || 
      item.registry?.category === "payload" || 
      item.registry?.assetPattern?.includes("elf") || 
      item.registry?.assetPattern?.includes("bin");

    if (isPayload) {
      // Buscar asset .elf o .bin (o .zip que contenga el payload)
      const payloadAsset = item.latestRelease.assets.find((a) => {
        const lower = a.name.toLowerCase();
        return lower.endsWith(".elf") || lower.endsWith(".bin");
      });

      if (!payloadAsset) {
        addLog(`No se encontró binario .elf o .bin en el release ${item.latestRelease.tag_name}.`);
        return;
      }

      setUpdatingId(titleId);
      addLog(`Actualizando payload ${item.installed?.app_name || titleId} a ${item.latestRelease.tag_name} vía FTP...`);

      try {
        const targetFolder = item.installed?.path || "/data/pldmgr/payloads";
        const msg = await tauriApi.updatePayloadViaFtp(
          ps5Ip,
          targetFolder,
          payloadAsset.browser_download_url,
          payloadAsset.name,
          item.latestRelease.tag_name
        );
        addLog(msg);
        // Actualizar versión en la UI
        setInstalledApps((prev) =>
          prev.map((a) =>
            a.title_id === titleId
              ? { ...a, app_ver: item.latestRelease!.tag_name.replace(/^[vV]/, "") }
              : a
          )
        );
        setUpdatesState((prev) => ({
          ...prev,
          [titleId]: {
            ...prev[titleId],
            hasUpdate: false,
            statusText: t.upToDateBadge,
          },
        }));
      } catch (err: any) {
        addLog(`Error actualizando payload: ${err}`);
      } finally {
        setUpdatingId(null);
      }
      return;
    }

    // Flujo normal de PKG mediante DPI
    const pkgAsset = item.latestRelease.assets.find((a) => a.name.toLowerCase().endsWith(".pkg"));
    if (!pkgAsset) {
      const zipAsset = item.latestRelease.assets.find((a) => {
        if (item.registry?.assetPattern) {
          try {
            return new RegExp(item.registry.assetPattern, "i").test(a.name);
          } catch (_) {}
        }
        return a.name.toLowerCase().endsWith(".zip");
      });

      if (zipAsset) {
        addLog(`[Homebrew ZIP] ${item.installed?.app_name || titleId} (${item.latestRelease.tag_name}) se distribuye como paquete ZIP (${zipAsset.name}). Abriendo descarga directa para /data/homebrew/...`);
        window.open(zipAsset.browser_download_url, "_blank");
        return;
      }

      addLog(t.logNoPkgFound(item.latestRelease.tag_name));
      return;
    }

    setUpdatingId(titleId);
    setProgressState({
      file_name: pkgAsset.name,
      downloaded_bytes: 0,
      total_bytes: pkgAsset.size || null,
      percentage: 0,
      status: "downloading",
    });

    try {
      const res = await tauriApi.triggerDpiUpdate(ps5Ip, pkgAsset.browser_download_url, pkgAsset.name);
      addLog(res.message);
    } catch (err: any) {
      addLog(String(err));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="h-screen bg-[#05070f] text-slate-100 flex flex-col font-sans ambient-radial-glow select-none overflow-hidden">
      {/* Top Header / Navigation Bar */}
      <header className="glass-panel px-6 py-3.5 flex items-center justify-between border-b border-cyan-500/20 shrink-0 z-50">
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
                  href={appUpdate.html_url || appUpdate.download_url || "https://github.com/ToolyApp/tooly/releases"}
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
                  onClick={() => handleCheckAppUpdate(false)}
                  disabled={isCheckingAppUpdate}
                  title={t.checkToolyUpdate}
                  className="text-slate-500 hover:text-cyan-400 text-[10px] font-mono flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-2.5 h-2.5 ${isCheckingAppUpdate ? "animate-spin text-cyan-400" : ""}`} />
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
            onClick={handleToggleLanguage}
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
                style={{ width: `${Math.min(100, Math.max(0, progressState.percentage))}%` }}
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
        {/* Left Column: Console Connect & Local Directory (4 cols) */}
        <section className="lg:col-span-4 flex flex-col gap-4 min-h-0 overflow-y-auto pr-1">
          {/* Box 1: PS5 Connection Card */}
          <div className="glass-panel rounded-2xl p-4.5 flex flex-col gap-3.5 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-cyan-400" />
                <h2 className="font-semibold text-sm tracking-wide text-slate-200">{t.ps5Console}</h2>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">{t.etaHenTarget}</span>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-400 font-medium">{t.consoleIpLabel}</label>
                <button
                  onClick={handleDiscoverPs5}
                  disabled={isDiscovering || isScanningFtp}
                  title={t.autoDetectTooltip}
                  className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-400 hover:text-cyan-300 disabled:opacity-50 cursor-pointer transition-colors"
                >
                  <Radar className={`w-3.5 h-3.5 ${isDiscovering ? "animate-spin text-cyan-300" : ""}`} />
                  <span>{isDiscovering ? t.autoDetecting : t.autoDetect}</span>
                </button>
              </div>
              <div className="flex items-center gap-2.5">
                <input
                  type="text"
                  value={ps5Ip}
                  onChange={(e) => setPs5Ip(e.target.value)}
                  placeholder="192.168.1.xxx"
                  className="flex-1 bg-slate-950/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs font-mono text-cyan-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-all shadow-inner"
                />
                <button
                  onClick={handleScanPs5}
                  disabled={isScanningFtp || isDiscovering}
                  className="w-32 py-2.5 px-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-[0.98] text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_16px_rgba(0,112,209,0.35)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isScanningFtp ? "animate-spin" : ""}`} />
                  <span className="truncate">{isScanningFtp ? t.scanning : t.scan}</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-950/50 rounded-xl p-2.5 border border-slate-800/80 text-[11px] flex flex-col gap-1.5 text-slate-400">
              <div className="flex justify-between">
                <span>{t.appsDetected}</span>
                <span className="font-mono text-cyan-400 font-bold">{installedApps.length}</span>
              </div>
              <div className="flex justify-between">
                <span>{t.scannedPaths}</span>
                <span className="font-mono text-slate-300">/user/app, /data</span>
              </div>
            </div>
          </div>

          {/* Box 2: Local Payloads Scanner */}
          <div className="glass-panel rounded-2xl p-4.5 flex flex-col gap-3.5 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-blue-400" />
                <h2 className="font-semibold text-sm tracking-wide text-slate-200">{t.localPayloads}</h2>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">{t.payloadExt}</span>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-400 font-medium">{t.folderPathLabel}</label>
              <div className="flex items-center gap-2.5">
                <input
                  type="text"
                  value={payloadDir}
                  onChange={(e) => setPayloadDir(e.target.value)}
                  placeholder={t.folderPlaceholder}
                  className="flex-1 bg-slate-950/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 transition-all shadow-inner"
                />
                <button
                  onClick={handleScanPayloads}
                  disabled={isScanningPayloads}
                  className="w-32 py-2.5 px-3 bg-slate-800 hover:bg-slate-700/90 active:scale-[0.98] text-slate-200 hover:text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 border border-slate-700/60 hover:border-slate-600 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isScanningPayloads ? "animate-spin" : ""}`} />
                  <span className="truncate">{isScanningPayloads ? t.scanning : t.scan}</span>
                </button>
              </div>
            </div>

            {/* Lista de payloads locales */}
            <div className="max-h-36 overflow-y-auto flex flex-col gap-1.5 pr-1">
              {localPayloads.length === 0 ? (
                <div className="text-center py-2.5 text-xs text-slate-500 italic">
                  {t.noPayloadsPrompt}
                </div>
              ) : (
                localPayloads.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div className="flex flex-col truncate pr-2">
                      <span className="font-semibold text-slate-300 truncate">{p.detected_name}</span>
                      <span className="text-[10px] font-mono text-slate-500 truncate">{p.file_name}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-blue-950/50 border border-blue-500/30 text-blue-400 font-mono text-[10px]">
                      {p.detected_version ? `v${p.detected_version}` : p.extension.toUpperCase()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Box 3: Terminal / Activity Feed */}
          <div className="glass-panel rounded-2xl p-4 flex flex-col gap-2 flex-1 min-h-[140px] shrink-0">
            <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-medium text-slate-300">{t.operationsLog}</span>
              </div>
              <button
                onClick={handleCopyLogs}
                title={t.copyLogsTooltip}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 hover:border-cyan-500/40 text-[11px] font-mono text-slate-300 hover:text-cyan-300 transition-all cursor-pointer active:scale-95"
              >
                {isCopied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400 font-sans">{t.copied}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-slate-400 hover:text-cyan-400" />
                    <span className="font-sans">{t.copy}</span>
                  </>
                )}
              </button>
            </div>
            <div className="font-mono text-[11px] text-slate-400 flex flex-col gap-1 overflow-y-auto max-h-40 pr-1 select-text cursor-text">
              {activityLogs.map((log, index) => (
                <div key={index} className="leading-tight select-text">
                  <span className="text-cyan-500/70 select-text">{log}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right Column: Homebrew Apps & Update Feed (8 cols) */}
        <section className="lg:col-span-8 flex flex-col min-h-0 overflow-y-auto pr-1">
          <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-cyan-400" />
                  {t.installedAppsTitle}
                </h2>
                <p className="text-xs text-slate-400">
                  {t.installedAppsSubtitle}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono">
                  {Object.values(updatesState).filter((s) => s.hasUpdate).length} {t.pendingUpdates}
                </span>
              </div>
            </div>

            {/* Listado de aplicaciones */}
            {installedApps.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center border border-dashed border-cyan-500/15 rounded-2xl text-center px-6 bg-slate-950/20 backdrop-blur-xs my-auto">
                <div className="relative group mb-3">
                  <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full blur-sm opacity-40 group-hover:opacity-80 transition duration-300"></div>
                  <div className="relative w-12 h-12 rounded-full bg-slate-900/90 flex items-center justify-center text-cyan-400 border border-cyan-500/30">
                    <DownloadCloud className="w-6 h-6" />
                  </div>
                </div>
                <h3 className="font-semibold text-slate-100 text-sm tracking-wide">{t.noAppsTitle}</h3>
                <p className="text-xs text-slate-400 max-w-md mt-1 leading-relaxed">
                  {t.noAppsDesc}
                </p>
                <button
                  onClick={handleScanPs5}
                  disabled={isScanningFtp}
                  className="mt-4 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-[0.98] text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(0,112,209,0.4)] disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanningFtp ? "animate-spin" : ""}`} />
                  {isScanningFtp ? t.scanningConsole : t.scanPs5Now}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {installedApps.map((app) => {
                  const state = updatesState[app.title_id];
                  const hasUpdate = state?.hasUpdate;
                  const isUpdating = updatingId === app.title_id;

                  return (
                    <div
                      key={app.title_id}
                      className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                        hasUpdate
                          ? "bg-slate-900/80 border-cyan-500/40 shadow-[0_0_20px_rgba(0,240,255,0.1)]"
                          : "bg-slate-950/40 border-slate-800/80 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-slate-100">
                              {app.app_name || state?.registry?.name || app.title_id}
                            </h4>
                            {app.title_id.startsWith("PAYLOAD_") && (
                              <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-500/40 text-purple-300">
                                Payload
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-cyan-400/90">{app.title_id}</span>
                        </div>

                        {hasUpdate ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-950/50 border border-amber-500/40 px-2 py-0.5 rounded-full">
                            <Sparkles className="w-3 h-3 text-amber-400" /> {t.updateBadge}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" /> {t.upToDateBadge}
                          </span>
                        )}
                      </div>

                      <div className="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800/60 flex items-center justify-between text-xs font-mono">
                        <div>
                          <span className="text-slate-500 block text-[10px]">{t.installedVer}</span>
                          <span className="text-slate-300 font-bold">{app.app_ver}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-500 block text-[10px]">{t.onGithubVer}</span>
                          <span className="text-cyan-300 font-bold">
                            {state?.latestRelease?.tag_name || "—"}
                          </span>
                        </div>
                      </div>

                      {/* Mini progress bar if updating this app */}
                      {isUpdating && progressState && (
                        <div className="flex flex-col gap-1 w-full bg-slate-950/80 p-2 rounded-lg border border-cyan-500/30">
                          <div className="flex justify-between text-[10px] font-mono">
                            <span className="text-cyan-300 truncate max-w-[140px]">{progressState.status}</span>
                            <span className="text-cyan-400 font-bold">{progressState.percentage.toFixed(0)}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-cyan-400 transition-all duration-150"
                              style={{ width: `${progressState.percentage}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
                        <span className="text-[11px] text-slate-400 truncate max-w-[130px]">
                          {state?.statusText || t.statusScanned}
                        </span>

                        <div className="flex items-center gap-1.5 ml-auto">
                          {/* Botón Archive.org para juegos comerciales */}
                          {(app.title_id.startsWith("CUSA") || app.title_id.startsWith("PPSA")) && !app.title_id.startsWith("PAYLOAD_") && (
                            <button
                              onClick={() => handleOpenArchiveModal(app)}
                              title={t.archiveUpdatesBtn}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/70 hover:border-cyan-400/50 text-[11px] font-medium text-cyan-300 hover:text-cyan-200 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                            >
                              <Database className="w-3 h-3 text-cyan-400" />
                              <span>Archive.org</span>
                              {state?.archiveUpdates && state.archiveUpdates.length > 0 && (
                                <span className="px-1 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-[9px] font-bold">
                                  {state.archiveUpdates.length}
                                </span>
                              )}
                            </button>
                          )}

                          {hasUpdate && state?.latestRelease && (
                            <button
                              onClick={() => handleUpdateApp(app.title_id)}
                              disabled={isUpdating}
                              className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(0,240,255,0.3)] disabled:opacity-50 cursor-pointer"
                            >
                              <DownloadCloud className={`w-3.5 h-3.5 ${isUpdating ? "animate-bounce" : ""}`} />
                              {isUpdating
                                ? t.installingBtn
                                : state.latestRelease.assets.some((a) => a.name.toLowerCase().endsWith(".pkg"))
                                ? t.updateBtn
                                : "ZIP Release"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Modal de Actualizaciones de Archive.org */}
      {selectedArchiveApp && (
        <ArchiveUpdatesModal
          isOpen={isArchiveModalOpen}
          onClose={() => setIsArchiveModalOpen(false)}
          titleId={selectedArchiveApp.titleId}
          gameName={selectedArchiveApp.name}
          updates={activeArchiveUpdates}
          isLoading={isLoadingArchiveModal}
          onInstallDirect={handleInstallArchiveDirect}
          isInstalling={isInstallingArchiveDirect}
          installingUrl={installingArchiveUrl}
          lang={lang}
        />
      )}
    </div>
  );
}
