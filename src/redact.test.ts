import { describe, it, expect } from "vitest";
import {
  redactResponse,
  PARENT_ACCOUNT_RULES,
  CHECKOUT_RULES,
} from "./redact.js";

describe("redactResponse", () => {
  it("redacts BVN fully from parent account response", () => {
    const data = {
      code: "00",
      data: {
        accountId: "abc-123",
        bvn: "12345678901",
        accountName: "Test Business",
      },
    };
    const result = redactResponse(data, PARENT_ACCOUNT_RULES) as any;
    expect(result.data.bvn).toBe("***REDACTED***");
    expect(result.data.accountId).toBe("abc-123");
    expect(result.data.accountName).toBe("Test Business");
  });

  it("masks bank account numbers in nested banks array", () => {
    const data = {
      data: {
        banks: [
          { bankAccountNumber: "0123456789", bankName: "Access Bank" },
          { bankAccountNumber: "9876543210", bankName: "GTBank" },
        ],
      },
    };
    const result = redactResponse(data, PARENT_ACCOUNT_RULES) as any;
    expect(result.data.banks[0].bankAccountNumber).toBe("******6789");
    expect(result.data.banks[1].bankAccountNumber).toBe("******3210");
    expect(result.data.banks[0].bankName).toBe("Access Bank");
  });

  it("masks tokenized card IDs in checkout response", () => {
    const data = {
      data: {
        tokenizedCardId: "tok_abc123xyz789",
        amount: 5000,
      },
    };
    const result = redactResponse(data, CHECKOUT_RULES) as any;
    expect(result.data.tokenizedCardId).toBe("************z789");
    expect(result.data.amount).toBe(5000);
  });

  it("masks tokenKey in checkout response", () => {
    const data = { data: { tokenKey: "key_secret_value" } };
    const result = redactResponse(data, CHECKOUT_RULES) as any;
    expect(result.data.tokenKey).toBe("************alue");
  });

  it("handles null and undefined gracefully", () => {
    expect(redactResponse(null, PARENT_ACCOUNT_RULES)).toBeNull();
    expect(redactResponse(undefined, PARENT_ACCOUNT_RULES)).toBeUndefined();
  });

  it("passes through primitives unchanged", () => {
    expect(redactResponse(42, PARENT_ACCOUNT_RULES)).toBe(42);
    expect(redactResponse("hello", PARENT_ACCOUNT_RULES)).toBe("hello");
  });

  it("does not modify fields not in rules", () => {
    const data = { status: "ACTIVE", amount: 100 };
    const result = redactResponse(data, PARENT_ACCOUNT_RULES);
    expect(result).toEqual({ status: "ACTIVE", amount: 100 });
  });
});
