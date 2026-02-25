import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from '@nestjs/common';
import Redis from 'ioredis';
import { PostgresService } from '../database/postgres.service';

type TenantPlanRow = { plan_code: string };

@Injectable()
export class TenantRateLimitGuard implements CanActivate {
  private readonly limitsByPlan: Record<string, number>;
  private readonly redis: Redis | null;
  private readonly fallback = new Map<string, { count: number; resetAtMs: number }>();
  private readonly cachePlan = new Map<string, { plan: string; expiresAtMs: number }>();

  constructor(private readonly db: PostgresService) {
    this.limitsByPlan = this.parsePlanLimits(process.env.TENANT_RATE_LIMITS_PER_MINUTE);
    const redisUrl = process.env.REDIS_URL;
    this.redis = redisUrl ? new Redis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true }) : null;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      params?: Record<string, string | undefined>;
    }>();
    const tenantId = request.params?.tenantId;
    if (!tenantId) {
      return true;
    }

    const planCode = await this.getTenantPlanCode(tenantId);
    const limit = this.limitsByPlan[planCode] ?? this.limitsByPlan.default ?? 300;
    const minuteBucket = Math.floor(Date.now() / 60000);
    const key = `rate:tenant:${tenantId}:${minuteBucket}`;

    const current = await this.incrementCounter(key);
    if (current > limit) {
      throw new ForbiddenException(`Tenant rate limit exceeded (${limit}/min)`);
    }

    return true;
  }

  private async getTenantPlanCode(tenantId: string): Promise<string> {
    const now = Date.now();
    const cached = this.cachePlan.get(tenantId);
    if (cached && cached.expiresAtMs > now) {
      return cached.plan;
    }

    const res = await this.db.query<TenantPlanRow>('select plan_code from tenants where id = $1 limit 1', [tenantId]);
    const plan = res.rows[0]?.plan_code ?? 'default';
    this.cachePlan.set(tenantId, { plan, expiresAtMs: now + 60_000 });
    return plan;
  }

  private async incrementCounter(key: string): Promise<number> {
    if (!this.redis) {
      return this.incrementFallbackCounter(key);
    }

    try {
      if (this.redis.status === 'wait') {
        await this.redis.connect();
      }
      const tx = this.redis.multi();
      tx.incr(key);
      tx.expire(key, 61, 'NX');
      const result = await tx.exec();
      const counterValue = Number(result?.[0]?.[1] ?? 0);
      return Number.isFinite(counterValue) ? counterValue : this.incrementFallbackCounter(key);
    } catch {
      return this.incrementFallbackCounter(key);
    }
  }

  private incrementFallbackCounter(key: string): number {
    const now = Date.now();
    const state = this.fallback.get(key);
    if (!state || state.resetAtMs <= now) {
      const resetAtMs = now + 61_000;
      this.fallback.set(key, { count: 1, resetAtMs });
      return 1;
    }

    state.count += 1;
    return state.count;
  }

  private parsePlanLimits(value?: string): Record<string, number> {
    const defaults = { starter: 120, pro: 600, enterprise: 1800, default: 300 };
    if (!value) {
      return defaults;
    }

    const parsed: Record<string, number> = { ...defaults };
    for (const token of value.split(',')) {
      const [planRaw, limitRaw] = token.split(':').map((item) => item.trim());
      const limit = Number(limitRaw);
      if (!planRaw || !Number.isFinite(limit) || limit <= 0) {
        continue;
      }
      parsed[planRaw] = limit;
    }

    return parsed;
  }
}
