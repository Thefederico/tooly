import React from "react";
import {
  Layers,
  DownloadCloud,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Database,
} from "lucide-react";
import { useAppStore, AppUpdateStatus } from "../stores/use-app-store";
import { translations } from "../lib/i18n";
import { InstalledApp, DownloadProgressPayload } from "../lib/types";

interface AppGridProps {
  installedApps: InstalledApp[];
  updatesState: Record<string, AppUpdateStatus>;
  updatingId: string | null;
  progressState: DownloadProgressPayload | null;
  isScanningFtp: boolean;
  onScanPs5: () => void;
  onUpdateApp: (titleId: string) => void;
  onOpenArchiveModal: (app: InstalledApp) => void;
}

export function AppGrid({
  installedApps,
  updatesState,
  updatingId,
  progressState,
  isScanningFtp,
  onScanPs5,
  onUpdateApp,
  onOpenArchiveModal,
}: AppGridProps) {
  const lang = useAppStore((state) => state.lang);
  const t = translations[lang];

  const pendingUpdatesCount = Object.values(updatesState).filter((s) => s.hasUpdate).length;

  return (
    <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4 flex-1">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-lg text-slate-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            {t.installedAppsTitle}
          </h2>
          <p className="text-xs text-slate-400">{t.installedAppsSubtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">
            {pendingUpdatesCount} {t.pendingUpdates}
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
          <p className="text-xs text-slate-400 max-w-md mt-1 leading-relaxed">{t.noAppsDesc}</p>
          <button
            onClick={onScanPs5}
            disabled={isScanningFtp}
            className="btn-ps-primary mt-4 px-6 py-2.5 text-xs gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanningFtp ? "animate-spin" : ""}`} />
            <span>{isScanningFtp ? t.scanningConsole : t.scanPs5Now}</span>
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

                  <div className="flex items-center gap-2 ml-auto">
                    {/* Botón Archive.org para juegos comerciales */}
                    {(app.title_id.startsWith("CUSA") || app.title_id.startsWith("PPSA")) &&
                      !app.title_id.startsWith("PAYLOAD_") && (
                        <button
                          onClick={() => onOpenArchiveModal(app)}
                          title={t.archiveUpdatesBtn}
                          className="btn-ps-archive px-3 py-1.5 text-xs gap-1.5"
                        >
                          <Database className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Archive.org</span>
                          {state?.archiveUpdates && state.archiveUpdates.length > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-cyan-400/20 text-cyan-200 font-mono text-[9px] font-bold">
                              {state.archiveUpdates.length}
                            </span>
                          )}
                        </button>
                      )}

                    {hasUpdate && state?.latestRelease && (
                      <button
                        onClick={() => onUpdateApp(app.title_id)}
                        disabled={isUpdating}
                        className="btn-ps-primary px-3.5 py-1.5 text-xs gap-1.5"
                      >
                        <DownloadCloud className={`w-3.5 h-3.5 ${isUpdating ? "animate-bounce" : ""}`} />
                        <span>
                          {isUpdating
                            ? t.installingBtn
                            : state.latestRelease.assets.some((a) => a.name.toLowerCase().endsWith(".pkg"))
                            ? t.updateBtn
                            : "ZIP Release"}
                        </span>
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
  );
}
