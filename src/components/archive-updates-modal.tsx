import React from "react";
import { ArchiveOrgGameUpdate } from "../lib/types";
import { Language, translations } from "../lib/i18n";
import { X, Database, Sparkles, ExternalLink, HardDrive, DownloadCloud } from "lucide-react";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#151822] border border-[#222737] rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#212634] flex items-center justify-between bg-[#12141c]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#1c2232] border border-[#283248] text-[#6692b0]">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-[#eceff4] text-base flex items-center gap-2">
                {gameName}
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#1c2232] text-[#6692b0] border border-[#283248] font-normal">
                  {titleId}
                </span>
              </h3>
              <p className="text-xs text-[#828fa3] mt-0.5">
                {t.archiveModalSubtitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#828fa3] hover:text-[#eceff4] hover:bg-[#1f2433] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-[#828fa3]">
              <div className="w-7 h-7 border-2 border-[#3b5b8e] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-mono">{t.searchingArchive}</p>
            </div>
          ) : updates.length === 0 ? (
            <div className="py-16 text-center text-xs text-[#64748b] italic flex flex-col items-center gap-2">
              <DownloadCloud className="w-10 h-10 opacity-40 text-[#828fa3]" />
              <p>{t.noArchiveUpdates}</p>
            </div>
          ) : (
            updates.map((item, index) => {
              const isCurrentInstalling = isInstalling && installingUrl === item.download_url;

              return (
                <div
                  key={index}
                  className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    item.is_recommended
                      ? "bg-[#181d29] border-[#2c3850]"
                      : "bg-[#12141c] border-[#212634] hover:border-[#2b3348]"
                  }`}
                >
                  <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-[#eceff4] truncate">
                        {item.file_name}
                      </span>
                      {item.is_recommended && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#2c2317] text-[#d49b4b] border border-[#523d20] flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-[#d49b4b]" />
                          {t.recommendedBadge}
                        </span>
                      )}
                      {item.is_backport && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1a2536] text-[#6692b0] border border-[#2b3d54]">
                          {t.backportBadge}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[#828fa3] font-mono flex-wrap">
                      {item.version && <span>v{item.version}</span>}
                      <span>{formatSize(item.size_bytes)}</span>
                      {item.identifier && (
                        <a
                          href={`https://archive.org/details/${item.identifier}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#6b94bd] hover:underline flex items-center gap-1"
                        >
                          Archive.org <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => onInstallDirect(item.download_url, item.file_name)}
                    disabled={isInstalling}
                    className="px-4 py-2 bg-[#2c5874] hover:bg-[#396e91] active:scale-[0.98] text-[#eceff4] text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {isCurrentInstalling ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>{t.installingBtn}</span>
                      </>
                    ) : (
                      <>
                        <HardDrive className="w-3.5 h-3.5" />
                        <span>{t.installDirectDpi}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#212634] bg-[#12141c] flex items-center justify-between text-xs text-[#64748b]">
          <span>Archive.org PS4/PS5 Game Preservation Vault</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-[#1c212e] hover:bg-[#252c3d] text-[#eceff4] text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
