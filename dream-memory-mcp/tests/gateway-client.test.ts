import { describe, it, expect, vi, beforeEach } from "vitest";
import { GatewayClient } from "../src/gateway-client.js";
import { GatewayError, GatewayUnavailableError } from "../src/types.js";

describe("GatewayClient", () => {
  const baseUrl = "http://localhost:8420";
  let client: GatewayClient;

  beforeEach(() => {
    client = new GatewayClient(baseUrl);
    vi.restoreAllMocks();
  });

  it("health() returns parsed HealthResponse on 200", async () => {
    const fakeResp = {
      status: "ok" as const,
      version: "0.1.0",
      uptime: 42,
      stores: { vectorStore: true, embeddingService: false },
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(fakeResp), { status: 200 }),
    );
    const r = await client.health();
    expect(r).toEqual(fakeResp);
  });

  it("capture() POSTs JSON body to /capture", async () => {
    const fakeResp = { l0_recorded: 1, scheduler_notified: true };
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(fakeResp), { status: 200 }));

    const r = await client.capture({
      user_content: "u",
      assistant_content: "a",
      session_key: "sk-1",
    });
    expect(r).toEqual(fakeResp);
    expect(fetchSpy).toHaveBeenCalledWith(
      `${baseUrl}/capture`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: JSON.stringify({ user_content: "u", assistant_content: "a", session_key: "sk-1" }),
      }),
    );
  });

  it("throws GatewayError on 4xx with upstream message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Missing required field: query" }), { status: 400 }),
    );
    await expect(client.recall({ query: "", session_key: "s" })).rejects.toMatchObject({
      name: "GatewayError",
      status: 400,
      upstreamMessage: "Missing required field: query",
      endpoint: "/recall",
    });
  });

  it("throws GatewayUnavailableError on connection refused", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } }),
    );
    await expect(client.health()).rejects.toMatchObject({ name: "GatewayUnavailableError" });
  });

  it("times out after configured timeoutMs", async () => {
    const fastClient = new GatewayClient({ baseUrl, timeoutMs: 50 });
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          // Honor AbortSignal so AbortController.abort() rejects the promise
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    );
    await expect(fastClient.recall({ query: "q", session_key: "s" })).rejects.toThrow(/abort/i);
  });
});
