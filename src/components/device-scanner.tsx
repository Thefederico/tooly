import { Wifi, Radar, RefreshCw, Gamepad2, ChevronDown, ChevronUp, Folder, Zap } from "lucide-react";
import { useAppStore } from "../stores/use-app-store";
import { translations } from "../lib/i18n";
import { LocalPayload } from "../lib/types";

interface DeviceScannerProps {
  ps5Ip: string;
  onIpChange: (ip: string) => void;
  showManualIp: boolean;
  onToggleManualIp: () => void;
  isDiscovering: boolean;
  hasDiscoveredConsole: boolean;
  isScanningFtp: boolean;
  onDiscoverPs5: () => void;
  onScanPs5: () => void;
  appsCount: number;
  onStartFtp?: () => void;
  isStartingFtp?: boolean;

  // Local Payloads section
  payloadDir: string;
  onPayloadDirChange: (dir: string) => void;
  isScanningPayloads: boolean;
  onScanPayloads: () => void;
  localPayloads: LocalPayload[];
}

export function DeviceScanner({
  ps5Ip,
  onIpChange,
  showManualIp,
  onToggleManualIp,
  isDiscovering,
  hasDiscoveredConsole,
  isScanningFtp,
  onDiscoverPs5,
  onScanPs5,
  appsCount,
  onStartFtp,
  isStartingFtp,
  payloadDir,
  onPayloadDirChange,
  isScanningPayloads,
  onScanPayloads,
  localPayloads,
}: DeviceScannerProps) {
  const lang = useAppStore((state) => state.lang);
  const t = translations[lang];

  return (
    <div className="flex flex-col gap-4">
      {/* Box 1: PS5 Connection Card (Radar Auto-Detect First) */}
      <div className="glass-panel rounded-2xl p-4.5 flex flex-col gap-3.5 shrink-0 relative overflow-hidden border border-cyan-500/20">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-cyan-400" />
            <h2 className="font-semibold text-sm tracking-wide text-slate-200">{t.ps5Console}</h2>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[10px]">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                hasDiscoveredConsole ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
              }`}
            />
            <span className={hasDiscoveredConsole ? "text-emerald-400 font-medium" : "text-slate-400"}>
              {hasDiscoveredConsole ? t.consoleFoundStatus : t.consoleNotFoundStatus}
            </span>
          </div>
        </div>

        {/* HERO CTA: Radar Auto-Detection Button */}
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 rounded-xl blur-xs opacity-40 group-hover:opacity-100 transition duration-300"></div>
          <button
            onClick={onDiscoverPs5}
            disabled={isDiscovering || isScanningFtp}
            title={t.autoDetectTooltip}
            className="relative w-full py-2.5 px-3.5 bg-slate-950/90 hover:bg-slate-900 border border-cyan-400/40 hover:border-cyan-400/70 rounded-xl flex items-center justify-between transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-left shadow-[0_0_15px_rgba(0,240,255,0.12)] group-hover:shadow-[0_0_22px_rgba(0,240,255,0.25)] active:scale-[0.99]"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center shrink-0">
                <Radar
                  className={`w-4 h-4 text-cyan-400 ${
                    isDiscovering ? "animate-spin text-cyan-300" : "group-hover:scale-110 transition-transform"
                  }`}
                />
              </div>
              <div>
                <div className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                  <span>{isDiscovering ? t.autoDetectRadarScanning : t.autoDetectRadarBtn}</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">{t.autoDetectRadarSubtext}</div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                LAN :24
              </span>
            </div>
          </button>
        </div>

        {/* Target Console State Card */}
        <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-800/80 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Gamepad2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="text-xs font-mono font-semibold text-cyan-300 tracking-wider truncate">
                {ps5Ip || "192.168.1.xxx"}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {onStartFtp && (
                <button
                  onClick={onStartFtp}
                  disabled={isStartingFtp || isScanningFtp || isDiscovering || !ps5Ip}
                  title={t.ftpStartManualBtn}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-cyan-400 border border-cyan-500/30 transition flex items-center gap-1 disabled:opacity-40"
                >
                  <Zap className={`w-3.5 h-3.5 ${isStartingFtp ? "animate-pulse fill-cyan-400" : ""}`} />
                  <span className="hidden sm:inline">FTP</span>
                </button>
              )}

              <button
                onClick={onScanPs5}
                disabled={isScanningFtp || isDiscovering || !ps5Ip}
                className="btn-ps-primary px-3.5 py-1.5 text-xs gap-1.5 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isScanningFtp ? "animate-spin" : ""}`} />
                <span>{isScanningFtp ? t.scanning : t.scan}</span>
              </button>
            </div>
          </div>

          {/* Status footer with apps count */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60 font-mono">
            <div className="flex items-center gap-1.5">
              <span>{t.appsDetected}</span>
              <span className="text-cyan-400 font-bold">{appsCount}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-500">
              <span>/user/app</span>
              <span>•</span>
              <span>/data</span>
            </div>
          </div>
        </div>

        {/* Collapsible Manual IP Override */}
        <div className="pt-0.5">
          <button
            onClick={onToggleManualIp}
            className="flex items-center justify-between w-full text-[11px] text-slate-400 hover:text-slate-300 py-1 px-1 transition-colors cursor-pointer group"
          >
            <span className="group-hover:text-cyan-400 font-mono text-[10px] transition-colors">
              {t.manualIpToggle}
            </span>
            {showManualIp ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400" />
            )}
          </button>

          {showManualIp && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={ps5Ip}
                onChange={(e) => onIpChange(e.target.value)}
                placeholder="192.168.1.xxx"
                className="flex-1 bg-slate-950/90 border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-all shadow-inner"
              />
              <button
                onClick={onScanPs5}
                disabled={isScanningFtp || !ps5Ip.trim()}
                className="btn-ps-secondary px-4 py-2 text-xs shrink-0"
              >
                OK
              </button>
            </div>
          )}
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
              onChange={(e) => onPayloadDirChange(e.target.value)}
              placeholder={t.folderPlaceholder}
              className="flex-1 bg-slate-950/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 transition-all shadow-inner"
            />
            <button
              onClick={onScanPayloads}
              disabled={isScanningPayloads}
              className="btn-ps-secondary px-3.5 py-2.5 text-xs gap-1.5 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isScanningPayloads ? "animate-spin" : ""}`} />
              <span>{isScanningPayloads ? t.scanning : t.scan}</span>
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
    </div>
  );
}
