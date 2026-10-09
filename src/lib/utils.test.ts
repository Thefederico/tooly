import { describe, it, expect } from "vitest";
import { isValidIpv4, formatBytes, isNewerVersion, extractDisplayVersion } from "./utils";

describe("Utility functions", () => {
  describe("isValidIpv4", () => {
    it("returns true for valid IPv4 addresses", () => {
      expect(isValidIpv4("192.168.1.1")).toBe(true);
      expect(isValidIpv4("10.0.0.1")).toBe(true);
      expect(isValidIpv4("172.16.254.1")).toBe(true);
      expect(isValidIpv4("0.0.0.0")).toBe(true);
      expect(isValidIpv4("255.255.255.255")).toBe(true);
      expect(isValidIpv4("  192.168.1.50  ")).toBe(true);
    });

    it("returns false for invalid IPv4 addresses", () => {
      expect(isValidIpv4("")).toBe(false);
      expect(isValidIpv4("   ")).toBe(false);
      expect(isValidIpv4("192.168.1")).toBe(false);
      expect(isValidIpv4("192.168.1.256")).toBe(false);
      expect(isValidIpv4("192.168.1.-1")).toBe(false);
      expect(isValidIpv4("192.168.1.1.1")).toBe(false);
      expect(isValidIpv4("abc.def.ghi.jkl")).toBe(false);
      expect(isValidIpv4("192.168.1.01")).toBe(false); // leading zeros disallowed
      expect(isValidIpv4("192.168.1.xxx")).toBe(false);
    });
  });

  describe("formatBytes", () => {
    it("formats 0 bytes", () => {
      expect(formatBytes(0)).toBe("0 Bytes");
    });

    it("formats kilobytes, megabytes and gigabytes correctly", () => {
      expect(formatBytes(1024)).toBe("1 KB");
      expect(formatBytes(1024 * 1024)).toBe("1 MB");
      expect(formatBytes(1024 * 1024 * 1024)).toBe("1 GB");
    });
  });

  describe("isNewerVersion", () => {
    it("returns false when versions are identical", () => {
      expect(isNewerVersion("2.5B", "2.5B")).toBe(false);
      expect(isNewerVersion("v2.5b", "2.5B")).toBe(false);
      expect(isNewerVersion("1.00", "v1.00")).toBe(false);
    });

    it("returns false when installed version is a composite containing latest", () => {
      expect(isNewerVersion("v2.5b/v2.6b", "2.5B")).toBe(false);
      expect(isNewerVersion("v2.5b/v2.6b", "v2.5b")).toBe(false);
    });

    it("returns false when installed is newer than github release", () => {
      expect(isNewerVersion("v2.6b", "2.5B")).toBe(false);
      expect(isNewerVersion("2.00", "1.50")).toBe(false);
    });

    it("returns true when github release is genuinely newer", () => {
      expect(isNewerVersion("2.4B", "2.5B")).toBe(true);
      expect(isNewerVersion("1.00", "1.01")).toBe(true);
      expect(isNewerVersion("v1.0.0", "v1.0.1")).toBe(true);
      expect(isNewerVersion("v2.5a", "v2.5b")).toBe(true);
    });

    it("correctly compares Sony param format 01.000.001 with semver releases like 1.9", () => {
      // 01.000.001 (PS5SX2 1.0.1) vs release 1.9 (tagged vk-285-130) -> 1.9 is newer
      expect(isNewerVersion("01.000.001", "vk-285-130", "PS5SX2 1.9")).toBe(true);
      // 01.000.001 vs PS5SX2 1.0 -> not newer
      expect(isNewerVersion("01.000.001", "vk-285-112", "PS5SX2 1.0")).toBe(false);
    });
  });

  describe("extractDisplayVersion", () => {
    it("extracts version from release name when tag is a build hash", () => {
      expect(extractDisplayVersion("vk-285-130", "PS5SX2 1.9")).toBe("1.9");
      expect(extractDisplayVersion("1.08", "Update 1.08")).toBe("1.08");
      expect(extractDisplayVersion("2.5B", "etaHEN 2.5B")).toBe("2.5B");
    });
  });
});
