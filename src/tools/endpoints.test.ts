// Contract test: every tool must call the method and path documented in Nomba's API
// reference (https://developer.nomba.com/nomba-api-reference/introduction).
// If you add a tool, add a row. If Nomba moves an endpoint, this table is the one place
// to update.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NombaClient } from "../client.js";
import { SpendingGuard } from "../spending-guard.js";
import { registerAccountTools } from "./accounts.js";
import { registerTransferTools } from "./transfers.js";
import { registerCheckoutTools } from "./checkout.js";
import { registerVirtualAccountTools } from "./virtual-accounts.js";
import { registerTransactionTools } from "./transactions.js";
import { registerBillTools } from "./bills/index.js";
import { registerAirtimeTools } from "./airtime.js";
import { registerSubAccountTools } from "./sub-accounts.js";

type Call = { method: string; path: string; args: unknown[] };

const EXPECTED: Array<
  [tool: string, input: Record<string, unknown>, method: string, path: string]
> = [
  ["nomba_get_parent_account", {}, "GET", "/v1/accounts/parent"],
  ["nomba_get_parent_balance", {}, "GET", "/v1/accounts/balance"],
  ["nomba_list_terminals", {}, "GET", "/v1/accounts/terminals"],
  ["nomba_assign_terminal", { serialNumber: "SN1" }, "POST", "/v1/terminals/assign"],
  ["nomba_unassign_terminal", { serialNumber: "SN1" }, "POST", "/v1/terminals/unassign"],

  [
    "nomba_get_sub_account",
    { accountRef: "ref-1" },
    "GET",
    "/v1/accounts/sub-account-details",
  ],
  [
    "nomba_get_sub_account_balance",
    { accountId: "sub1" },
    "GET",
    "/v1/accounts/sub1/balance",
  ],
  [
    "nomba_list_sub_account_terminals",
    { accountId: "sub1" },
    "GET",
    "/v1/accounts/sub1/terminals",
  ],

  ["nomba_list_banks", {}, "GET", "/v1/transfers/banks"],
  [
    "nomba_lookup_bank_account",
    { accountNumber: "0123456789", bankCode: "058" },
    "POST",
    "/v1/transfers/bank/lookup",
  ],
  [
    "nomba_transfer_to_bank",
    { amount: 100, accountNumber: "0123456789", accountName: "A B", bankCode: "058" },
    "POST",
    "/v2/transfers/bank",
  ],
  [
    "nomba_transfer_between_accounts",
    { amount: 100, destinationAccountId: "acc2" },
    "POST",
    "/v2/transfers/wallet",
  ],

  [
    "nomba_create_checkout_order",
    { amount: 100, customerEmail: "a@b.co", callbackUrl: "https://x.co" },
    "POST",
    "/v1/checkout/order",
  ],
  [
    "nomba_charge_tokenized_card",
    {
      amount: 100,
      tokenizedCardId: "tok1",
      customerEmail: "a@b.co",
      callbackUrl: "https://x.co",
    },
    "POST",
    "/v1/checkout/tokenized-card-payment",
  ],
  ["nomba_refund_transaction", { transactionId: "tx1" }, "POST", "/v1/checkout/refund"],
  [
    "nomba_get_checkout_transaction",
    { orderReference: "ord1" },
    "GET",
    "/v1/checkout/transaction",
  ],
  [
    "nomba_cancel_transaction",
    { orderReference: "ord1" },
    "POST",
    "/v1/checkout/order/cancel",
  ],

  [
    "nomba_create_virtual_account",
    { accountName: "Daniel Scorsese" },
    "POST",
    "/v1/accounts/virtual",
  ],
  [
    "nomba_get_virtual_account",
    { identifier: "ref1" },
    "GET",
    "/v1/accounts/virtual/ref1",
  ],
  [
    "nomba_update_virtual_account",
    { identifier: "ref1", accountName: "New Name Here" },
    "PUT",
    "/v1/accounts/virtual/ref1",
  ],
  [
    "nomba_expire_virtual_account",
    { identifier: "ref1" },
    "DELETE",
    "/v1/accounts/virtual/ref1",
  ],
  ["nomba_list_virtual_accounts", {}, "POST", "/v1/accounts/virtual/list"],

  ["nomba_list_bank_transactions", {}, "GET", "/v1/transactions/bank"],
  [
    "nomba_requery_transaction",
    { sessionId: "sess1" },
    "GET",
    "/v1/transactions/requery/sess1",
  ],
  [
    "nomba_get_transaction",
    { transactionId: "tx1" },
    "GET",
    "/v1/transactions/accounts/single",
  ],
  [
    "nomba_filter_transactions",
    { status: "SUCCESS" },
    "POST",
    "/v1/transactions/accounts",
  ],

  ["nomba_get_electricity_providers", {}, "GET", "/v1/bill/electricity/discos"],
  [
    "nomba_lookup_electricity_customer",
    { meterNumber: "m1", providerCode: "ikedc" },
    "GET",
    "/v1/bill/electricity/lookup",
  ],
  [
    "nomba_buy_electricity",
    { meterNumber: "m1", providerCode: "ikedc", meterType: "prepaid", amount: 1000 },
    "POST",
    "/v2/bill/electricity",
  ],
  ["nomba_list_cable_plans", { providerCode: "dstv" }, "GET", "/v1/bill/cableTvProduct"],
  [
    "nomba_lookup_cable_customer",
    { smartcardNumber: "s1", providerCode: "dstv" },
    "GET",
    "/v1/bill/cabletv/lookup",
  ],
  [
    "nomba_pay_cable_subscription",
    { smartcardNumber: "s1", providerCode: "dstv", amount: 1000 },
    "POST",
    "/v2/bill/cabletv",
  ],
  ["nomba_get_betting_providers", {}, "GET", "/v1/bill/betting/providers"],
  [
    "nomba_lookup_betting_customer",
    { customerId: "c1", providerCode: "bet9ja" },
    "GET",
    "/v1/bill/betting/lookup",
  ],
  [
    "nomba_fund_betting_account",
    { customerId: "c1", providerCode: "bet9ja", amount: 1000 },
    "POST",
    "/v2/bill/betting",
  ],

  [
    "nomba_buy_airtime",
    { phoneNumber: "08012345678", amount: 100, network: "MTN" },
    "POST",
    "/v2/bill/topup",
  ],
  ["nomba_list_data_plans", { network: "GLO" }, "GET", "/v1/bill/data-plan/glo"],
  [
    "nomba_buy_data",
    { phoneNumber: "08012345678", dataPlanCode: "p1", amount: 500, network: "MTN" },
    "POST",
    "/v2/bill/data",
  ],
];

