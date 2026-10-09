import { useCallback } from "react";
import registryData from "../data/registry.json";
import { useAppStore, AppUpdateStatus } from "../stores/use-app-store";
import { tauriApi } from "../lib/tauri-client";
import { translations } from "../lib/i18n";
import { InstalledApp, RegistryItem, formatToolyError } from "../lib/types";
import { isValidIpv4, isNewerVersion } from "../lib/utils";

const registry = registryData as RegistryItem[];

export function useUpdateEngine() {
  const lang = useAppStore((state) => state.lang);
  const ps5Ip = useAppStore((state) => state.ps5Ip);
  const installedApps = useAppStore((state) => state.installedApps);
  const setInstalledApps = useAppStore((state) => state.setInstalledApps);
  const updatesState = useAppStore((state) => state.updatesState);
  const setUpdatesState = useAppStore((state) => state.setUpdatesState);
  const updateAppStatus = useAppStore((state) => state.updateAppStatus);
  const isScanningFtp = useAppStore((state) => state.isScanningFtp);
  const setIsScanningFtp = useAppStore((state) => state.setIsScanningFtp);
  const setHasDiscoveredConsole = useAppStore((state) => state.setHasDiscoveredConsole);
  const updatingId = useAppStore((state) => state.updatingId);
  const setUpdatingId = useAppStore((state) => state.setUpdatingId);
  const progressState = useAppStore((state) => state.progressState);
  const setProgressState = useAppStore((state) => state.setProgressState);
  const appUpdate = useAppStore((state) => state.appUpdate);
  const setAppUpdate = useAppStore((state) => state.setAppUpdate);
  const isCheckingAppUpdate = useAppStore((state) => state.isCheckingAppUpdate);
  const setIsCheckingAppUpdate = useAppStore((state) => state.setIsCheckingAppUpdate);
  const addLog = useAppStore((state) => state.addLog);
  const openArchiveModal = useAppStore((state) => state.openArchiveModal);
  const setArchiveModal = useAppStore((state) => state.setArchiveModal);

  const t = translations[lang];

  // Self-update check for Tooly Desktop
  const checkToolyAppUpdate = useCallback(
    async (silent = false) => {
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
        return updateInfo;
      } catch (err: unknown) {
        if (!silent) {
          addLog(`Error al comprobar versión de Tooly: ${formatToolyError(err)}`);
        }
        return null;
      } finally {
        setIsCheckingAppUpdate(false);
      }
    },
    [t, addLog, setAppUpdate, setIsCheckingAppUpdate]
  );

  // Evaluate updates against GitHub Releases & Archive.org
  const evaluateUpdates = useCallback(
    async (apps: InstalledApp[]) => {
      const stateMap: Record<string, AppUpdateStatus> = {};
      const repoMap: Map<string, { app: InstalledApp; reg: RegistryItem }> = new Map();

      // 1. Mapear apps registradas que tienen repositorio en GitHub
      for (const app of apps) {
        const reg = registry.find((r) => r.titleId?.toUpperCase() === app.title_id.toUpperCase());
        const isPayload = app.title_id.startsWith("PAYLOAD_");
        if (reg && reg.githubRepo) {
          repoMap.set(reg.githubRepo.toLowerCase(), { app, reg });
        } else {
          stateMap[app.title_id] = {
            installed: app,
            registry: reg,
            hasUpdate: false,
            statusText: isPayload ? t.standalonePayload : t.statusNoMapping,
          };
        }
      }

      // 2. Ejecutar batching concurrente a través del backend de Rust con caché TTL
      const uniqueRepos = Array.from(repoMap.keys());
      if (uniqueRepos.length > 0) {
        addLog(`Comprobando ${uniqueRepos.length} repositorios en GitHub (concurrencia y caché)...`);
        try {
          const batchResults = await tauriApi.checkBatchGitHubUpdates(uniqueRepos, 4);
          const resultMap = new Map(batchResults);

          for (const [repoKey, { app, reg }] of repoMap.entries()) {
            const rel = resultMap.get(repoKey);
            if (rel) {
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

              const isNewer = isNewerVersion(app.app_ver, rel.tag_name, rel.name);
              const hasUpdate = isNewer && Boolean(hasCompatibleAsset);

              stateMap[app.title_id] = {
                installed: app,
                registry: reg,
                latestRelease: rel,
                hasUpdate,
                statusText: hasUpdate
                  ? `${t.updateAvailable} ${rel.name || rel.tag_name}`
                  : isNewer && !hasCompatibleAsset
                  ? `${rel.tag_name} (${t.noDirectPkg})`
                  : t.upToDateBadge,
              };
            } else {
              stateMap[app.title_id] = {
                installed: app,
                registry: reg,
                hasUpdate: false,
                statusText: t.statusGithubError,
              };
            }
          }
        } catch (err: unknown) {
          addLog(`Error en comprobación de actualizaciones por lote: ${formatToolyError(err)}`);
        }
      }

      setUpdatesState(stateMap);

      // Búsqueda en segundo plano en Archive.org para juegos comerciales (excluyendo homebrews del registro)
      for (const app of apps) {
        const isRegisteredHomebrew = registry.some(
          (r) => r.titleId?.toUpperCase() === app.title_id.toUpperCase()
        );
        const isCommercialGame =
          (app.title_id.startsWith("CUSA") || app.title_id.startsWith("PPSA")) &&
          !app.title_id.startsWith("PAYLOAD_") &&
          !isRegisteredHomebrew;
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
            .catch(() => {
              // Silencioso en background
            });
        }
      }
    },
    [t, addLog, setUpdatesState]
  );

  // Scan PS5 via FTP
  const scanPs5 = useCallback(
    async (targetIp?: string) => {
      const ip = (targetIp || ps5Ip).trim();
      if (!ip) {
        addLog(
          lang === "es"
            ? "⚠️ No hay IP de PS5 configurada. Usa Auto-Detectar o ingresa una IP manual."
            : "⚠️ No PS5 IP configured. Run Auto-Detect or enter a manual IP."
        );
        return [];
      }
      if (!isValidIpv4(ip)) {
        addLog(
          lang === "es"
            ? `⚠️ Dirección IP inválida: '${ip}'. Se requiere formato IPv4 (ej. 192.168.1.45).`
            : `⚠️ Invalid IP address: '${ip}'. A valid IPv4 is required (e.g. 192.168.1.45).`
        );
        return [];
      }
      setIsScanningFtp(true);
      addLog(t.logConnectingFtp(ip));
      try {
        const apps = await tauriApi.scanPs5Apps(ip);
        setInstalledApps(apps);
        setHasDiscoveredConsole(true);
        addLog(t.logFtpDone(apps.length));
        await evaluateUpdates(apps);
        return apps;
      } catch (err: unknown) {
        setHasDiscoveredConsole(false);
        addLog(t.logFtpError(formatToolyError(err)));
        return [];
      } finally {
        setIsScanningFtp(false);
      }
    },
    [ps5Ip, lang, t, addLog, setInstalledApps, setHasDiscoveredConsole, setIsScanningFtp, evaluateUpdates]
  );

  // Update specific app or payload
  const updateApp = useCallback(
    async (titleId: string) => {
      const item = updatesState[titleId];
      if (!item || !item.latestRelease || !item.latestRelease.assets.length) return;

      const isPayload =
        titleId.startsWith("PAYLOAD_") ||
        item.registry?.category === "payload" ||
        item.registry?.assetPattern?.includes("elf") ||
        item.registry?.assetPattern?.includes("bin");

      if (isPayload) {
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
          // Actualizar versión en la lista de apps
          setInstalledApps((prev) =>
            prev.map((a) =>
              a.title_id === titleId
                ? { ...a, app_ver: item.latestRelease!.tag_name.replace(/^[vV]/, "") }
                : a
            )
          );
          updateAppStatus(titleId, {
            hasUpdate: false,
            statusText: t.upToDateBadge,
          });
        } catch (err: unknown) {
          addLog(`Error actualizando payload: ${formatToolyError(err)}`);
        } finally {
          setUpdatingId(null);
        }
        return;
      }

      // Flujo PKG regular mediante DPI
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
          addLog(
            `[Homebrew ZIP] ${item.installed?.app_name || titleId} (${item.latestRelease.tag_name}) se distribuye como paquete ZIP (${zipAsset.name}). Abriendo descarga directa para /data/homebrew/...`
          );
          try {
            const { openUrl } = await import("@tauri-apps/plugin-opener");
            await openUrl(zipAsset.browser_download_url);
          } catch (_) {
            window.open(zipAsset.browser_download_url, "_blank");
          }
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
      } catch (err: unknown) {
        addLog(formatToolyError(err));
      } finally {
        setUpdatingId(null);
      }
    },
    [updatesState, ps5Ip, t, addLog, setUpdatingId, setInstalledApps, updateAppStatus, setProgressState]
  );

  // Trigger modal open & search for Archive.org updates
  const handleOpenArchiveModal = useCallback(
    async (app: InstalledApp) => {
      const existingUpdates = updatesState[app.title_id]?.archiveUpdates;
      openArchiveModal(app, existingUpdates);

      if (!existingUpdates || existingUpdates.length === 0) {
        setArchiveModal({ isLoading: true });
        try {
          const results = await tauriApi.searchArchiveUpdates(app.title_id, app.app_name, app.app_ver);
          setArchiveModal({ updates: results });
          updateAppStatus(app.title_id, { archiveUpdates: results });
        } catch (err: unknown) {
          addLog(`Error buscando en Archive.org: ${formatToolyError(err)}`);
        } finally {
          setArchiveModal({ isLoading: false });
        }
      }
    },
    [updatesState, openArchiveModal, setArchiveModal, updateAppStatus, addLog]
  );

  // Install direct update from Archive.org
  const handleInstallArchiveDirect = useCallback(
    async (downloadUrl: string, fileName: string) => {
      if (!ps5Ip.trim()) return;
      setArchiveModal({ isInstallingDirect: true, installingUrl: downloadUrl });
      addLog(`Enviando instalación directa a PS5 DPI (${fileName})...`);

      try {
        const res = await tauriApi.installArchiveUpdateDirect(ps5Ip, downloadUrl);
        addLog(res.message);
      } catch (err: unknown) {
        addLog(`Error en instalación directa DPI: ${formatToolyError(err)}`);
      } finally {
        setArchiveModal({ isInstallingDirect: false, installingUrl: null });
      }
    },
    [ps5Ip, setArchiveModal, addLog]
  );

  return {
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
  };
}
