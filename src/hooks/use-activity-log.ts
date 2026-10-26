import { useState } from "react";
import { useAppStore } from "../stores/use-app-store";

export function useActivityLog() {
  const activityLogs = useAppStore((state) => state.activityLogs);
  const addLog = useAppStore((state) => state.addLog);
  const clearLogs = useAppStore((state) => state.clearLogs);
  const [isCopied, setIsCopied] = useState(false);

  const copyLogs = async () => {
    try {
      const fullLogText = activityLogs.join("\n");
      await navigator.clipboard.writeText(fullLogText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      return true;
    } catch (err) {
      console.error("Error al copiar registro:", err);
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
