import Redis from 'ioredis';

export class RateLimitError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super('rate_limited');
  }
}

export class PlanRateLimiter {
  private readonly redis: Redis | null;
  private readonly limitsByPlan: Record<string, number>;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    this.redis = redisUrl ? new Redis(redisUrl) : null;
    this.limitsByPlan = this.parseLimits(process.env.PLAN_LIMITS_PER_MINUTE);
  }

  async assertAllowed(tenantId: string, planCode: string): Promise<void> {
    if (!this.redis) {
      return;
    }

    const limit = this.getPlanLimit(planCode);
    const window = this.currentWindow();
    const key = `rate:${tenantId}:${window}`;

    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, 70);
    }

    if (count > limit) {
      throw new RateLimitError(15_000);
    }
  }

  async close(): Promise<void> {
    if (!this.redis) {
      return;
    }

    await this.redis.quit();
  }

  private getPlanLimit(planCode: string): number {
    return this.limitsByPlan[planCode] ?? this.limitsByPlan.default ?? 60;
  }

  private parseLimits(raw?: string): Record<string, number> {
    const base: Record<string, number> = {
      starter: 30,
      pro: 120,
      enterprise: 600,
      default: 60
    };

    if (!raw) {
      return base;
    }

    for (const item of raw.split(',')) {
      const [plan, value] = item.split(':').map((x) => x.trim());
      const parsed = Number(value);
      if (plan && Number.isFinite(parsed) && parsed > 0) {
        base[plan] = parsed;
      }
    }

    return base;
  }

  private currentWindow(): string {
    return Math.floor(Date.now() / 60_000).toString();
  }
}
