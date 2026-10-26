import React from "react";
import { Language, translations } from "../lib/i18n";
import { X, Terminal, Copy, Check } from "lucide-react";

interface TerminalDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activityLogs: string[];
  onCopyLogs: () => void;
  isCopied: boolean;
  lang: Language;
}

export function TerminalDrawer({
  isOpen,
  onClose,
  activityLogs,
  onCopyLogs,
  isCopied,
  lang,
}: TerminalDrawerProps) {
  if (!isOpen) return null;

  const t = translations[lang];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Click outside to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer Panel */}
      <div className="w-full max-w-lg bg-[#151822] border-l border-[#222737] h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-250">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#212634] flex items-center justify-between bg-[#12141c]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#1c2232] text-[#4e9a78] border border-[#2b344c]">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#eceff4]">{t.operationsLog}</h2>
              <p className="text-[11px] text-[#828fa3] font-mono">System stream & audit trail</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onCopyLogs}
              title={t.copyLogsTooltip}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1e2332] hover:bg-[#283044] border border-[#2c354c] text-xs font-mono text-[#94a3b8] hover:text-[#eceff4] transition-all cursor-pointer"
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#4e9a78]" />
                  <span className="text-[#4e9a78]">{t.copied}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t.copy}</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#828fa3] hover:text-[#eceff4] hover:bg-[#1f2433] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Console Log Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#0d0f16] font-mono text-xs text-[#94a3b8] flex flex-col gap-1.5 select-text">
          {activityLogs.map((log, index) => {
            const isError = log.toLowerCase().includes("error");
            const isSuccess = log.toLowerCase().includes("success") || log.toLowerCase().includes("completad") || log.toLowerCase().includes("ready");
            const isImportant = log.toLowerCase().includes("discovered") || log.toLowerCase().includes("detectad") || log.toLowerCase().includes("update");

            return (
              <div
                key={index}
                className={`py-0.5 leading-relaxed font-mono ${
                  isError
                    ? "text-[#e06c75]"
                    : isSuccess
                    ? "text-[#4e9a78]"
                    : isImportant
                    ? "text-[#d49b4b]"
                    : "text-[#828fa3]"
                }`}
              >
                {log}
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-[#212634] bg-[#12141c] flex items-center justify-between text-[11px] font-mono text-[#64748b]">
          <span>{activityLogs.length} events logged</span>
          <span>DPI: :12800 · FTP: :2121 · TCP: :9090</span>
        </div>
      </div>
    </div>
  );
}
