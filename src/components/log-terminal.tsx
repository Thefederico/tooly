import React from "react";
import { Terminal, Copy, Check } from "lucide-react";
import { useAppStore } from "../stores/use-app-store";
import { translations } from "../lib/i18n";

interface LogTerminalProps {
  logs: string[];
  isCopied: boolean;
  onCopyLogs: () => void;
}

export function LogTerminal({ logs, isCopied, onCopyLogs }: LogTerminalProps) {
  const lang = useAppStore((state) => state.lang);
  const t = translations[lang];

  return (
    <div className="glass-panel rounded-2xl p-4 flex flex-col gap-2 flex-1 min-h-[140px] shrink-0">
      <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-medium text-slate-300">{t.operationsLog}</span>
        </div>
        <button
          onClick={onCopyLogs}
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
        {logs.map((log) => (
          <div key={log} className="leading-tight select-text">
            <span className="text-cyan-500/70 select-text">{log}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
