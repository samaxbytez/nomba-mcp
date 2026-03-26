import { describe, it, expect, vi, afterEach } from "vitest";
import { SpendingGuard, SpendingGuardError } from "./spending-guard.js";

function createGuard(overrides?: Partial<{ max: number; cap: number; window: number }>) {
  return new SpendingGuard({
    maxTransaction: overrides?.max ?? 100_000,
    sessionSpendingCap: overrides?.cap ?? 500_000,
    duplicateWindowMs: overrides?.window ?? 60_000,
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("SpendingGuard - per-transaction limit", () => {
  it("allows amounts within limit", () => {
    const guard = createGuard({ max: 50_000 });
    expect(() => guard.validate(50_000, "recipient")).not.toThrow();
  });

  it("rejects amounts exceeding limit", () => {
    const guard = createGuard({ max: 50_000 });
    expect(() => guard.validate(50_001, "recipient")).toThrow(SpendingGuardError);
    expect(() => guard.validate(50_001, "recipient")).toThrow("per-transaction limit");
  });
});

describe("SpendingGuard - session spending cap", () => {
  it("tracks cumulative spending", () => {
    const guard = createGuard({ cap: 100_000 });
    guard.validate(60_000, "a");
    guard.record(60_000, "a");
    expect(() => guard.validate(60_000, "b")).toThrow("session spending cap");
  });

  it("allows transactions within cap", () => {
    const guard = createGuard({ cap: 100_000 });
    guard.validate(40_000, "a");
    guard.record(40_000, "a");
    expect(() => guard.validate(40_000, "b")).not.toThrow();
  });
});

describe("SpendingGuard - duplicate detection", () => {
  it("rejects same amount + recipient within window", () => {
    const guard = createGuard();
    guard.validate(5_000, "08012345678");
    guard.record(5_000, "08012345678");
    expect(() => guard.validate(5_000, "08012345678")).toThrow("Duplicate");
  });

  it("allows same amount to different recipient", () => {
    const guard = createGuard();
    guard.validate(5_000, "08012345678");
    guard.record(5_000, "08012345678");
    expect(() => guard.validate(5_000, "08099999999")).not.toThrow();
  });

  it("allows same recipient with different amount", () => {
    const guard = createGuard();
    guard.validate(5_000, "08012345678");
    guard.record(5_000, "08012345678");
    expect(() => guard.validate(6_000, "08012345678")).not.toThrow();
  });

  it("allows duplicate after window expires", () => {
    vi.useFakeTimers();
    const guard = createGuard({ window: 60_000 });

    guard.validate(5_000, "08012345678");
    guard.record(5_000, "08012345678");

    vi.advanceTimersByTime(61_000);

    expect(() => guard.validate(5_000, "08012345678")).not.toThrow();
  });
});
