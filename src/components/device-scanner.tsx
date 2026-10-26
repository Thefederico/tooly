import { Wifi, Radar, RefreshCw, Gamepad2, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { useAppStore } from "../stores/use-app-store";
import { translations } from "../lib/i18n";
import { isValidIpv4 } from "../lib/utils";

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
}: DeviceScannerProps) {
  const lang = useAppStore((state) => state.lang);
  const t = translations[lang];

  const hasValidIp = isValidIpv4(ps5Ip.trim());
  const isManualIpInvalid = ps5Ip.trim().length > 0 && !hasValidIp;

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
                hasDiscoveredConsole
                  ? "bg-emerald-400 animate-pulse"
                  : hasValidIp
                  ? "bg-amber-400"
                  : "bg-slate-500"
              }`}
            />
            <span
              className={
                hasDiscoveredConsole
                  ? "text-emerald-400 font-medium"
                  : hasValidIp
                  ? "text-amber-400"
                  : "text-slate-400"
              }
            >
              {hasDiscoveredConsole
                ? t.consoleFoundStatus
                : hasValidIp
                ? (lang === "es" ? "IP manual sin verificar" : "Manual IP unverified")
                : t.consoleNotFoundStatus}
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
                {ps5Ip || (lang === "es" ? "IP no configurada" : "No IP configured")}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  if (!ps5Ip.trim()) {
                    onDiscoverPs5();
                  } else {
                    onScanPs5();
                  }
                }}
                disabled={isScanningFtp || isDiscovering || (Boolean(ps5Ip.trim()) && !hasValidIp)}
                title={!ps5Ip.trim() ? t.autoDetectTooltip : undefined}
                className="btn-ps-primary px-3.5 py-1.5 text-xs gap-1.5 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isScanningFtp ? "animate-spin" : ""}`} />
                <span>
                  {isScanningFtp
                    ? t.scanning
                    : !ps5Ip.trim()
                    ? (lang === "es" ? "Detectar" : "Detect")
                    : t.scan}
                </span>
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
            <div className="mt-2 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={ps5Ip}
                  onChange={(e) => onIpChange(e.target.value)}
                  placeholder="192.168.1.xxx"
                  className={`flex-1 bg-slate-950/90 border rounded-xl px-3 py-2 text-xs font-mono placeholder:text-slate-600 focus:outline-none transition-all shadow-inner ${
                    isManualIpInvalid
                      ? "border-rose-500/80 text-rose-300 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/30"
                      : "border-slate-700/80 text-cyan-300 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30"
                  }`}
                />
                <button
                  onClick={onScanPs5}
                  disabled={isScanningFtp || !hasValidIp}
                  className="btn-ps-secondary px-4 py-2 text-xs shrink-0"
                >
                  OK
                </button>
              </div>
              {isManualIpInvalid && (
                <span className="text-[10px] text-rose-400 font-mono px-1">
                  {lang === "es"
                    ? "Formato IPv4 inválido (ej: 192.168.1.50)"
                    : "Invalid IPv4 format (e.g. 192.168.1.50)"}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
