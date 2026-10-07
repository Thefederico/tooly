import { create } from "zustand";
import {
  InstalledApp,
  LocalPayload,
  DownloadProgressPayload,
  AppUpdateInfo,
  RegistryItem,
  GitHubReleaseInfo,
  ArchiveOrgGameUpdate,
} from "../lib/types";
import { Language, getSavedOrSystemLanguage, saveLanguage, translations } from "../lib/i18n";

export interface AppUpdateStatus {
  installed?: InstalledApp;
  registry?: RegistryItem;
  latestRelease?: GitHubReleaseInfo;
  archiveUpdates?: ArchiveOrgGameUpdate[];
  isSearchingArchive?: boolean;
  hasUpdate: boolean;
  statusText: string;
}

export interface ArchiveModalState {
  isOpen: boolean;
  selectedApp: { titleId: string; name: string } | null;
  updates: ArchiveOrgGameUpdate[];
  isLoading: boolean;
  isInstallingDirect: boolean;
  installingUrl: string | null;
}

interface AppStoreState {
  // Localization
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLanguage: () => void;

  // PS5 & Network
  ps5Ip: string;
  setPs5Ip: (ip: string) => void;
  showManualIp: boolean;
  setShowManualIp: (show: boolean) => void;
  isDiscovering: boolean;
  setIsDiscovering: (val: boolean) => void;
  hasDiscoveredConsole: boolean;
  setHasDiscoveredConsole: (val: boolean) => void;
  isScanningFtp: boolean;
  setIsScanningFtp: (val: boolean) => void;
  activeScanSession: string | null;
  setActiveScanSession: (session: string | null) => void;
  scanProgress: { currentFolder: string; scannedCount: number; totalEstimated: number; percentage: number } | null;
  setScanProgress: (progress: { currentFolder: string; scannedCount: number; totalEstimated: number; percentage: number } | null) => void;

  // FTP Auto-Start & Modal
  autoStartFtp: boolean;
  setAutoStartFtp: (val: boolean) => void;
  ftpStartModal: {
    isOpen: boolean;
    ip: string;
    isInjecting: boolean;
  };
  openFtpStartModal: (ip: string) => void;
  closeFtpStartModal: () => void;
  setIsInjectingFtp: (val: boolean) => void;

  // Local Payloads
  payloadDir: string;
  setPayloadDir: (dir: string) => void;
  localPayloads: LocalPayload[];
  setLocalPayloads: (payloads: LocalPayload[]) => void;
  isScanningPayloads: boolean;
  setIsScanningPayloads: (val: boolean) => void;

  // Apps & Updates
  installedApps: InstalledApp[];
  setInstalledApps: (apps: InstalledApp[] | ((prev: InstalledApp[]) => InstalledApp[])) => void;
  updatesState: Record<string, AppUpdateStatus>;
  setUpdatesState: (
    state: Record<string, AppUpdateStatus> | ((prev: Record<string, AppUpdateStatus>) => Record<string, AppUpdateStatus>)
  ) => void;
  updateAppStatus: (titleId: string, partial: Partial<AppUpdateStatus>) => void;
  updatingId: string | null;
  setUpdatingId: (id: string | null) => void;

  // Download & DPI progress
  progressState: DownloadProgressPayload | null;
  setProgressState: (progress: DownloadProgressPayload | null) => void;

  // Tooly Self-Update
  appUpdate: AppUpdateInfo | null;
  setAppUpdate: (info: AppUpdateInfo | null) => void;
  isCheckingAppUpdate: boolean;
  setIsCheckingAppUpdate: (val: boolean) => void;

  // Activity Logs
  activityLogs: string[];
  addLog: (msg: string) => void;
  clearLogs: () => void;

  // Archive.org Modal
  archiveModal: ArchiveModalState;
  setArchiveModal: (modal: Partial<ArchiveModalState>) => void;
  openArchiveModal: (app: InstalledApp, existingUpdates?: ArchiveOrgGameUpdate[]) => void;
  closeArchiveModal: () => void;
}

