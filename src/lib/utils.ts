import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function isValidIpv4(ip: string): boolean {
  if (!ip) return false;
  const trimmed = ip.trim();
  const parts = trimmed.split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (!/^\d+$/.test(p)) return false;
    const num = parseInt(p, 10);
    return num >= 0 && num <= 255 && String(num) === p;
  });
}

/**
 * Extrae la versión semántica principal de un string (ej. "PS5SX2 1.9" -> "1.9", "01.000.001" -> "1.0.1", "vk-285-130" con releaseName "PS5SX2 1.9" -> "1.9")
 */
export function extractDisplayVersion(tag: string, releaseName?: string | null): string {
  // 1. Si el release tiene un nombre con versión legible (ej. "PS5SX2 1.9", "Update 1.08")
  if (releaseName) {
    const nameMatch = releaseName.match(/(?:version|v|ver|update)?\s*([0-9]+\.[0-9]+(?:\.[0-9]+)?(?:[a-zA-Z])?)/i);
    if (nameMatch && nameMatch[1]) {
      return nameMatch[1].trim();
    }
  }

  // 2. Si el tag empieza con v o números (ej. "v1.2", "2.5B")
  const tagMatch = tag.match(/^[vV]?([0-9]+\.[0-9]+(?:\.[0-9]+)?(?:[a-zA-Z])?)/i);
  if (tagMatch && tagMatch[1]) {
    return tagMatch[1].trim();
  }

  // 3. Si el tag tiene números embebidos después de prefijo (ej. "vk-285-130" -> "285.130" o similar)
  const anyNumMatch = tag.match(/([0-9]+\.[0-9]+(?:\.[0-9]+)?(?:[a-zA-Z])?)/i);
  if (anyNumMatch && anyNumMatch[1]) {
    return anyNumMatch[1].trim();
  }

  return tag.trim();
}

/**
 * Normaliza y compara si `latest` es genuinamente una versión más reciente que `current`.
 * Soporta formatos como "2.5B", "v2.5b", "v2.5b/v2.6b", "1.00", "01.000.001" y tags como "vk-285-130" con releaseName.
 */
export function isNewerVersion(current: string, latest: string, latestReleaseName?: string | null): boolean {
  const normCurrent = (current || "").toLowerCase().trim().replace(/^[v]/, "");
  const normLatestRaw = (latest || "").toLowerCase().trim().replace(/^[v]/, "");

  if (!normLatestRaw || normCurrent === normLatestRaw) return false;

  // Si la versión instalada es un rango o combinación (ej. "2.5b/2.6b"),
  // comprobar si `latest` ya forma parte del rango
  if (normCurrent.includes("/")) {
    const parts = normCurrent.split("/").map((p) => p.replace(/^[v]/, "").trim());
    if (parts.includes(normLatestRaw)) {
      return false;
    }
  }

  // Extraer versión semántica legible si latest es un tag crudo tipo "vk-285-130"
  const semverLatest = extractDisplayVersion(latest, latestReleaseName).toLowerCase();
  if (normCurrent === semverLatest) return false;

  // Parseador semántico flexible que normaliza ceros a la izquierda (ej. "01.000.001" -> [1, 0, 1])
  const parseVer = (v: string) => {
    // Si viene en formato Sony con ceros a la izquierda (ej. "01.000.001")
    const sonyMatch = v.match(/^0*(\d+)\.0*(\d+)(?:\.0*(\d+))?([a-z])?$/i);
    if (sonyMatch) {
      return {
        major: parseInt(sonyMatch[1] || "0", 10),
        minor: parseInt(sonyMatch[2] || "0", 10),
        patch: parseInt(sonyMatch[3] || "0", 10),
        suffix: (sonyMatch[4] || "").toLowerCase(),
      };
    }

    const match = v.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?([a-z])?/i);
    if (!match) return { major: 0, minor: 0, patch: 0, suffix: "" };
    return {
      major: parseInt(match[1] || "0", 10),
      minor: parseInt(match[2] || "0", 10),
      patch: parseInt(match[3] || "0", 10),
      suffix: (match[4] || "").toLowerCase(),
    };
  };

  const pCurr = parseVer(normCurrent.includes("/") ? normCurrent.split("/").pop()! : normCurrent);
  const pLatest = parseVer(semverLatest);

  // Si latest no pudo ser parseado numéricamente y curr sí, no asumir update
  if (pLatest.major === 0 && pLatest.minor === 0 && pCurr.major > 0) {
    return false;
  }

  if (pLatest.major > pCurr.major) return true;
  if (pLatest.major < pCurr.major) return false;

  if (pLatest.minor > pCurr.minor) return true;
  if (pLatest.minor < pCurr.minor) return false;

  if (pLatest.patch > pCurr.patch) return true;
  if (pLatest.patch < pCurr.patch) return false;

  if (pLatest.suffix > pCurr.suffix) return true;

  return false;
}

