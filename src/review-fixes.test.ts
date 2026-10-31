import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SpendingGuard, SpendingGuardError } from "./spending-guard.js";
import { NombaApiError } from "./client.js";
import { assertRecipientAllowed, classifyBaseUrl, parsePositive, callbackHostAllowed, parseHostList } from "./config.js";
import { normalisePhone } from "./utils.js";
import { registerCheckoutTools } from "./tools/checkout.js";
import { registerTransferTools } from "./tools/transfers.js";
import { registerAirtimeTools } from "./tools/airtime.js";
import type { NombaClient } from "./client.js";

const guard = () =>
  new SpendingGuard({ maxTransaction: 100, sessionSpendingCap: 150, duplicateWindowMs: 60_000, maxUnpricedPerSession: 2 });

describe("SpendingGuard.run", () => {
  it("blocks parallel calls that would together exceed the cap", async () => {
    const g = guard();
    const slow = () => new Promise((r) => setTimeout(() => r("ok"), 10));
    const results = await Promise.allSettled([g.run(100, "a", slow), g.run(100, "b", slow)]);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);
  });

  it("blocks parallel duplicates", async () => {
    const g = guard();
    const slow = () => new Promise((r) => setTimeout(() => r("ok"), 10));
    const results = await Promise.allSettled([g.run(10, "a", slow), g.run(10, "a", slow)]);
    expect(results[1].status).toBe("rejected");
  });

  it("keeps the amount counted after a timeout or 5xx (the money may have moved)", async () => {
    const g = guard();
    await expect(g.run(100, "a", async () => { throw new Error("timeout"); })).rejects.toThrow();
    await expect(g.run(100, "b", async () => "ok")).rejects.toBeInstanceOf(SpendingGuardError);
    await expect(g.run(10, "a", async () => "ok")).resolves.toBe("ok"); // different amount
  });

  it("releases the amount when the API definitely rejected it (4xx)", async () => {
    const g = guard();
    await expect(g.run(100, "a", async () => { throw new NombaApiError(400, "X", "bad"); })).rejects.toThrow();
    await expect(g.run(100, "a", async () => "ok")).resolves.toBe("ok");
  });

  it("limits purchases with no known price by count", async () => {
    const g = guard();
    await g.runUnpriced("p1", async () => 1);
    await g.runUnpriced("p2", async () => 1);
    await expect(g.runUnpriced("p3", async () => 1)).rejects.toBeInstanceOf(SpendingGuardError);
  });
});

describe("config", () => {
  it("rejects zero, negative and non-numeric limits instead of using the default", () => {
    for (const bad of ["0", "-5", "abc", "NaN"]) expect(() => parsePositive("X", bad, 1)).toThrow();
    expect(parsePositive("X", undefined, 7)).toBe(7);
  });

  it("classifies the base URL by parsed hostname", () => {
    expect(classifyBaseUrl("https://API.NOMBA.COM", false)).toBe("production");
    expect(classifyBaseUrl("https://sandbox.nomba.com", false)).toBe("sandbox");
    expect(() => classifyBaseUrl("https://api.nomba.com.evil.tld", false)).toThrow();
    expect(classifyBaseUrl("http://127.0.0.1:1", true)).toBe("other");
  });

  it("restricts callback hosts only when configured", () => {
    expect(callbackHostAllowed("https://evil.test/x", [])).toBe(true);
    const allowed = parseHostList("example.com");
    expect(callbackHostAllowed("https://hooks.example.com/x", allowed)).toBe(true);
    expect(callbackHostAllowed("https://example.com.evil.test/x", allowed)).toBe(false);
  });

  it("treats 234... and 0... phone numbers as the same", () => {
    expect(normalisePhone("2348012345678")).toBe(normalisePhone("08012345678"));
  });
});

describe("recipient allowlist", () => {
  it("allows anyone when unset, and only listed recipients when set", () => {
    expect(() => assertRecipientAllowed("058:0123456789", "")).not.toThrow();
    expect(() => assertRecipientAllowed("058:0123456789", "058:0123456789, abc-1")).not.toThrow();
    expect(() => assertRecipientAllowed("abc-1", "058:0123456789,abc-1")).not.toThrow();
    expect(() => assertRecipientAllowed("058:0999999999", "058:0123456789")).toThrow();
    expect(() => assertRecipientAllowed("044:0123456789", "058:0123456789")).toThrow();
  });

  it("blocks transfers to unlisted recipients before any request", async () => {
    process.env.NOMBA_ALLOWED_RECIPIENTS = "058:0123456789";
    try {
      const tools = new Map<string, (...a: any[]) => any>();
      const server = { registerTool: (n: string, _c: unknown, cb: any) => void tools.set(n, cb) } as any;
      const client = { post: vi.fn().mockResolvedValue({}) } as unknown as NombaClient;
      registerTransferTools(server, client, guard());
      const r = await tools.get("nomba_transfer_to_bank")!({ amount: 10, accountNumber: "0999999999", bankCode: "058" });
      expect(r.isError).toBe(true);
      expect((client.post as any).mock.calls).toHaveLength(0);
      const ok = await tools.get("nomba_transfer_to_bank")!({ amount: 10, accountNumber: "0123456789", bankCode: "058" });
      expect(ok.isError).toBeUndefined();
    } finally {
      delete process.env.NOMBA_ALLOWED_RECIPIENTS;
    }
  });
});

describe("money tools go through the guard", () => {
  let spy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { spy = vi.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => spy.mockRestore());

  function setup() {
    const tools = new Map<string, (...a: any[]) => any>();
    const server = { registerTool: (n: string, _c: unknown, cb: any) => void tools.set(n, cb) } as any;
    const client = { post: vi.fn().mockResolvedValue({ code: "00" }) } as unknown as NombaClient;
    const g = guard();
    registerCheckoutTools(server, client, g);
    registerAirtimeTools(server, client, g);
    return { tools, client };
  }

  it("counts refunds against the session cap and blocks duplicates", async () => {
    const { tools, client } = setup();
    const refund = tools.get("nomba_refund_transaction")!;
    expect((await refund({ transactionId: "t1", amount: 100 })).isError).toBeUndefined();
    expect((await refund({ transactionId: "t1", amount: 100 })).isError).toBe(true);
    expect((client.post as any).mock.calls).toHaveLength(1);
  });

  it("limits data purchases by count", async () => {
    const { tools, client } = setup();
    const buy = tools.get("nomba_buy_data")!;
    for (const plan of ["p1", "p2"]) await buy({ phoneNumber: "08012345678", dataPlanCode: plan, network: "MTN" });
    const third = await buy({ phoneNumber: "08099999999", dataPlanCode: "p3", network: "MTN" });
    expect(third.isError).toBe(true);
    expect((client.post as any).mock.calls).toHaveLength(2);
  });

  it("does not spend the outbound cap when creating a payment link", async () => {
    const { tools } = setup();
    const create = tools.get("nomba_create_checkout_order")!;
    for (const n of [1, 2, 3, 4]) {
      const r = await create({ amount: 100, customerEmail: `a${n}@x.com`, callbackUrl: "https://x.com" });
      expect(r.isError).toBeUndefined();
    }
  });
});
