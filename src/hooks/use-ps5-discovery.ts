import { useCallback, useRef } from "react";
import { useAppStore } from "../stores/use-app-store";
import { tauriApi } from "../lib/tauri-client";
import { translations } from "../lib/i18n";
import { formatToolyError } from "../lib/types";
import { isValidIpv4 } from "../lib/utils";

export function usePs5Discovery(onAutoScanRequest?: (ip: string) => void) {
  const lang = useAppStore((state) => state.lang);
  const ps5Ip = useAppStore((state) => state.ps5Ip);
  const setPs5Ip = useAppStore((state) => state.setPs5Ip);
  const showManualIp = useAppStore((state) => state.showManualIp);
  const setShowManualIp = useAppStore((state) => state.setShowManualIp);
  const isDiscovering = useAppStore((state) => state.isDiscovering);
  const setIsDiscovering = useAppStore((state) => state.setIsDiscovering);
  const hasDiscoveredConsole = useAppStore((state) => state.hasDiscoveredConsole);
  const setHasDiscoveredConsole = useAppStore((state) => state.setHasDiscoveredConsole);
  const isScanningFtp = useAppStore((state) => state.isScanningFtp);
  const payloadDir = useAppStore((state) => state.payloadDir);
  const setPayloadDir = useAppStore((state) => state.setPayloadDir);
  const localPayloads = useAppStore((state) => state.localPayloads);
  const setLocalPayloads = useAppStore((state) => state.setLocalPayloads);
  const isScanningPayloads = useAppStore((state) => state.isScanningPayloads);
  const setIsScanningPayloads = useAppStore((state) => state.setIsScanningPayloads);
  const addLog = useAppStore((state) => state.addLog);

  const t = translations[lang];

  // Discover PS5 consoles via UDP / Port probing
  const discoverPs5 = useCallback(async () => {
    setIsDiscovering(true);
    addLog(t.logDiscovering);
    try {
      const baseHint = ps5Ip && isValidIpv4(ps5Ip.trim()) ? ps5Ip.trim() : undefined;
      const discovered = await tauriApi.discoverPs5Consoles(baseHint);
      if (discovered.length > 0) {
        const selected = discovered[0];
        setPs5Ip(selected.ip);
        setHasDiscoveredConsole(true);
        addLog(t.logDiscoveredSuccess(discovered.length, selected.ip));

        if (selected.ftp_open) {
          if (onAutoScanRequest) {
            setTimeout(() => {
              onAutoScanRequest(selected.ip);
            }, 300);
          }
        } else {
          // Servidor FTP apagado: avisar amistosamente que lo encienda en la PS5
          addLog(`ℹ️ ${t.logFtpClosedNotice(selected.ip)}`);
        }
        return selected;
      } else {
        addLog(t.logNoPs5Discovered);
        return null;
      }
    } catch (err: unknown) {
      addLog(`Error en auto-descubrimiento LAN: ${formatToolyError(err)}`);
      return null;
    } finally {
      setIsDiscovering(false);
    }
  }, [ps5Ip, t, addLog, setPs5Ip, setHasDiscoveredConsole, setIsDiscovering, onAutoScanRequest]);

  // Scan local folder for .bin / .elf payloads
  const scanPayloads = useCallback(async () => {
    if (!payloadDir.trim()) return;
    setIsScanningPayloads(true);
    addLog(t.logScanningPayloads(payloadDir));
    try {
      const payloads = await tauriApi.scanLocalPayloads(payloadDir);
      setLocalPayloads(payloads);
      addLog(t.logPayloadsDone(payloads.length));
      return payloads;
    } catch (err: unknown) {
      addLog(t.logPayloadsError(formatToolyError(err)));
      return [];
    } finally {
      setIsScanningPayloads(false);
    }
  }, [payloadDir, t, addLog, setLocalPayloads, setIsScanningPayloads]);

  return {
    ps5Ip,
    setPs5Ip,
    showManualIp,
    setShowManualIp,
    isDiscovering,
    hasDiscoveredConsole,
    setHasDiscoveredConsole,
    isScanningFtp,
    payloadDir,
    setPayloadDir,
    localPayloads,
    isScanningPayloads,
    discoverPs5,
    scanPayloads,
  };
}
