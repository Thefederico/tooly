import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isTauri, executeCommand, subscribeServerEvents, tauriApi } from "./tauri-client";
import { ToolyServerEvent } from "./types";

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

describe("Transparent Transport Layer (isTauri, executeCommand, subscribeServerEvents)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  describe("isTauri() detection", () => {
    it("returns false when window.__TAURI_INTERNALS__ is undefined (Web/PS5 mode)", () => {
      expect(isTauri()).toBe(false);
    });

    it("returns true when window.__TAURI_INTERNALS__ is present (Tauri Desktop mode)", () => {
      (window as unknown as { __TAURI_INTERNALS__: Record<string, unknown> }).__TAURI_INTERNALS__ = {};
      expect(isTauri()).toBe(true);
    });
  });

  describe("executeCommand() delegation", () => {
    it("calls invoke() with command and args when running in Tauri Desktop", async () => {
      (window as unknown as { __TAURI_INTERNALS__: Record<string, unknown> }).__TAURI_INTERNALS__ = {};
      vi.mocked(invoke).mockResolvedValueOnce({ success: true, message: "ok" });

      const result = await executeCommand<{ success: boolean; message: string }>("test_cmd", {
        foo: "bar",
      });

      expect(invoke).toHaveBeenCalledWith("test_cmd", { foo: "bar" });
      expect(result).toEqual({ success: true, message: "ok" });
    });

    it("performs POST /api/{command} when running in Web/Daemon mode", async () => {
      const mockResponse = { success: true, message: "daemon ok" };
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = mockFetch;

      const result = await executeCommand<typeof mockResponse>("check_app_update", {
        repo: "user/tooly",
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/check_app_update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: "user/tooly" }),
      });
      expect(result).toEqual(mockResponse);
    });

    it("throws formatted error if fetch responds with HTTP error in Web mode", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({ message: "Backend crashed" }),
      });
      global.fetch = mockFetch;

      await expect(
        executeCommand("failing_cmd", { arg1: 123 })
      ).rejects.toThrow("Backend crashed");
    });

    it("throws fallback HTTP status if response JSON does not contain message", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => {
          throw new Error("Invalid json");
        },
      });
      global.fetch = mockFetch;

      await expect(
        executeCommand("not_found_cmd")
      ).rejects.toThrow("Error HTTP 404: Not Found");
    });
  });

  describe("tauriApi wrapper methods", () => {
    it("delegates checkAppUpdate correctly", async () => {
      const mockUpdate = { current_version: "0.1.0", latest_version: "0.2.0", has_update: true };
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockUpdate,
      });

      const res = await tauriApi.checkAppUpdate("test/repo");
      expect(res).toEqual(mockUpdate);
    });

    it("delegates discoverPs5Consoles with params", async () => {
      const mockConsoles = [{ ip: "192.168.1.100", ftp_open: true, dpi_open: true }];
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockConsoles,
      });

      const res = await tauriApi.discoverPs5Consoles("192.168.1", 300);
      expect(res).toEqual(mockConsoles);
    });

    it("delegates triggerDpiUpdate", async () => {
      const mockResp = { success: true, message: "Triggered" };
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResp,
      });

      const res = await tauriApi.triggerDpiUpdate("192.168.1.50", "http://pkg.url", "game.pkg");
      expect(res).toEqual(mockResp);
    });
  });

  describe("subscribeServerEvents() SSE listener", () => {
    it("subscribes to EventSource on /api/events and dispatches events", () => {
      const mockListeners: Record<string, ((event: MessageEvent) => void)[]> = {};
      const mockClose = vi.fn();

      class MockEventSource {
        url: string;
        constructor(url: string) {
          this.url = url;
        }
        addEventListener(type: string, cb: (event: MessageEvent) => void) {
          if (!mockListeners[type]) mockListeners[type] = [];
          mockListeners[type].push(cb);
        }
        removeEventListener(type: string, cb: (event: MessageEvent) => void) {
          if (mockListeners[type]) {
            mockListeners[type] = mockListeners[type].filter((fn) => fn !== cb);
          }
        }
        close = mockClose;
      }

      (global as unknown as { EventSource: unknown }).EventSource = MockEventSource;

      const receivedEvents: ToolyServerEvent[] = [];
      const unsubscribe = subscribeServerEvents((ev) => {
        receivedEvents.push(ev);
      });

      expect(mockListeners["message"]).toBeDefined();

      const testPayload: ToolyServerEvent = {
        type: "dpi-progress",
        payload: {
          file_name: "test.pkg",
          downloaded_bytes: 50,
          total_bytes: 100,
          percentage: 50.0,
          status: "downloading",
        },
      };

      // Disparar mensaje SSE
      mockListeners["message"][0]({
        data: JSON.stringify(testPayload),
      } as MessageEvent);

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]).toEqual(testPayload);

      unsubscribe();
      expect(mockClose).toHaveBeenCalled();
    });
  });
});
