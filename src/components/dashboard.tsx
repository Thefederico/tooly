import React, { useState, useEffect, useRef } from "react";
import registryData from "../data/registry.json";
import {
  RegistryItem,
  InstalledApp,
  LocalPayload,
  GitHubReleaseInfo,
  DownloadProgressPayload,
  AppUpdateInfo,
  ArchiveOrgGameUpdate,
} from "../lib/types";
import { tauriApi } from "../lib/tauri-client";
import { Language, getSavedOrSystemLanguage, saveLanguage, translations } from "../lib/i18n";
import { PsSymbols } from "./ps-symbols";
import { listen } from "@tauri-apps/api/event";
import {
  RefreshCw,
  Search,
  HardDrive,
  Terminal,
  ArrowDownToLine,
  ExternalLink,
  Radar,
  Sparkles,
  Database,
  ArrowUpCircle,
  FileCode2,
  Folder,
  Layers,
  CheckCircle2,
  Send,
  Zap,
} from "lucide-react";
import { ArchiveUpdatesModal } from "./archive-updates-modal";
import { PayloadsDrawer } from "./payloads-drawer";
import { TerminalDrawer } from "./terminal-drawer";

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
  const [isSendingPayload, setIsSendingPayload] = useState(false);

  const [isInjectingFtp, setIsInjectingFtp] = useState(false);
  const [consoleServices, setConsoleServices] = useState<{
    ftp_open: boolean;
    payload_manager_open: boolean;
    elf_loader_port: number | null;
  } | null>(null);

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

  // Filtros y Búsqueda
  const [activeFilter, setActiveFilter] = useState<"all" | "updates" | "homebrew" | "games">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Drawers y Modales
  const [isPayloadsDrawerOpen, setIsPayloadsDrawerOpen] = useState(false);
  const [isLogsDrawerOpen, setIsLogsDrawerOpen] = useState(false);

  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [selectedArchiveApp, setSelectedArchiveApp] = useState<{ titleId: string; name: string } | null>(null);
  const [activeArchiveUpdates, setActiveArchiveUpdates] = useState<ArchiveOrgGameUpdate[]>([]);
  const [isLoadingArchiveModal, setIsLoadingArchiveModal] = useState(false);
  const [isInstallingArchiveDirect, setIsInstallingArchiveDirect] = useState(false);
  const [installingArchiveUrl, setInstallingArchiveUrl] = useState<string | null>(null);

  const registry = registryData as RegistryItem[];

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setActivityLogs((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 50)]);
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

  // Atajo de teclado ⌘K / Ctrl+K para buscar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Comprobar actualización de Tooly Desktop
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
      if (!silent) addLog(`Error al comprobar versión de Tooly: ${err}`);
    } finally {
      setIsCheckingAppUpdate(false);
    }
  };

  useEffect(() => {
    handleCheckAppUpdate(true);
  }, []);

  // Auto-descubrimiento en subred LAN
  const handleDiscoverPs5 = async () => {
    setIsDiscovering(true);
    addLog(t.logDiscovering);
    try {
      const baseHint = ps5Ip.trim().length > 0 ? ps5Ip.trim() : undefined;
      const discovered = await tauriApi.discoverPs5Consoles(baseHint);
      if (discovered.length > 0) {
        const selected = discovered[0];
        setPs5Ip(selected.ip);
        addLog(t.logDiscoveredSuccess(discovered.length, selected.ip));
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
      // Verificar estado de servicios en paralelo
      tauriApi.checkPs5Services(targetIp).then((services) => {
        setConsoleServices(services);
      }).catch(() => {});

      const apps = await tauriApi.scanPs5Apps(targetIp);
      setInstalledApps(apps);
      setConsoleServices((prev) => (prev ? { ...prev, ftp_open: true } : { ftp_open: true, payload_manager_open: false, elf_loader_port: null }));
      addLog(t.logFtpDone(apps.length));
      await evaluateUpdates(apps);
    } catch (err: any) {
      addLog(t.logFtpError(String(err)));
      // Si el FTP falló, comprobar si Payload Manager o el ELF loader están activos para orientar al usuario
      try {
        const services = await tauriApi.checkPs5Services(targetIp);
        setConsoleServices(services);
      } catch (_) {}
    } finally {
      setIsScanningFtp(false);
    }
  };

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

          const hasCompatibleAsset =
            rel.assets &&
            rel.assets.some((a) => {
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

    // Búsqueda background en Archive.org para CUSA / PPSA
    for (const app of apps) {
      const isCommercialGame =
        (app.title_id.startsWith("CUSA") || app.title_id.startsWith("PPSA")) &&
        !app.title_id.startsWith("PAYLOAD_");
      if (isCommercialGame) {
        tauriApi
          .searchArchiveUpdates(app.title_id, app.app_name, app.app_ver)
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
          .catch(() => {});
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

  // Escanear Payloads Locales
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

  // Disparar instalación DPI desde GitHub Release
  const handleTriggerUpdate = async (app: InstalledApp) => {
    const state = updatesState[app.title_id];
    if (!state || !state.latestRelease) return;

    const assets = state.latestRelease.assets || [];
    const reg = state.registry;

    let targetAsset = assets.find((a) => {
      if (reg?.assetPattern) {
        try {
          return new RegExp(reg.assetPattern, "i").test(a.name);
        } catch (_) {}
      }
      return a.name.toLowerCase().endsWith(".pkg");
    });

    if (!targetAsset) {
      targetAsset = assets.find(
        (a) => a.name.toLowerCase().endsWith(".bin") || a.name.toLowerCase().endsWith(".elf")
      );
    }

    if (!targetAsset) {
      addLog(t.logNoPkgFound(state.latestRelease.tag_name));
      return;
    }

    setUpdatingId(app.title_id);
    addLog(`Iniciando actualización para ${app.app_name || app.title_id} -> ${targetAsset.name}...`);

    try {
      const res = await tauriApi.triggerDpiUpdate(ps5Ip, targetAsset.browser_download_url, targetAsset.name);
      addLog(t.logDpiSuccess(targetAsset.name) + (res.message ? ` (${res.message})` : ""));
    } catch (err: any) {
      addLog(t.logDpiError(targetAsset.name) + `: ${err}`);
    } finally {
      setUpdatingId(null);
      setProgressState(null);
    }
  };

  // Inyectar / Arrancar Servidor FTP
  const handleInjectFtpServer = async () => {
    if (!ps5Ip.trim()) return;
    setIsInjectingFtp(true);
    addLog(t.logInjectingFtp(ps5Ip));

    // Buscar si hay un ftpsrv.elf en la carpeta local de payloads escaneada
    const localFtp = localPayloads.find((p) => {
      const name = p.file_name.toLowerCase();
      return name.includes("ftpsrv") || name.includes("ftps5");
    });

    try {
      const msg = await tauriApi.injectFtpServer(ps5Ip, undefined, localFtp?.full_path);
      addLog(t.logFtpInjectDone(msg));
      setConsoleServices((prev) => (prev ? { ...prev, ftp_open: true } : { ftp_open: true, payload_manager_open: false, elf_loader_port: null }));
      // Disparar escaneo automático tras arranque de FTP
      setTimeout(() => {
        handleScanPs5WithIp(ps5Ip);
      }, 500);
    } catch (err: any) {
      addLog(t.logFtpInjectError(String(err)));
    } finally {
      setIsInjectingFtp(false);
    }
  };

  // Enviar payload local por socket TCP (puerto 9021 o 9020)
  const handleSendPayloadToPs5 = async (payload: LocalPayload) => {
    if (!ps5Ip.trim()) return;
    setIsSendingPayload(true);
    const targetPort = consoleServices?.elf_loader_port || 9021;
    addLog(t.logInjectingPayload(payload.file_name, ps5Ip, targetPort));
    try {
      const res = await tauriApi.injectLocalPayload(ps5Ip, targetPort, payload.full_path);
      addLog(t.logPayloadInjectSuccess(payload.file_name, targetPort) + ` (${res})`);
    } catch (err: any) {
      addLog(t.logPayloadInjectError(String(err)));
    } finally {
      setIsSendingPayload(false);
    }
  };

  // Escuchar eventos de progreso de descarga DPI en tiempo real
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<DownloadProgressPayload>("dpi-download-progress", (event) => {
      setProgressState(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Filtrado de aplicaciones
  const filteredApps = installedApps.filter((app) => {
    const state = updatesState[app.title_id];
    const name = (app.app_name || state?.registry?.name || app.title_id).toLowerCase();
    const matchesSearch =
      searchQuery.trim() === "" ||
      name.includes(searchQuery.toLowerCase()) ||
      app.title_id.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === "updates") return state?.hasUpdate;
    if (activeFilter === "homebrew") {
      return !app.title_id.startsWith("CUSA") && !app.title_id.startsWith("PPSA");
    }
    if (activeFilter === "games") {
      return app.title_id.startsWith("CUSA") || app.title_id.startsWith("PPSA");
    }

    return true;
  });

  const updatesCount = Object.values(updatesState).filter((s) => s.hasUpdate).length;

  // App destacada para el Showcase Banner superior (la primera con actualización disponible)
  const featuredApp =
    installedApps.find((app) => updatesState[app.title_id]?.hasUpdate) ||
    installedApps[0] ||
    null;

  const featuredState = featuredApp ? updatesState[featuredApp.title_id] : null;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#111318] text-[#eceff4] select-none overflow-hidden font-sans">
      {/* Top Header Bar (72px) */}
      <header className="h-[72px] px-8 bg-[#151821] border-b border-[#212634] flex items-center justify-between shrink-0 gap-4 z-20">
        {/* Brand & Tabs */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-lg tracking-[2px] text-white">TOOLY</h1>
            <span className="text-[10px] font-mono text-[#828fa3] tracking-wide">
              // PS5 STUDIO
            </span>
          </div>

          <PsSymbols className="hidden xl:flex opacity-60" />

          {/* Navigation Pills */}
          <nav className="flex items-center gap-1.5 p-1 rounded-full bg-[#111318] border border-[#212634]">
            <button
              onClick={() => setActiveFilter("all")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeFilter === "all"
                  ? "bg-[#222736] text-[#eceff4]"
                  : "text-[#828fa3] hover:text-[#eceff4]"
              }`}
            >
              Library
            </button>
            <button
              onClick={() => setActiveFilter("updates")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeFilter === "updates"
                  ? "bg-[#2c2317] text-[#d49b4b] border border-[#523d20]"
                  : "text-[#828fa3] hover:text-[#eceff4]"
              }`}
            >
              <span>Updates</span>
              {updatesCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#d49b4b] text-[#111318] font-mono font-bold">
                  {updatesCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setIsPayloadsDrawerOpen(true)}
              className="px-3.5 py-1.5 rounded-full text-xs text-[#828fa3] hover:text-[#eceff4] hover:bg-[#1a1e2b] transition-all cursor-pointer flex items-center gap-1"
            >
              <FileCode2 className="w-3.5 h-3.5 text-[#7e6e9c]" />
              <span>Payloads</span>
              {localPayloads.length > 0 && (
                <span className="text-[10px] font-mono text-[#7e6e9c]">({localPayloads.length})</span>
              )}
            </button>
            <button
              onClick={() => setIsLogsDrawerOpen(true)}
              className="px-3.5 py-1.5 rounded-full text-xs text-[#828fa3] hover:text-[#eceff4] hover:bg-[#1a1e2b] transition-all cursor-pointer flex items-center gap-1"
            >
              <Terminal className="w-3.5 h-3.5 text-[#4e9a78]" />
              <span>Logs</span>
            </button>
          </nav>
        </div>

        {/* Center: Search & Command Bar */}
        <div className="relative w-64 lg:w-72 hidden md:block">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#546075]" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search games & CUSA..."
            className="w-full bg-[#191c26] border border-[#262c3d] rounded-full pl-9 pr-12 py-1.5 text-xs text-[#eceff4] placeholder:text-[#546075] focus:outline-none focus:border-[#3b5b8e] transition-all"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#222736] text-[#828fa3] border border-[#2c3346]">
            ⌘K
          </span>
        </div>

        {/* Right: PS5 Console Connection Pill & Actions */}
        <div className="flex items-center gap-3">
          {/* Botón rápido Inyectar FTP si se detecta caído o si el usuario quiere arrancarlo */}
          {consoleServices && !consoleServices.ftp_open && (
            <button
              onClick={handleInjectFtpServer}
              disabled={isInjectingFtp || isScanningFtp}
              title={
                consoleServices.payload_manager_open
                  ? `${t.injectFtpBtn} (${t.payloadManagerDetected})`
                  : consoleServices.elf_loader_port
                  ? `${t.injectFtpBtn} (${t.elfLoaderDetected} :${consoleServices.elf_loader_port})`
                  : t.injectFtpBtn
              }
              className="px-3 py-1.5 rounded-full bg-[#372412] hover:bg-[#4d3217] border border-[#7a4c1f] text-[#f2a859] hover:text-[#ffd699] text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50 animate-pulse"
            >
              <Zap className={`w-3.5 h-3.5 ${isInjectingFtp ? "animate-spin" : "text-[#f2a859]"}`} />
              <span>{isInjectingFtp ? t.injectingFtp : t.injectFtpBtn}</span>
            </button>
          )}

          <div className="flex items-center gap-2 pl-3 pr-1 py-1 rounded-full bg-[#191c26] border border-[#262c3d]">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                consoleServices?.ftp_open
                  ? "bg-[#4e9a78]"
                  : consoleServices && !consoleServices.ftp_open
                  ? "bg-[#d49b4b]"
                  : "bg-[#4e9a78]"
              }`}
            ></span>
            <input
              type="text"
              value={ps5Ip}
              onChange={(e) => setPs5Ip(e.target.value)}
              placeholder="192.168.1.xxx"
              className="w-28 bg-transparent text-xs font-mono font-bold text-[#eceff4] focus:outline-none"
            />
            <button
              onClick={handleDiscoverPs5}
              disabled={isDiscovering || isScanningFtp}
              title={t.autoDetectTooltip}
              className="p-1 rounded-full text-[#6b94bd] hover:text-white hover:bg-[#222736] transition-colors cursor-pointer"
            >
              <Radar className={`w-3.5 h-3.5 ${isDiscovering ? "animate-spin text-[#d49b4b]" : ""}`} />
            </button>
            <button
              onClick={handleScanPs5}
              disabled={isScanningFtp || isDiscovering}
              className="px-3 py-1 bg-[#242a3a] hover:bg-[#2e364a] text-[#6b94bd] hover:text-white text-[11px] font-mono font-bold rounded-full transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3 h-3 ${isScanningFtp ? "animate-spin text-[#6b94bd]" : ""}`} />
              <span>{isScanningFtp ? t.scanning : "SCAN"}</span>
            </button>
          </div>

          {/* Selector de idioma ES/EN */}
          <button
            onClick={handleToggleLanguage}
            title={lang === "es" ? "Switch to English" : "Cambiar a Español"}
            className="px-2.5 py-1.5 rounded-full bg-[#191c26] hover:bg-[#222736] border border-[#262c3d] text-xs font-mono font-bold text-[#eceff4] transition-colors cursor-pointer"
          >
            {lang.toUpperCase()}
          </button>

          {/* Tooly update badge */}
          {appUpdate?.has_update && (
            <a
              href="https://github.com/Thefederico/tooly/releases"
              target="_blank"
              rel="noreferrer"
              title={`${t.toolyUpdateAvailable} ${appUpdate.latest_version}`}
              className="px-2.5 py-1 rounded-full bg-[#2c2317] border border-[#523d20] text-[#d49b4b] text-[10px] font-mono font-bold flex items-center gap-1"
            >
              <ArrowUpCircle className="w-3 h-3" />
              <span>v{appUpdate.latest_version}</span>
            </a>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-8 py-6 flex flex-col gap-6">
        {/* Featured Showcase Hero Banner (Si hay apps escaneadas) */}
        {featuredApp && (
          <section className="w-full rounded-2xl bg-[#171b26] border border-[#262d3e] p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 shadow-sm">
            <div className="flex items-center gap-5">
              {/* Cover Art Box */}
              <div className="w-32 h-32 rounded-xl bg-[#1e2536] border border-[#2b354c] flex flex-col items-center justify-center p-3 shrink-0 text-center">
                <span className="font-bold text-lg tracking-tight text-[#eceff4] truncate max-w-full">
                  {featuredApp.app_name || featuredState?.registry?.name || featuredApp.title_id}
                </span>
                <span className="text-[11px] font-mono text-[#6b8eb6] mt-1">
                  {featuredApp.app_ver || "v1.00"}
                </span>
                <span className="mt-2 px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-[#26203b] text-[#8e82b3] border border-[#372d54]">
                  {featuredApp.title_id.startsWith("CUSA") ? "PS4 GAME" : "PS5 HOMEBREW"}
                </span>
              </div>

              {/* Showcase Info */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 ${
                      featuredState?.hasUpdate
                        ? "bg-[#2c2317] text-[#d49b4b] border border-[#523d20]"
                        : "bg-[#193125] text-[#4e9a78] border border-[#264d39]"
                    }`}
                  >
                    {featuredState?.hasUpdate ? "● UPDATE AVAILABLE" : "● UP TO DATE"}
                  </span>
                  <span className="text-xs font-mono text-[#64748b]">
                    {featuredApp.title_id}
                  </span>
                </div>

                <h2 className="text-xl font-bold text-[#eceff4]">
                  {featuredApp.app_name || featuredState?.registry?.name || featuredApp.title_id}
                </h2>

                <p className="text-xs text-[#828fa3] max-w-2xl leading-relaxed">
                  {featuredState?.registry?.githubRepo
                    ? `Repository: ${featuredState.registry.githubRepo} · Remote PARAM.SFO verified`
                    : "Installed in console storage (/user/app) · Ready for DPI operations"}
                </p>

                <div className="flex items-center gap-3 text-[11px] font-mono text-[#94a3b8] mt-1">
                  <span>Installed: v{featuredApp.app_ver}</span>
                  {featuredState?.latestRelease && (
                    <>
                      <span>→</span>
                      <span className="text-[#d49b4b] font-bold">
                        Latest: {featuredState.latestRelease.tag_name}
                      </span>
                    </>
                  )}
                  <span>·</span>
                  <span className="text-[#64748b]">Target: PS5 DPI (:12800)</span>
                </div>
              </div>
            </div>

            {/* Showcase Action Button */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 w-full lg:w-56">
              {featuredState?.hasUpdate ? (
                <button
                  onClick={() => handleTriggerUpdate(featuredApp)}
                  disabled={updatingId === featuredApp.title_id}
                  className="w-full py-2.5 px-4 bg-[#3b5b8e] hover:bg-[#4a6fa8] active:scale-[0.99] text-[#eceff4] text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                  <span>
                    {updatingId === featuredApp.title_id ? t.installingBtn : "1-CLICK INSTALL (DPI)"}
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => handleTriggerUpdate(featuredApp)}
                  className="w-full py-2.5 px-4 bg-[#1d2230] hover:bg-[#262c3d] text-[#eceff4] border border-[#2a3245] text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#828fa3]" />
                  <span>REINSTALL / PUSH PKG</span>
                </button>
              )}

              {featuredState?.registry?.githubRepo && (
                <a
                  href={`https://github.com/${featuredState.registry.githubRepo}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2 px-3 bg-[#171b26] hover:bg-[#1f2433] text-[#828fa3] hover:text-[#eceff4] border border-[#262d3e] text-xs font-mono rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>GitHub Releases</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </section>
        )}

        {/* Library Sub-header & Filter Tabs */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-[#eceff4]">CONSOLE LIBRARY</h2>
            <span className="text-xs text-[#64748b]">
              ({installedApps.length} {t.appsDetected.toLowerCase()})
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center p-0.5 rounded-xl bg-[#151821] border border-[#212634] text-xs">
              <button
                onClick={() => setActiveFilter("all")}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  activeFilter === "all"
                    ? "bg-[#222736] text-[#eceff4]"
                    : "text-[#828fa3] hover:text-[#eceff4]"
                }`}
              >
                All ({installedApps.length})
              </button>
              <button
                onClick={() => setActiveFilter("updates")}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  activeFilter === "updates"
                    ? "bg-[#2c2317] text-[#d49b4b]"
                    : "text-[#828fa3] hover:text-[#eceff4]"
                }`}
              >
                Updates ({updatesCount})
              </button>
              <button
                onClick={() => setActiveFilter("homebrew")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  activeFilter === "homebrew"
                    ? "bg-[#222736] text-[#eceff4]"
                    : "text-[#828fa3] hover:text-[#eceff4]"
                }`}
              >
                Homebrew
              </button>
              <button
                onClick={() => setActiveFilter("games")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  activeFilter === "games"
                    ? "bg-[#222736] text-[#eceff4]"
                    : "text-[#828fa3] hover:text-[#eceff4]"
                }`}
              >
                Games
              </button>
            </div>

            <button
              onClick={handleScanPs5}
              disabled={isScanningFtp}
              className="px-3 py-1.5 bg-[#1a1e2b] hover:bg-[#222737] border border-[#262c3d] rounded-xl text-xs font-mono text-[#eceff4] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanningFtp ? "animate-spin text-[#6b94bd]" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </section>

        {/* Gallery Cards Grid */}
        {installedApps.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center border border-dashed border-[#222737] rounded-2xl text-center px-6 bg-[#13161f]">
            <Layers className="w-12 h-12 text-[#546075] mb-3" />
            <h3 className="font-bold text-[#eceff4] text-base">{t.noAppsTitle}</h3>
            <p className="text-xs text-[#828fa3] max-w-md mt-1 leading-relaxed">
              {t.noAppsDesc}
            </p>

            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={handleScanPs5}
                disabled={isScanningFtp || isInjectingFtp}
                className="px-6 py-2.5 bg-[#3b5b8e] hover:bg-[#4a6fa8] text-[#eceff4] font-bold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanningFtp ? "animate-spin" : ""}`} />
                <span>{isScanningFtp ? t.scanningConsole : t.scanPs5Now}</span>
              </button>

              <button
                onClick={handleInjectFtpServer}
                disabled={isInjectingFtp || isScanningFtp}
                className="px-5 py-2.5 bg-[#2c1d0e] hover:bg-[#3d2914] border border-[#6b4217] text-[#e59b4c] font-bold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <Zap className={`w-3.5 h-3.5 ${isInjectingFtp ? "animate-spin" : "text-[#d49b4b]"}`} />
                <span>{isInjectingFtp ? t.injectingFtp : t.injectFtpBtn}</span>
              </button>
            </div>
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="py-20 text-center text-xs text-[#64748b] italic">
            No applications match the current filter or search criteria.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredApps.map((app) => {
              const state = updatesState[app.title_id];
              const hasUpdate = state?.hasUpdate;
              const hasArchiveUpdates = state?.archiveUpdates && state.archiveUpdates.length > 0;
              const isCommercial = app.title_id.startsWith("CUSA") || app.title_id.startsWith("PPSA");

              // Color mate temático para la portada
              const coverBg = isCommercial
                ? "bg-[#221b26]" // Mate ciruela para juegos comerciales
                : hasUpdate
                ? "bg-[#262016]" // Mate bronce para apps con update
                : "bg-[#16231d]"; // Mate pino para homebrew al día

              return (
                <div
                  key={app.title_id}
                  className="rounded-2xl bg-[#151822] border border-[#222737] hover:border-[#2e364c] transition-all flex flex-col overflow-hidden shadow-sm"
                >
                  {/* Poster Area (180px) */}
                  <div className={`h-44 ${coverBg} p-4 flex flex-col justify-between relative`}>
                    {/* Floating Status Badge */}
                    <div className="flex items-center justify-between gap-2">
                      {hasUpdate ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#2c2317] text-[#d49b4b] border border-[#523d20]">
                          UPDATE READY
                        </span>
                      ) : hasArchiveUpdates ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#1c2735] text-[#6692b0] border border-[#2b3d52]">
                          ARCHIVE.ORG ({state.archiveUpdates?.length})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#193125] text-[#4e9a78] border border-[#264d39]">
                          ● UP TO DATE
                        </span>
                      )}

                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#111318]/70 text-[#828fa3]">
                        {isCommercial ? "GAME" : "HOMEBREW"}
                      </span>
                    </div>

                    {/* Emblem & Title in Cover */}
                    <div>
                      <h4 className="font-bold text-base text-[#eceff4] truncate">
                        {app.app_name || state?.registry?.name || app.title_id}
                      </h4>
                      <p className="text-[10px] font-mono text-[#828fa3] mt-0.5">
                        {app.title_id} · {app.app_ver ? `v${app.app_ver}` : "v1.00"}
                      </p>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between gap-3 bg-[#151822]">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-[#eceff4] truncate">
                        {app.app_name || state?.registry?.name || app.title_id}
                      </span>
                      <div className="flex items-center justify-between text-[11px] font-mono text-[#828fa3]">
                        <span>Installed: v{app.app_ver || "1.00"}</span>
                        {state?.latestRelease && (
                          <span className="text-[#d49b4b] font-bold">
                            {state.latestRelease.tag_name}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#546075] truncate mt-1">
                        /user/app/{app.title_id}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-1.5 pt-2 border-t border-[#1f2433]">
                      {hasUpdate ? (
                        <button
                          onClick={() => handleTriggerUpdate(app)}
                          disabled={updatingId === app.title_id}
                          className="w-full py-2 bg-[#3b5b8e] hover:bg-[#4a6fa8] text-[#eceff4] text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <ArrowDownToLine className="w-3.5 h-3.5" />
                          <span>{updatingId === app.title_id ? t.installingBtn : "UPDATE (DPI)"}</span>
                        </button>
                      ) : isCommercial ? (
                        <button
                          onClick={() => handleOpenArchiveModal(app)}
                          className="w-full py-2 bg-[#2c5874] hover:bg-[#396e91] text-[#eceff4] text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Database className="w-3.5 h-3.5 text-[#6692b0]" />
                          <span>ARCHIVE UPDATES</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleTriggerUpdate(app)}
                          className="w-full py-2 bg-[#1d2230] hover:bg-[#252c3d] text-[#828fa3] hover:text-[#eceff4] border border-[#2a3245] text-xs font-mono font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>REINSTALL</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Bottom Floating Telemetry & Progress Dock (68px) */}
      <footer className="h-[68px] px-8 bg-[#13161f] border-t border-[#212634] flex items-center justify-between shrink-0 gap-6 z-20">
        {/* Left: Console Link info */}
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-[#4e9a78] shrink-0"></span>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[#eceff4]">
              {progressState
                ? `TRANSFERRING ${progressState.file_name} VIA DPI`
                : `PS5 CONNECTED (${ps5Ip})`}
            </span>
            <span className="text-[10px] font-mono text-[#64748b]">
              FTP: :2121 · DPI: :12800 · TCP: :9090
            </span>
          </div>
        </div>

        {/* Center: Live Progress Bar if active */}
        {progressState ? (
          <div className="flex-1 max-w-xl flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#eceff4] font-bold">
                {progressState.status === "downloading"
                  ? `${t.downloading} ${progressState.file_name}`
                  : progressState.status === "starting_dpi_server"
                  ? t.startingDpiServer
                  : progressState.status === "triggering_dpi"
                  ? t.triggeringDpi
                  : t.processingUpdate}
              </span>
              <span className="text-[#648bae] font-bold">
                {progressState.percentage.toFixed(1)}% ·{" "}
                {(progressState.downloaded_bytes / (1024 * 1024)).toFixed(1)} MB
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#191e2a] overflow-hidden">
              <div
                className="h-full bg-[#3b5b8e] transition-all duration-200"
                style={{ width: `${Math.min(100, Math.max(0, progressState.percentage))}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="hidden md:flex items-center gap-4 text-xs font-mono text-[#64748b]">
            <span>Local LAN HTTP Server: Standby</span>
            <span>·</span>
            <span>Direct Package Installer: Ready</span>
          </div>
        )}

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
        onCopyLogs={handleCopyLogs}
        isCopied={isCopied}
        lang={lang}
      />

      <ArchiveUpdatesModal
        isOpen={isArchiveModalOpen}
        onClose={() => setIsArchiveModalOpen(false)}
        titleId={selectedArchiveApp?.titleId || ""}
        gameName={selectedArchiveApp?.name || ""}
        updates={activeArchiveUpdates}
        isLoading={isLoadingArchiveModal}
        onInstallDirect={handleInstallArchiveDirect}
        isInstalling={isInstallingArchiveDirect}
        installingUrl={installingArchiveUrl}
        lang={lang}
      />
    </div>
  );
}
export default Dashboard;
