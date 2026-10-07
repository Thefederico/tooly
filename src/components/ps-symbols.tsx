import React from "react";

export function PsSymbols({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 opacity-60 font-mono tracking-widest text-xs select-none ${className}`}>
      <span className="text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]">△</span>
      <span className="text-rose-400 drop-shadow-[0_0_6px_rgba(251,113,133,0.5)]">◯</span>
      <span className="text-blue-400 drop-shadow-[0_0_6px_rgba(96,165,250,0.5)]">✕</span>
      <span className="text-pink-400 drop-shadow-[0_0_6px_rgba(244,114,182,0.5)]">□</span>
    </div>
  );
}
