import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PlanRateLimiter } from '../infra/plan-rate-limiter';

describe('PlanRateLimiter', () => {
  it('does not block when redis is disabled', async () => {
    delete process.env.REDIS_URL;
    const limiter = new PlanRateLimiter();

    await assert.doesNotReject(async () => {
      await limiter.assertAllowed('tenant-a', 'starter');
    });

    await limiter.close();
  });

  it('parses custom limits config without crashing', async () => {
    process.env.PLAN_LIMITS_PER_MINUTE = 'starter:10,pro:50,default:15';
    delete process.env.REDIS_URL;

    const limiter = new PlanRateLimiter();
    await assert.doesNotReject(async () => {
      await limiter.assertAllowed('tenant-b', 'pro');
    });
    await limiter.close();
  });
});
