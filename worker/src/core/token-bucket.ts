export class TokenBucket {
  private tokens: number;
  private lastRefillTs: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number
  ) {
    this.tokens = capacity;
    this.lastRefillTs = Date.now();
  }

  tryConsume(amount: number): boolean {
    this.refill();
    if (this.tokens < amount) {
      return false;
    }
    this.tokens -= amount;
    return true;
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefillTs) / 1000;
    if (elapsedSeconds <= 0) {
      return;
    }

    const refillAmount = elapsedSeconds * this.refillPerSecond;
    this.tokens = Math.min(this.capacity, this.tokens + refillAmount);
    this.lastRefillTs = now;
  }
}
