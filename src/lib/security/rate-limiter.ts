interface RateRecord {
  timestamps: number[];
  failedAttempts: number;
  lockedUntil: number | null;
}

class InMemoryRateLimiter {
  private store = new Map<string, RateRecord>();

  private getRecord(key: string): RateRecord {
    let rec = this.store.get(key);
    if (!rec) {
      rec = { timestamps: [], failedAttempts: 0, lockedUntil: null };
      this.store.set(key, rec);
    }
    return rec;
  }

  /**
   * Check if a request exceeds request rate limits
   */
  checkLimit(key: string, limit = 60, windowMs = 60_000): { allowed: boolean; remaining: number; resetMs: number } {
    const now = Date.now();
    const rec = this.getRecord(key);

    // Filter out timestamps outside window
    rec.timestamps = rec.timestamps.filter((t) => now - t < windowMs);

    if (rec.timestamps.length >= limit) {
      const oldest = rec.timestamps[0];
      const resetMs = Math.max(0, windowMs - (now - oldest));
      return { allowed: false, remaining: 0, resetMs };
    }

    rec.timestamps.push(now);
    return { allowed: true, remaining: limit - rec.timestamps.length, resetMs: windowMs };
  }

  /**
   * Check if an entity is locked out due to brute-force attempts
   */
  isLockedOut(key: string): { locked: boolean; remainingMs: number } {
    const now = Date.now();
    const rec = this.getRecord(key);
    if (rec.lockedUntil && rec.lockedUntil > now) {
      return { locked: true, remainingMs: rec.lockedUntil - now };
    }
    if (rec.lockedUntil && rec.lockedUntil <= now) {
      rec.lockedUntil = null; // expired lockout
    }
    return { locked: false, remainingMs: 0 };
  }

  /**
   * Register a failed credential attempt with exponential backoff lockout
   */
  recordFailedAttempt(key: string, threshold = 5, baseLockoutMs = 15_000): { locked: boolean; lockedUntilMs: number } {
    const now = Date.now();
    const rec = this.getRecord(key);
    rec.failedAttempts += 1;

    if (rec.failedAttempts >= threshold) {
      const exponent = rec.failedAttempts - threshold;
      const lockoutDuration = Math.min(baseLockoutMs * Math.pow(2, exponent), 3_600_000); // max 1 hour
      rec.lockedUntil = now + lockoutDuration;
      return { locked: true, lockedUntilMs: rec.lockedUntil };
    }

    return { locked: false, lockedUntilMs: 0 };
  }

  /**
   * Clear failed attempts upon successful verification
   */
  clearFailedAttempts(key: string): void {
    const rec = this.store.get(key);
    if (rec) {
      rec.failedAttempts = 0;
      rec.lockedUntil = null;
    }
  }

  /**
   * Reset store (useful for testing)
   */
  resetAll(): void {
    this.store.clear();
  }
}

export const rateLimiter = new InMemoryRateLimiter();
