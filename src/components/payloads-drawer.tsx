import React from "react";
import { LocalPayload } from "../lib/types";
import { Language, translations } from "../lib/i18n";
import { X, Folder, RefreshCw, Send, HardDrive, FileCode2, Zap } from "lucide-react";

interface PayloadsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  payloadDir: string;
  setPayloadDir: (dir: string) => void;
  localPayloads: LocalPayload[];
  isScanningPayloads: boolean;
  onScanPayloads: () => void;
  onSendPayload?: (payload: LocalPayload) => void;
  isSendingPayload?: boolean;
  lang: Language;
}

export function PayloadsDrawer({
  isOpen,
  onClose,
  payloadDir,
  setPayloadDir,
  localPayloads,
  isScanningPayloads,
  onScanPayloads,
  onSendPayload,
  isSendingPayload,
  lang,
}: PayloadsDrawerProps) {
  if (!isOpen) return null;

  const t = translations[lang];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Click outside to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer Panel */}
      <div className="w-full max-w-md bg-[#151822] border-l border-[#222737] h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-250">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#212634] flex items-center justify-between bg-[#12141c]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#1c2232] text-[#7e6e9c] border border-[#2b344c]">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#eceff4]">{t.localPayloads}</h2>
              <p className="text-[11px] text-[#828fa3]">{t.payloadExt}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#828fa3] hover:text-[#eceff4] hover:bg-[#1f2433] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Directory Input Section */}
        <div className="p-4 border-b border-[#212634] flex flex-col gap-2.5 bg-[#141721]">
          <label className="text-xs font-medium text-[#94a3b8]">{t.folderPathLabel}</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={payloadDir}
              onChange={(e) => setPayloadDir(e.target.value)}
              placeholder={t.folderPlaceholder}
              className="flex-1 bg-[#0e1017] border border-[#252c3d] rounded-lg px-3 py-2 text-xs font-mono text-[#eceff4] placeholder:text-[#546075] focus:outline-none focus:border-[#3b5b8e]"
            />
            <button
              onClick={onScanPayloads}
              disabled={isScanningPayloads}
              className="px-3.5 py-2 bg-[#1c2232] hover:bg-[#252e42] border border-[#2b354d] text-xs font-bold text-[#eceff4] rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanningPayloads ? "animate-spin" : ""}`} />
              <span>{isScanningPayloads ? t.scanning : t.scan}</span>
            </button>
          </div>
        </div>

        {/* Payloads List */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {localPayloads.length === 0 ? (
            <div className="py-16 text-center text-xs text-[#64748b] italic flex flex-col items-center gap-2">
              <Folder className="w-8 h-8 opacity-40 text-[#828fa3]" />
              <p>{t.noPayloadsPrompt}</p>
            </div>
          ) : (
            localPayloads.map((payload, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-[#12141c] border border-[#212634] hover:border-[#2e374c] transition-all flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-lg bg-[#191d29] text-[#7e6e9c] shrink-0">
                    <FileCode2 className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-[#eceff4] truncate">
                      {payload.detected_name}
                    </span>
                    <span className="text-[10px] font-mono text-[#64748b] truncate">
                      {payload.file_name}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#1e2538] text-[#94a3b8] border border-[#2b354e]">
                    {payload.detected_version ? `v${payload.detected_version}` : payload.extension.toUpperCase()}
                  </span>

                  {onSendPayload && (
                    <button
                      onClick={() => onSendPayload(payload)}
                      disabled={isSendingPayload}
                      title={`${t.injectPayloadBtn} a PS5 (ELF Loader / Socket)`}
                      className="px-2.5 py-1 rounded-lg bg-[#3b5b8e]/20 hover:bg-[#3b5b8e] text-[#6b94bd] hover:text-white border border-[#3b5b8e]/40 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 text-[11px] font-bold"
                    >
                      <Zap className="w-3.5 h-3.5 text-[#d49b4b]" />
                      <span>{t.injectPayloadBtn}</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-[#212634] bg-[#12141c] text-center text-[11px] font-mono text-[#64748b]">
          Payload Injector: Payload Manager (:8084) & ELF Loader (:9021 / :9020)
        </div>
      </div>
    </div>
  );
}
