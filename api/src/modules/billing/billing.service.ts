import { Injectable } from '@nestjs/common';
import { PostgresService } from '../../shared/database/postgres.service';

type UsageRow = {
  period_day: string;
  sent_count: string;
  delivered_count: string;
  failed_count: string;
  billable_count: string;
};

@Injectable()
export class BillingService {
  constructor(private readonly db: PostgresService) {}

  async getUsage(tenantId: string, days = 30): Promise<{
    days: number;
    totals: { sent: number; delivered: number; failed: number; billable: number };
    daily: Array<{ day: string; sent: number; delivered: number; failed: number; billable: number }>;
  }> {
    const safeDays = Math.min(Math.max(days, 1), 90);
    const res = await this.db.queryForTenant<UsageRow>(
      tenantId,
      `select period_day::text, sent_count::text, delivered_count::text, failed_count::text, billable_count::text
       from usage_counters
       where tenant_id = $1 and period_day >= current_date - make_interval(days => $2::int)
       order by period_day asc`,
      [tenantId, safeDays]
    );

    const daily = res.rows.map((row) => ({
      day: row.period_day,
      sent: Number(row.sent_count),
      delivered: Number(row.delivered_count),
      failed: Number(row.failed_count),
      billable: Number(row.billable_count)
    }));

    const totals = daily.reduce(
      (acc, item) => ({
        sent: acc.sent + item.sent,
        delivered: acc.delivered + item.delivered,
        failed: acc.failed + item.failed,
        billable: acc.billable + item.billable
      }),
      { sent: 0, delivered: 0, failed: 0, billable: 0 }
    );

    return { days: safeDays, totals, daily };
  }
}
