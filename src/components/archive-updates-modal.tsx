import React from "react";
import { ArchiveOrgGameUpdate } from "../lib/types";
import { Language, translations } from "../lib/i18n";
import { X, DownloadCloud, Sparkles, Shield, Database, ExternalLink, HardDrive } from "lucide-react";

interface ArchiveUpdatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  titleId: string;
  gameName: string;
  updates: ArchiveOrgGameUpdate[];
  isLoading: boolean;
  onInstallDirect: (downloadUrl: string, fileName: string) => void;
  isInstalling: boolean;
  installingUrl: string | null;
  lang: Language;
}

export function ArchiveUpdatesModal({
  isOpen,
  onClose,
  titleId,
  gameName,
  updates,
  isLoading,
  onInstallDirect,
  isInstalling,
  installingUrl,
  lang,
}: ArchiveUpdatesModalProps) {
  if (!isOpen) return null;

  const t = translations[lang];

  const formatSize = (bytes?: number | null) => {
    if (!bytes) return "—";
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(0,112,209,0.25)] flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                {gameName}
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-cyan-400 font-normal">
                  {titleId}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {t.archiveModalSubtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-3 min-h-0">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
              <p className="text-sm font-mono">{t.searchingArchive}</p>
            </div>
          ) : updates.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-2 text-slate-400">
              <HardDrive className="w-10 h-10 text-slate-600 stroke-[1.5]" />
              <p className="text-sm font-medium text-slate-300">{t.noArchiveUpdates}</p>
              <p className="text-xs text-slate-500 max-w-sm">
                No se encontraron paquetes .pkg asociados a {titleId} en el índice público de Archive.org.
              </p>
            </div>
          ) : (
            updates.map((item, idx) => {
              const isThisInstalling = isInstalling && installingUrl === item.download_url;

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    item.is_recommended
                      ? "bg-cyan-950/20 border-cyan-500/40 shadow-[0_0_20px_rgba(0,240,255,0.06)]"
                      : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700"
                  }`}
                >
                  <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm text-cyan-300">
                        v{item.version}
                      </span>
                      {item.is_recommended && (
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-950/50 border border-amber-500/40 px-2 py-0.5 rounded-full">
                          <Sparkles className="w-3 h-3 text-amber-400" /> {t.recommendedBadge}
                        </span>
                      )}
                      {item.is_backport && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                          <Shield className="w-3 h-3 text-emerald-400" /> {t.backportBadge}
                        </span>
                      )}
                      <span className="text-[11px] font-mono text-slate-400">
                        {formatSize(item.size_bytes)}
                      </span>
                    </div>

                    <p className="text-xs font-mono text-slate-400 truncate" title={item.file_name}>
                      {item.file_name}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={item.download_url}
                      target="_blank"
                      rel="noreferrer"
                      title="Ver en Archive.org"
                      className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      onClick={() => onInstallDirect(item.download_url, item.file_name)}
                      disabled={isInstalling}
                      className={`px-3.5 py-1.5 text-xs gap-1.5 ${
                        item.is_recommended ? "btn-ps-primary" : "btn-ps-secondary"
                      }`}
                    >
                      <DownloadCloud className={`w-3.5 h-3.5 ${isThisInstalling ? "animate-bounce" : ""}`} />
                      <span>{isThisInstalling ? t.installingBtn : t.installDirectDpi}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
