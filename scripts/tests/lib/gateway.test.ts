import { describe, it, expect, vi, beforeEach } from "vitest";
import { Gateway, GatewayUnavailableError } from "../../src/lib/gateway.js";

describe("Gateway", () => {
  let gw: Gateway;
  beforeEach(() => {
    gw = new Gateway("http://localhost:8420");
    vi.restoreAllMocks();
  });

  it("capture() POSTs to /capture and returns parsed body", async () => {
    const fakeResp = { l0_recorded: 1, scheduler_notified: true };
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(fakeResp), { status: 200 }),
    );
    const r = await gw.capture({
      user_content: "u",
      assistant_content: "a",
      session_key: "sk-1",
    });
    expect(r).toEqual(fakeResp);
    expect(spy).toHaveBeenCalledWith(
      "http://localhost:8420/capture",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws on non-2xx with status + body in message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "bad" }), { status: 400 }),
    );
    await expect(
      gw.capture({ user_content: "u", assistant_content: "a", session_key: "s" }),
    ).rejects.toThrow(/400.*bad/);
  });

  it("throws GatewayUnavailableError on ECONNREFUSED", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } }),
    );
    await expect(gw.sessionEnd({ session_key: "s" })).rejects.toBeInstanceOf(
      GatewayUnavailableError,
    );
  });
});
