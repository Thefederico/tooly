import { useState, useRef, useEffect } from "react";
import { useAppStore } from "../stores/use-app-store";

export function useActivityLog() {
  const activityLogs = useAppStore((state) => state.activityLogs);
  const addLog = useAppStore((state) => state.addLog);
  const clearLogs = useAppStore((state) => state.clearLogs);
  const [isCopied, setIsCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  const copyLogs = async () => {
    try {
      const fullLogText = activityLogs.join("\n");
      await navigator.clipboard.writeText(fullLogText);
      setIsCopied(true);
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
      copiedTimerRef.current = setTimeout(() => setIsCopied(false), 2000);
      return true;
    } catch (err) {
      console.error("Failed to copy activity log:", err);
      return false;
    }
  };

  return {
    activityLogs,
    addLog,
    clearLogs,
    isCopied,
    copyLogs,
  };
}