function setup() {
  const tools = new Map<string, (input: unknown) => Promise<any>>();
  const server = {
    registerTool: (name: string, _c: unknown, cb: (input: unknown) => Promise<any>) =>
      tools.set(name, cb),
    registerResource: () => {},
  } as any;
  const calls: Call[] = [];
  const record =
    (method: string) =>
    async (path: string, ...args: unknown[]) => {
      calls.push({ method, path, args });
      return { code: "00", data: {} };
    };
  const client = {
    get: record("GET"),
    post: record("POST"),
    put: record("PUT"),
    patch: record("PATCH"),
    delete: record("DELETE"),
  } as unknown as NombaClient;
  const guard = () =>
    new SpendingGuard({
      maxTransaction: 100_000,
      sessionSpendingCap: 10_000_000,
      duplicateWindowMs: 0,
    });
  registerAccountTools(server, client);
  registerSubAccountTools(server, client);
  registerTransferTools(server, client, guard());
  registerCheckoutTools(server, client, guard());
  registerVirtualAccountTools(server, client);
  registerTransactionTools(server, client);
  registerBillTools(server, client, guard());
  registerAirtimeTools(server, client, guard());
  return { tools, calls };
}

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

describe("tool endpoints match the official API reference", () => {
  it("covers every registered tool", () => {
    const { tools } = setup();
    // nomba_get_cable_providers returns the documented cableTvType values without a call
    expect([...tools.keys()].sort()).toEqual(
      [...EXPECTED.map((e) => e[0]), "nomba_get_cable_providers"].sort()
    );
  });

  it.each(EXPECTED)("%s → %s %s", async (tool, input, method, path) => {
    const { tools, calls } = setup();
    const result = await tools.get(tool)!(input);
    expect(result.isError, JSON.stringify(result)).toBeFalsy();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method, path });
  });

  it("outflows send a merchantTxRef", async () => {
    const { tools, calls } = setup();
    for (const name of [
      "nomba_transfer_to_bank",
      "nomba_transfer_between_accounts",
      "nomba_buy_airtime",
      "nomba_buy_data",
      "nomba_buy_electricity",
      "nomba_pay_cable_subscription",
      "nomba_fund_betting_account",
    ]) {
      const [, input] = EXPECTED.find((e) => e[0] === name)!;
      await tools.get(name)!(input);
    }
    for (const call of calls) {
      expect((call.args[0] as any).merchantTxRef, call.path).toMatch(/^mcp-/);
    }
  });

  it("bank transfer sends the fields /v2/transfers/bank requires", async () => {
    const { tools, calls } = setup();
    await tools.get("nomba_transfer_to_bank")!({
      amount: 100,
      accountNumber: "0123456789",
      accountName: "A B",
      bankCode: "058",
      merchantTxRef: "my-ref",
    });
    expect(calls[0].args[0]).toEqual({
      amount: 100,
      accountNumber: "0123456789",
      accountName: "A B",
      bankCode: "058",
      merchantTxRef: "my-ref",
    });
  });
});
