export interface InstalledApp {
  title_id: string;
  app_name?: string;
  app_ver: string;
  path: string;
  icon_base64?: string;
}

export interface LocalPayload {
  file_name: string;
  full_path: string;
  detected_name: string;
  detected_version?: string;
  file_size: number;
  extension: string;
}

export interface ReleaseAsset {
  name: string;
  size: number;
  browser_download_url: string;
  content_type?: string;
}

export interface GitHubReleaseInfo {
  tag_name: string;
  name?: string;
  body?: string;
  published_at?: string;
  assets: ReleaseAsset[];
}

export interface RegistryItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  developer: string;
  category: "utility" | "payload" | "emulator" | "game" | "media" | "tool";
  titleId?: string | null;
  githubRepo?: string;
  directUrl?: string;
  version?: string;
  releaseNotes?: string;
  firmwareMin: string;
  firmwareMax: string;
  tags: string[];
  assetPattern?: string;
}

export interface DpiInstallResponse {
  success: boolean;
  message: string;
}

export interface DownloadProgressPayload {
  file_name: string;
  downloaded_bytes: number;
  total_bytes: number | null;
  percentage: number;
  status: "downloading" | "ready_to_send" | "starting_dpi_server" | "triggering_dpi" | "installed_success" | "error";
}

export interface DiscoveredPs5 {
  ip: string;
  ftp_open: boolean;
  dpi_open: boolean;
  elf_loader_open?: boolean;
  ps_native_open?: boolean;
}

export interface FtpInjectionResult {
  success: boolean;
  method_used: string;
  ftp_verified: boolean;
  message: string;
}

export interface AppUpdateInfo {
  current_version: string;
  latest_version: string;
  has_update: boolean;
  release_notes?: string;
  published_at?: string;
  download_url?: string;
  asset_name?: string;
  html_url?: string;
}

export interface ArchiveOrgGameUpdate {
  identifier: string;
  file_name: string;
  title_id: string;
  version: string;
  download_url: string;
  size_bytes?: number | null;
  is_update: boolean;
  is_backport: boolean;
  is_recommended: boolean;
  description?: string | null;
}

export interface SystemInfo {
  app: string;
  version: string;
  is_ps5: boolean;
  default_ip: string;
}

export interface ScanProgressPayload {
  session_id: string;
  current_folder: string;
  scanned_count: number;
  total_estimated: number;
  percentage: number;
}

export interface ScanCompletePayload {
  session_id: string;
  total_apps: number;
}

export interface ScanErrorPayload {
  session_id: string;
  error: ToolyError;
}

export interface ScanSessionResponse {
  session_id: string;
}

export type ToolyServerEvent =
  | { type: "dpi-progress"; payload: DownloadProgressPayload }
  | { type: "scan-progress"; payload: ScanProgressPayload }
  | { type: "scan-app-discovered"; payload: InstalledApp }
  | { type: "scan-complete"; payload: ScanCompletePayload }
  | { type: "scan-error"; payload: ScanErrorPayload };

export type ToolyError =
  | { type: "SfoBufferTooSmall"; message: { len: number } }
  | { type: "SfoInvalidMagic"; message: { found: number[] } }
  | { type: "SfoMalformedKeyTable" }
  | { type: "JsonParseError"; message: string }
  | { type: "FtpError"; message: string }
  | { type: "FtpTimeout"; message: { ip: string; port: number; seconds: number } }
  | { type: "DpiError"; message: string }
  | { type: "GitHubError"; message: string }
  | { type: "ArchiveOrgError"; message: string }
  | { type: "PayloadInjectionError"; message: string }
  | { type: "InvalidInput"; message: string }
  | { type: "InternalError"; message: string }
  | { type: "IoError"; message: string };

export function formatToolyError(err: unknown): string {
  if (!err) return "Error desconocido";
  if (typeof err === "string") return err;

  if (typeof err === "object" && "type" in err) {
    const te = err as ToolyError;
    switch (te.type) {
      case "PayloadInjectionError":
        return `Error inyectando payload en PS5: ${te.message}`;
      case "FtpTimeout":
        return `Timeout conectando a PS5 FTP (${te.message.ip}:${te.message.port}) tras ${te.message.seconds}s.`;
      case "FtpError":
        return `Error FTP PS5: ${te.message}`;
      case "DpiError":
        return `Error etaHEN DPI: ${te.message}`;
      case "GitHubError":
        return `Error GitHub API: ${te.message}`;
      case "ArchiveOrgError":
        return `Error Archive.org: ${te.message}`;
      case "InvalidInput":
        return `Parámetro inválido: ${te.message}`;
      case "InternalError":
        return `Error interno del sistema: ${te.message}`;
      case "IoError":
        return `Error de E/S local: ${te.message}`;
      case "JsonParseError":
        return `Error al parsear param.json: ${te.message}`;
      case "SfoMalformedKeyTable":
        return "PARAM.SFO corrupto o tabla de claves inválida";
      case "SfoBufferTooSmall":
        return `Encabezado SFO demasiado pequeño (${te.message.len} bytes)`;
      case "SfoInvalidMagic":
        return "Encabezado SFO no contiene la firma mágica \\0PSF";
    }
  }

  return (err as Error).message || JSON.stringify(err);
}



