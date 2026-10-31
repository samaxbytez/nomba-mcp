export interface SpendingGuardConfig {
  maxTransaction: number;
  sessionSpendingCap: number;
  duplicateWindowMs: number;
  /** Purchases with no known price (data bundles, full refunds) allowed per session. */
  maxUnpricedPerSession?: number;
}

interface RecentTransaction {
  amount: number;
  recipient: string;
  timestamp: number;
}

export class SpendingGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpendingGuardError";
  }
}

export class SpendingGuard {
  readonly config: SpendingGuardConfig;
  private sessionTotal = 0;
  private recentTransactions: RecentTransaction[] = [];
  private unpricedCount = 0;

  constructor(config: SpendingGuardConfig) {
    this.config = config;
  }

  validate(amount: number, recipientKey: string): void {
    if (amount > this.config.maxTransaction) {
      throw new SpendingGuardError(
        `Amount ${amount} exceeds per-transaction limit of ${this.config.maxTransaction}`
      );
    }

    if (this.sessionTotal + amount > this.config.sessionSpendingCap) {
      throw new SpendingGuardError(
        `Amount ${amount} would exceed session spending cap of ${this.config.sessionSpendingCap} (current total: ${this.sessionTotal})`
      );
    }

    const now = Date.now();
    this.recentTransactions = this.recentTransactions.filter(
      (t) => now - t.timestamp < this.config.duplicateWindowMs
    );

    const duplicate = this.recentTransactions.find(
      (t) => t.amount === amount && t.recipient === recipientKey
    );
    if (duplicate) {
      throw new SpendingGuardError(
        `Duplicate transaction detected: ${amount} to ${recipientKey} within ${this.config.duplicateWindowMs / 1000}s`
      );
    }
  }

  record(amount: number, recipientKey: string): void {
    this.sessionTotal += amount;
    this.recentTransactions.push({
      amount,
      recipient: recipientKey,
      timestamp: Date.now(),
    });
  }
  /**
   * Checks the limits and reserves the amount before the call, so parallel calls
   * can't all pass the check. The reservation is released only when the API
   * definitely rejected the request (4xx); after a timeout or 5xx the money may
   * have moved, so it stays counted and a retry is treated as a duplicate.
   */
  async run<T>(amount: number, recipientKey: string, fn: () => Promise<T>): Promise<T> {
    this.validate(amount, recipientKey);
    this.record(amount, recipientKey);
    try {
      return await fn();
    } catch (error) {
      if (isDefiniteRejection(error)) this.release(amount, recipientKey);
      throw error;
    }
  }

  /** For purchases whose price the server doesn't know: limited by count instead. */
  async runUnpriced<T>(recipientKey: string, fn: () => Promise<T>): Promise<T> {
    const max = this.config.maxUnpricedPerSession ?? 10;
    if (this.unpricedCount >= max) {
      throw new SpendingGuardError(
        `Limit of ${max} purchases without a known price per session reached`
      );
    }
    this.validate(0, recipientKey);
    this.unpricedCount++;
    this.record(0, recipientKey);
    try {
      return await fn();
    } catch (error) {
      if (isDefiniteRejection(error)) {
        this.unpricedCount--;
        this.release(0, recipientKey);
      }
      throw error;
    }
  }

  private release(amount: number, recipientKey: string): void {
    this.sessionTotal -= amount;
    const i = this.recentTransactions.findIndex(
      (t) => t.amount === amount && t.recipient === recipientKey
    );
    if (i >= 0) this.recentTransactions.splice(i, 1);
  }
}

function isDefiniteRejection(error: unknown): boolean {
  const status = (error as { status?: unknown })?.status;
  return typeof status === "number" && status >= 400 && status < 500;
}
