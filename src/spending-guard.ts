export interface SpendingGuardConfig {
  maxTransaction: number;
  sessionSpendingCap: number;
  duplicateWindowMs: number;
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
}
