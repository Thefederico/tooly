import React from "react";
import { Server, Zap, X, Check, Loader2 } from "lucide-react";
import { useAppStore } from "../stores/use-app-store";
import { translations } from "../lib/i18n";

interface FtpStartModalProps {
  onConfirm: (ip: string) => void;
}

export function FtpStartModal({ onConfirm }: FtpStartModalProps) {
  const lang = useAppStore((state) => state.lang);
  const t = translations[lang];

  const modal = useAppStore((state) => state.ftpStartModal);
  const closeFtpStartModal = useAppStore((state) => state.closeFtpStartModal);
  const autoStartFtp = useAppStore((state) => state.autoStartFtp);
  const setAutoStartFtp = useAppStore((state) => state.setAutoStartFtp);

  if (!modal.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-md rounded-2xl border border-cyan-500/30 bg-[#070b14]/95 p-6 shadow-2xl shadow-cyan-950/50 flex flex-col gap-5 relative overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ftp-modal-title"
      >
        {/* Glow ambient background */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 id="ftp-modal-title" className="font-semibold text-base text-slate-100">
                {t.ftpServerInactiveModalTitle}
              </h3>
              <p className="text-xs font-mono text-cyan-400/80">PS5: {modal.ip}</p>
            </div>
          </div>
          <button
            onClick={closeFtpStartModal}
            disabled={modal.isInjecting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content body */}
        <p className="text-sm text-slate-300 leading-relaxed relative z-10">
          {t.ftpServerInactiveModalDesc(modal.ip)}
        </p>

        {/* Auto-start checkbox */}
        <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 cursor-pointer hover:border-cyan-500/30 transition relative z-10">
          <div
            className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center transition ${
              autoStartFtp
                ? "bg-cyan-500 border-cyan-400 text-black"
                : "border-slate-600 bg-slate-950/60"
            }`}
          >
            {autoStartFtp && <Check className="w-3 h-3 stroke-[3]" />}
          </div>
          <input
            type="checkbox"
            className="sr-only"
            checked={autoStartFtp}
            onChange={(e) => setAutoStartFtp(e.target.checked)}
          />
          <span className="text-xs text-slate-300 select-none">
            {t.ftpRememberAutoStart}
          </span>
        </label>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 relative z-10">
          <button
            onClick={closeFtpStartModal}
            disabled={modal.isInjecting}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition disabled:opacity-40"
          >
            {t.ftpCancel}
          </button>
          <button
            onClick={() => onConfirm(modal.ip)}
            disabled={modal.isInjecting}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-black shadow-lg shadow-cyan-500/20 hover:brightness-110 active:scale-95 transition flex items-center gap-2 disabled:opacity-50"
          >
            {modal.isInjecting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t.ftpLaunching}</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>{t.ftpLaunchButton}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
