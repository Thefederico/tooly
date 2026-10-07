import { invoke } from "@tauri-apps/api/core";
import {
  InstalledApp,
  LocalPayload,
  GitHubReleaseInfo,
  DpiInstallResponse,
  DiscoveredPs5,
  AppUpdateInfo,
  ScanSessionResponse,
} from "./types";

export const tauriApi = {
  checkAppUpdate: async (repo?: string): Promise<AppUpdateInfo> => {
    return await invoke<AppUpdateInfo>("check_app_update", { repo });
  },

  discoverPs5Consoles: async (baseIp?: string, timeoutMs?: number): Promise<DiscoveredPs5[]> => {
    return await invoke<DiscoveredPs5[]>("discover_ps5_consoles", { baseIp, timeoutMs });
  },

  startScanPs5Apps: async (ip: string, port?: number, timeoutSecs?: number): Promise<ScanSessionResponse> => {
    return await invoke<ScanSessionResponse>("start_scan_ps5_apps", { ip, port, timeoutSecs });
  },

  cancelScan: async (sessionId: string): Promise<boolean> => {
    return await invoke<boolean>("cancel_scan", { sessionId });
  },

  scanPs5Apps: async (ip: string, port?: number, timeoutSecs?: number): Promise<InstalledApp[]> => {
    return await invoke<InstalledApp[]>("scan_ps5_apps", { ip, port, timeoutSecs });
  },

  scanLocalPayloads: async (directory: string): Promise<LocalPayload[]> => {
    return await invoke<LocalPayload[]>("scan_local_payloads", { directory });
  },

  checkGitHubUpdate: async (repo: string): Promise<GitHubReleaseInfo> => {
    return await invoke<GitHubReleaseInfo>("check_github_update", { repo });
  },

  checkBatchGitHubUpdates: async (
    repos: string[],
    concurrency?: number
  ): Promise<[string, GitHubReleaseInfo | null][]> => {
    return await invoke<[string, GitHubReleaseInfo | null][]>("check_batch_github_updates", {
      repos,
      concurrency,
    });
  },

  triggerDpiUpdate: async (
    ps5Ip: string,
    downloadUrl: string,
    fileName: string
  ): Promise<DpiInstallResponse> => {
    return await invoke<DpiInstallResponse>("trigger_dpi_update", {
      ps5Ip,
      downloadUrl,
      fileName,
    });
  },

  searchArchiveUpdates: async (
    titleId: string,
    gameName?: string,
    currentVersion?: string
  ): Promise<import("./types").ArchiveOrgGameUpdate[]> => {
    return await invoke<import("./types").ArchiveOrgGameUpdate[]>("search_archive_updates", {
      titleId,
      gameName,
      currentVersion,
    });
  },

  installArchiveUpdateDirect: async (
    ps5Ip: string,
    downloadUrl: string
  ): Promise<DpiInstallResponse> => {
    return await invoke<DpiInstallResponse>("install_archive_update_direct", {
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
    return await invoke<string>("update_payload_via_ftp", {
      ps5Ip,
      port,
      targetFolder,
      downloadUrl,
      newFilename,
      newVersion,
    });
  },
};
