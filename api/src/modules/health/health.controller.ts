import { Controller, Get } from '@nestjs/common';
import { Public } from '../../shared/decorators/public.decorator';
import { PostgresService } from '../../shared/database/postgres.service';
import { MetricsService } from '../../shared/observability/metrics.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly db: PostgresService,
    private readonly metrics: MetricsService
  ) {}

  @Public()
  @Get()
  async check(): Promise<{
    status: 'ok' | 'degraded';
    timestamp: string;
    db: 'up' | 'down';
    uptimeSeconds: number;
  }> {
    let dbStatus: 'up' | 'down' = 'up';

    try {
      await this.db.query('select 1');
    } catch {
      dbStatus = 'down';
    }

    const snapshot = this.metrics.snapshot();
    return {
      status: dbStatus === 'up' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      db: dbStatus,
      uptimeSeconds: snapshot.uptimeSeconds
    };
  }
}
