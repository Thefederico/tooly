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


