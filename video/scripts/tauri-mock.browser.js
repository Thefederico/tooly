(function () {
  const INSTALLED_APPS = [
    {
      title_id: "ETAH00001",
      app_name: "etaHEN",
      app_ver: "2.30",
      path: "/user/app/etaHEN",
    },
    {
      title_id: "APOL00001",
      app_name: "Apollo Save Tool",
      app_ver: "1.7.0",
      path: "/user/app/ApolloPS5",
    },
    {
      title_id: "ITEM00001",
      app_name: "Itemzflow",
      app_ver: "1.05",
      path: "/user/app/Itemzflow",
    },
    {
      title_id: "PPSA99169",
      app_name: "RetroArch PS5",
      app_ver: "4.1",
      path: "/user/app/retroarch",
    },
  ];

  const RELEASES = {
    "lightningmods/etahen": {
      tag_name: "v2.33",
      name: "etaHEN 2.33",
      published_at: "2026-09-20T12:00:00Z",
      assets: [
        {
          name: "etaHEN_2.33.elf",
          size: 4823440,
          browser_download_url: "https://github.com/LightningMods/etaHEN/releases/download/v2.33/etaHEN_2.33.elf",
          content_type: "application/octet-stream",
        },
      ],
    },
    "bucanero/apollo-ps5": {
      tag_name: "v1.7.0",
      name: "Apollo Save Tool 1.7.0",
      published_at: "2026-08-02T09:00:00Z",
      assets: [
        {
          name: "Apollo-Save-Tool.pkg",
          size: 15728640,
          browser_download_url: "https://github.com/bucanero/apollo-ps5/releases/download/v1.7.0/Apollo-Save-Tool.pkg",
          content_type: "application/octet-stream",
        },
      ],
    },
    "lightningmods/itemzflow": {
      tag_name: "v1.11",
      name: "Itemzflow v1.11",
      published_at: "2026-10-01T18:00:00Z",
      assets: [
        {
          name: "Itemzflow.pkg",
          size: 52428800,
          browser_download_url: "https://github.com/LightningMods/Itemzflow/releases/download/v1.11/Itemzflow.pkg",
          content_type: "application/octet-stream",
        },
      ],
    },
    "mihawk-99/ps5_retroarch": {
      tag_name: "v4.3",
      name: "RetroArch PS5 4.3",
      published_at: "2026-09-12T15:00:00Z",
      assets: [
        {
          name: "PS5_RetroArch_v4.3.zip",
          size: 89128960,
          browser_download_url: "https://github.com/mihawk-99/PS5_RetroArch/releases/download/v4.3/PS5_RetroArch_v4.3.zip",
          content_type: "application/zip",
        },
      ],
    },
  };

  function resolveInvoke(cmd, args) {
    switch (cmd) {
      case "check_app_update":
        return {
          current_version: "1.0.0",
          latest_version: "1.0.0",
          has_update: false,
        };
      case "discover_ps5_consoles":
        return [
          { ip: "192.168.1.50", ftp_open: true, dpi_open: true },
        ];
      case "scan_ps5_apps":
        return INSTALLED_APPS;
      case "scan_local_payloads":
        return [
          {
            file_name: "etaHEN_2.33.elf",
            full_path: "/Volumes/USB/payloads/etaHEN_2.33.elf",
            detected_name: "etaHEN",
            detected_version: "2.33",
            file_size: 4823440,
            extension: "elf",
          },
          {
            file_name: "payload_dumper.bin",
            full_path: "/Volumes/USB/payloads/payload_dumper.bin",
            detected_name: "Payload Dumper",
            file_size: 1048576,
            extension: "bin",
          },
        ];
      case "check_batch_github_updates": {
        const repos = Array.isArray(args && args.repos) ? args.repos : [];
        return repos.map((repo) => [repo, RELEASES[repo] ?? null]);
      }
      case "search_archive_updates":
        return [];
      case "trigger_dpi_update":
        return { success: true, message: "DPI install triggered — package sent to PS5." };
      case "install_archive_update_direct":
        return { success: true, message: "Archive package sent to PS5 via DPI." };
      case "update_payload_via_ftp":
        return "Payload updated via FTP.";
      default:
        throw new Error(`Unknown command: ${cmd}`);
    }
  }

  globalThis.__TOOLY_MOCK__ = { resolveInvoke };

  if (typeof window !== "undefined") {
    window.__TAURI_INTERNALS__ = {
      invoke: async (cmd, args) => {
        if (cmd === "trigger_dpi_update") {
          await new Promise((r) => setTimeout(r, 3000));
        }
        return resolveInvoke(cmd, args);
      },
      transformCallback: () => Math.floor(Math.random() * 1e9),
    };
  }
})();
