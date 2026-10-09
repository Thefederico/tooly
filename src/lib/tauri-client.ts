import { invoke } from "@tauri-apps/api/core";
import {
  InstalledApp,
  LocalPayload,
  GitHubReleaseInfo,
  DpiInstallResponse,
  DiscoveredPs5,
  AppUpdateInfo,
  ScanSessionResponse,
  FtpInjectionResult,
  ArchiveOrgGameUpdate,
  ToolyServerEvent,
  SystemInfo,
} from "./types";


/**
 * Detecta si el frontend está ejecutándose dentro del contenedor de escritorio nativo de Tauri v2.
 */
export const isTauri = (): boolean => {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
};

/**
 * Capa de transporte transparente:
 * - En Tauri Desktop: delega directamente a `invoke<T>(command, args)`.
 * - En Web / Daemon (PS5 on-console): realiza `fetch('/api/' + command)` con método POST y JSON body.
 */
export async function executeCommand<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  if (isTauri()) {
    return await invoke<T>(command, args);
  }

  const response = await fetch(`/api/${command}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args ?? {}),
  });

  if (!response.ok) {
    let errorMessage: string | undefined;
    try {
      const errorJson = await response.json();
      if (errorJson && typeof errorJson === "object" && "message" in errorJson) {
        errorMessage = String(errorJson.message);
      }
    } catch {
      // Ignorar fallo de parseo JSON de error
    }

    throw new Error(errorMessage || `Error HTTP ${response.status}: ${response.statusText}`);
  }

  return (await response.json()) as T;
}

/**
 * Suscripción transparente a eventos del servidor en tiempo real.
 * En Web / Daemon PS5 utiliza Server-Sent Events (SSE) vía `/api/events`.
 * Retorna una función para cancelar la suscripción y cerrar la conexión SSE.
 */
export function subscribeServerEvents(
  onEvent: (event: ToolyServerEvent) => void
): () => void {
  if (typeof window === "undefined" || typeof EventSource === "undefined") {
    return () => {};
  }

  const eventSource = new EventSource("/api/events");

  const messageHandler = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data) as ToolyServerEvent;
      onEvent(data);
    } catch (e) {
      console.error("Error al procesar evento SSE de Tooly:", e);
    }
  };

  eventSource.addEventListener("message", messageHandler);

  return () => {
    eventSource.removeEventListener("message", messageHandler);
    eventSource.close();
  };
}

/**
 * API fuertemente tipada de Tooly para comunicación con el backend (Desktop o Daemon On-Console).
 */
export const tauriApi = {
  checkAppUpdate: async (repo?: string): Promise<AppUpdateInfo> => {
    return await executeCommand<AppUpdateInfo>("check_app_update", { repo });
  },

  discoverPs5Consoles: async (baseIp?: string, timeoutMs?: number): Promise<DiscoveredPs5[]> => {
    return await executeCommand<DiscoveredPs5[]>("discover_ps5_consoles", { baseIp, timeoutMs });
  },

  startScanPs5Apps: async (ip: string, port?: number, timeoutSecs?: number): Promise<ScanSessionResponse> => {
    return await executeCommand<ScanSessionResponse>("start_scan_ps5_apps", { ip, port, timeoutSecs });
  },

  cancelScan: async (sessionId: string): Promise<boolean> => {
    return await executeCommand<boolean>("cancel_scan", { sessionId });
  },

  scanPs5Apps: async (ip: string, port?: number, timeoutSecs?: number): Promise<InstalledApp[]> => {
    return await executeCommand<InstalledApp[]>("scan_ps5_apps", { ip, port, timeoutSecs });
  },

  scanLocalPayloads: async (directory: string): Promise<LocalPayload[]> => {
    return await executeCommand<LocalPayload[]>("scan_local_payloads", { directory });
  },

  checkGitHubUpdate: async (repo: string): Promise<GitHubReleaseInfo> => {
    return await executeCommand<GitHubReleaseInfo>("check_github_update", { repo });
  },

  checkBatchGitHubUpdates: async (
    repos: string[],
    concurrency?: number
  ): Promise<[string, GitHubReleaseInfo | null][]> => {
    return await executeCommand<[string, GitHubReleaseInfo | null][]>("check_batch_github_updates", {
      repos,
      concurrency,
    });
  },

  triggerDpiUpdate: async (
    ps5Ip: string,
    downloadUrl: string,
    fileName: string
  ): Promise<DpiInstallResponse> => {
    return await executeCommand<DpiInstallResponse>("trigger_dpi_update", {
      ps5Ip,
      downloadUrl,
      fileName,
    });
  },

  searchArchiveUpdates: async (
    titleId: string,
    gameName?: string,
    currentVersion?: string
  ): Promise<ArchiveOrgGameUpdate[]> => {
    return await executeCommand<ArchiveOrgGameUpdate[]>("search_archive_updates", {
      titleId,
      gameName,
      currentVersion,
    });
  },

  installArchiveUpdateDirect: async (
    ps5Ip: string,
    downloadUrl: string
  ): Promise<DpiInstallResponse> => {
    return await executeCommand<DpiInstallResponse>("install_archive_update_direct", {
      ps5Ip,
      downloadUrl,
    });
  },

  updatePayloadViaFtp: async (
    ps5Ip: string,
    targetFolder: string,
    downloadUrl: string,
    newFilename: string,
    newVersion: string,
    port?: number
  ): Promise<string> => {
    return await executeCommand<string>("update_payload_via_ftp", {
      ps5Ip,
      port,
      targetFolder,
      downloadUrl,
      newFilename,
      newVersion,
    });
  },

  startPs5FtpServer: async (ps5Ip: string): Promise<FtpInjectionResult> => {
    return await executeCommand<FtpInjectionResult>("start_ps5_ftp_server", { ps5Ip });
  },

  getSystemInfo: async (): Promise<SystemInfo> => {
    return await executeCommand<SystemInfo>("system_info");
  },
};

