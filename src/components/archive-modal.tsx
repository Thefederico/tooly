import React from "react";
import { ArchiveUpdatesModal } from "./archive-updates-modal";
import { useAppStore } from "../stores/use-app-store";

interface ArchiveModalProps {
  onInstallDirect: (downloadUrl: string, fileName: string) => void;
}

export function ArchiveModal({ onInstallDirect }: ArchiveModalProps) {
  const lang = useAppStore((state) => state.lang);
  const archiveModal = useAppStore((state) => state.archiveModal);
  const closeArchiveModal = useAppStore((state) => state.closeArchiveModal);

  if (!archiveModal.selectedApp) return null;

  return (
    <ArchiveUpdatesModal
      isOpen={archiveModal.isOpen}
      onClose={closeArchiveModal}
      titleId={archiveModal.selectedApp.titleId}
      gameName={archiveModal.selectedApp.name}
      updates={archiveModal.updates}
      isLoading={archiveModal.isLoading}
      onInstallDirect={onInstallDirect}
      isInstalling={archiveModal.isInstallingDirect}
      installingUrl={archiveModal.installingUrl}
      lang={lang}
    />
  );
}
