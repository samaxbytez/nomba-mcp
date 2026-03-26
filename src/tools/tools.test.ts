import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NombaClient } from "../client.js";
import { SpendingGuard } from "../spending-guard.js";
import { registerAccountTools } from "./accounts.js";
import { registerCheckoutTools } from "./checkout.js";
import { registerVirtualAccountTools } from "./virtual-accounts.js";
import { registerAirtimeTools } from "./airtime.js";
import { registerBillTools } from "./bills/index.js";
import { registerBankListResource } from "../resources/bank-list.js";
import { CACHE_TTL_MS } from "../utils.js";

// Mock McpServer that captures tool/resource handlers
type ToolHandler = (...args: any[]) => any;

function createMockServer() {
  const tools = new Map<string, ToolHandler>();
  const resources = new Map<string, ToolHandler>();
  return {
    server: {
      registerTool: vi.fn(
        (name: string, _config: unknown, cb: ToolHandler) => {
          tools.set(name, cb);
        }
      ),
      registerResource: vi.fn(
        (_name: string, _uri: string, _meta: unknown, cb: ToolHandler) => {
          resources.set(_name, cb);
        }
      ),
    } as any,
    tools,
    resources,
  };
}

function createMockGuard() {
  return new SpendingGuard({
    maxTransaction: 100_000,
    sessionSpendingCap: 500_000,
    duplicateWindowMs: 60_000,
  });
}

function createMockClient() {
  return {
    get: vi.fn().mockResolvedValue({ code: "00", data: "mock" }),
    post: vi.fn().mockResolvedValue({ code: "00", data: "mock" }),
    patch: vi.fn().mockResolvedValue({ code: "00", data: "mock" }),
  } as unknown as NombaClient;
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // Suppress logToolCall output during tests
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("registerAccountTools", () => {
  it("registers 5 tools (3 account + 2 terminal)", () => {
    const { server } = createMockServer();
    const client = createMockClient();
    registerAccountTools(server, client);
    expect(server.registerTool).toHaveBeenCalledTimes(5);
  });

  it("nomba_get_parent_account calls client.get and returns jsonResponse", async () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerAccountTools(server, client);

    const handler = tools.get("nomba_get_parent_account")!;
    const result = await handler({});

    expect(client.get).toHaveBeenCalledWith("/v1/accounts/parent");
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({
      code: "00",
      data: "mock",
    });
  });

  it("returns errorResponse when client throws", async () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    (client.get as any).mockRejectedValue(new Error("connection failed"));
    registerAccountTools(server, client);

    const handler = tools.get("nomba_get_parent_account")!;
    const result = await handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("Error: connection failed");
  });
});

describe("registerCheckoutTools - body construction", () => {
  it("nomba_create_checkout_order builds nested body with currency: NGN", async () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerCheckoutTools(server, client, createMockGuard());

    const handler = tools.get("nomba_create_checkout_order")!;
    await handler({
      amount: 5000,
      customerEmail: "test@example.com",
      callbackUrl: "https://example.com/callback",
      orderReference: "ORD-123",
      customerId: "CUST-1",
      tokenizeCard: true,
    });

    expect(client.post).toHaveBeenCalledWith("/v1/checkout/order", {
      order: {
        amount: 5000,
        currency: "NGN",
        customerEmail: "test@example.com",
        callbackUrl: "https://example.com/callback",
        orderReference: "ORD-123",
        customerId: "CUST-1",
      },
      tokenizeCard: true,
    });
  });
});

describe("registerCheckoutTools - refund body", () => {
  it("omits amount when undefined", async () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerCheckoutTools(server, client, createMockGuard());

    const handler = tools.get("nomba_refund_transaction")!;
    await handler({ transactionId: "TXN-1", amount: undefined });

    expect(client.post).toHaveBeenCalledWith("/v1/checkout/refund", {
      transactionId: "TXN-1",
    });
  });

  it("includes amount when provided", async () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerCheckoutTools(server, client, createMockGuard());

    const handler = tools.get("nomba_refund_transaction")!;
    await handler({ transactionId: "TXN-1", amount: 500 });

    expect(client.post).toHaveBeenCalledWith("/v1/checkout/refund", {
      transactionId: "TXN-1",
      amount: 500,
    });
  });
});

describe("registerVirtualAccountTools - buildParams", () => {
  it("nomba_list_virtual_accounts passes params correctly", async () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerVirtualAccountTools(server, client);

    const handler = tools.get("nomba_list_virtual_accounts")!;
    await handler({ limit: 10, cursor: undefined });

    expect(client.get).toHaveBeenCalledWith("/v1/accounts/virtual", {
      limit: "10",
    });
  });
});

describe("registerAirtimeTools - conditional fields", () => {
  it("nomba_buy_airtime includes network when provided", async () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerAirtimeTools(server, client, createMockGuard());

    const handler = tools.get("nomba_buy_airtime")!;
    await handler({ phoneNumber: "08012345678", amount: 100, network: "MTN" });

    expect(client.post).toHaveBeenCalledWith("/v1/bills/airtime/pay", {
      phoneNumber: "08012345678",
      amount: 100,
      network: "MTN",
    });
  });

  it("nomba_buy_airtime omits network when falsy", async () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerAirtimeTools(server, client, createMockGuard());

    const handler = tools.get("nomba_buy_airtime")!;
    await handler({
      phoneNumber: "08012345678",
      amount: 100,
      network: undefined,
    });

    expect(client.post).toHaveBeenCalledWith("/v1/bills/airtime/pay", {
      phoneNumber: "08012345678",
      amount: 100,
    });
  });
});

describe("registerBillTools", () => {
  it("registers all 8 bill tools", () => {
    const { server } = createMockServer();
    const client = createMockClient();
    registerBillTools(server, client, createMockGuard());
    expect(server.registerTool).toHaveBeenCalledTimes(8);
  });
});

describe("bank list resource - caching", () => {
  it("caches after first fetch", async () => {
    const { server, resources } = createMockServer();
    const client = createMockClient();
    registerBankListResource(server, client);

    const handler = resources.get("bank-list")!;
    await handler();
    await handler();

    // Only 1 client.get call despite 2 handler calls
    expect(client.get).toHaveBeenCalledTimes(1);
  });

  it("re-fetches after cache TTL expires", async () => {
    vi.useFakeTimers();
    const { server, resources } = createMockServer();
    const client = createMockClient();
    registerBankListResource(server, client);

    const handler = resources.get("bank-list")!;
    await handler(); // fetch 1

    // Advance past 24h TTL
    vi.advanceTimersByTime(CACHE_TTL_MS + 1000);

    await handler(); // should re-fetch

    expect(client.get).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