export const useAppStore = create<AppStoreState>((set) => ({
  // Localization
  lang: getSavedOrSystemLanguage(),
  setLang: (lang) => {
    saveLanguage(lang);
    set({ lang });
  },
  toggleLanguage: () =>
    set((state) => {
      const nextLang: Language = state.lang === "es" ? "en" : "es";
      saveLanguage(nextLang);
      return { lang: nextLang };
    }),

  // PS5 & Network
  ps5Ip: "192.168.1.100",
  setPs5Ip: (ps5Ip) => set({ ps5Ip }),
  showManualIp: false,
  setShowManualIp: (showManualIp) => set({ showManualIp }),
  isDiscovering: false,
  setIsDiscovering: (isDiscovering) => set({ isDiscovering }),
  hasDiscoveredConsole: false,
  setHasDiscoveredConsole: (hasDiscoveredConsole) => set({ hasDiscoveredConsole }),
  isScanningFtp: false,
  setIsScanningFtp: (isScanningFtp) => set({ isScanningFtp }),
  activeScanSession: null,
  setActiveScanSession: (activeScanSession) => set({ activeScanSession }),
  scanProgress: null,
  setScanProgress: (scanProgress) => set({ scanProgress }),

  // FTP Auto-Start & Modal
  autoStartFtp: typeof window !== "undefined" ? localStorage.getItem("tooly_auto_start_ftp") === "true" : false,
  setAutoStartFtp: (autoStartFtp) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("tooly_auto_start_ftp", String(autoStartFtp));
    }
    set({ autoStartFtp });
  },
  ftpStartModal: {
    isOpen: false,
    ip: "",
    isInjecting: false,
  },
  openFtpStartModal: (ip) =>
    set({
      ftpStartModal: {
        isOpen: true,
        ip,
        isInjecting: false,
      },
    }),
  closeFtpStartModal: () =>
    set((state) => ({
      ftpStartModal: {
        ...state.ftpStartModal,
        isOpen: false,
        isInjecting: false,
      },
    })),
  setIsInjectingFtp: (isInjecting) =>
    set((state) => ({
      ftpStartModal: {
        ...state.ftpStartModal,
        isInjecting,
      },
    })),

  // Local Payloads
  payloadDir: "",
  setPayloadDir: (payloadDir) => set({ payloadDir }),
  localPayloads: [],
  setLocalPayloads: (localPayloads) => set({ localPayloads }),
  isScanningPayloads: false,
  setIsScanningPayloads: (isScanningPayloads) => set({ isScanningPayloads }),

  // Apps & Updates
  installedApps: [],
  setInstalledApps: (updater) =>
    set((state) => ({
      installedApps: typeof updater === "function" ? updater(state.installedApps) : updater,
    })),
  updatesState: {},
  setUpdatesState: (updater) =>
    set((state) => ({
      updatesState: typeof updater === "function" ? updater(state.updatesState) : updater,
    })),
  updateAppStatus: (titleId, partial) =>
    set((state) => {
      const existing = state.updatesState[titleId] || {
        hasUpdate: false,
        statusText: "",
      };
      return {
        updatesState: {
          ...state.updatesState,
          [titleId]: { ...existing, ...partial },
        },
      };
    }),
  updatingId: null,
  setUpdatingId: (updatingId) => set({ updatingId }),

  // Download & DPI progress
  progressState: null,
  setProgressState: (progressState) => set({ progressState }),

  // Tooly Self-Update
  appUpdate: null,
  setAppUpdate: (appUpdate) => set({ appUpdate }),
  isCheckingAppUpdate: false,
  setIsCheckingAppUpdate: (isCheckingAppUpdate) => set({ isCheckingAppUpdate }),

  // Activity Logs
  activityLogs: [translations[getSavedOrSystemLanguage()].logInit],
  addLog: (msg) => {
    const timestamp = new Date().toLocaleTimeString();
    set((state) => ({
      activityLogs: [`[${timestamp}] ${msg}`, ...state.activityLogs.slice(0, 40)],
    }));
  },
  clearLogs: () => set({ activityLogs: [] }),

  // Archive.org Modal
  archiveModal: {
    isOpen: false,
    selectedApp: null,
    updates: [],
    isLoading: false,
    isInstallingDirect: false,
    installingUrl: null,
  },
  setArchiveModal: (partial) =>
    set((state) => ({
      archiveModal: { ...state.archiveModal, ...partial },
    })),
  openArchiveModal: (app, existingUpdates) =>
    set((state) => ({
      archiveModal: {
        ...state.archiveModal,
        isOpen: true,
        selectedApp: {
          titleId: app.title_id,
          name: app.app_name || state.updatesState[app.title_id]?.registry?.name || app.title_id,
        },
        updates: existingUpdates || state.updatesState[app.title_id]?.archiveUpdates || [],
        isLoading: false,
      },
    })),
  closeArchiveModal: () =>
    set((state) => ({
      archiveModal: {
        ...state.archiveModal,
        isOpen: false,
        selectedApp: null,
        updates: [],
        isLoading: false,
        isInstallingDirect: false,
        installingUrl: null,
      },
    })),
}));
