import { Injectable } from '@nestjs/common';

type RouteMetric = {
  count: number;
  errors: number;
  totalDurationMs: number;
};

const LATENCY_BUCKETS_MS = [50, 100, 200, 500, 1000, 2000, 5000];

@Injectable()
export class MetricsService {
  private readonly startedAt = Date.now();
  private readonly routes = new Map<string, RouteMetric>();
  private readonly latencyBucketCounts = new Array<number>(LATENCY_BUCKETS_MS.length).fill(0);
  private latencyCount = 0;
  private latencySumMs = 0;

  record(route: string, method: string, statusCode: number, durationMs: number): void {
    const key = `${method} ${route}`;
    const current = this.routes.get(key) ?? { count: 0, errors: 0, totalDurationMs: 0 };

    current.count += 1;
    current.totalDurationMs += durationMs;
    if (statusCode >= 500) {
      current.errors += 1;
    }

    this.latencyCount += 1;
    this.latencySumMs += durationMs;
    for (let i = 0; i < LATENCY_BUCKETS_MS.length; i += 1) {
      if (durationMs <= LATENCY_BUCKETS_MS[i]) {
        this.latencyBucketCounts[i] += 1;
      }
    }

    this.routes.set(key, current);
  }

  snapshot(): {
    uptimeSeconds: number;
    totals: { requests: number; errors: number };
    routes: Array<{ route: string; count: number; errors: number; avgDurationMs: number }>;
  } {
    const routeEntries = [...this.routes.entries()].map(([route, value]) => ({
      route,
      count: value.count,
      errors: value.errors,
      avgDurationMs: value.count > 0 ? Number((value.totalDurationMs / value.count).toFixed(2)) : 0
    }));

    const totals = routeEntries.reduce(
      (acc, item) => {
        acc.requests += item.count;
        acc.errors += item.errors;
        return acc;
      },
      { requests: 0, errors: 0 }
    );

    return {
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      totals,
      routes: routeEntries
    };
  }

  toPrometheus(): string {
    const lines: string[] = [];
    const snapshot = this.snapshot();

    lines.push('# HELP app_uptime_seconds Uptime in seconds');
    lines.push('# TYPE app_uptime_seconds gauge');
    lines.push(`app_uptime_seconds ${snapshot.uptimeSeconds}`);

    lines.push('# HELP app_requests_total Total HTTP requests');
    lines.push('# TYPE app_requests_total counter');
    lines.push(`app_requests_total ${snapshot.totals.requests}`);

    lines.push('# HELP app_errors_total Total HTTP 5xx responses');
    lines.push('# TYPE app_errors_total counter');
    lines.push(`app_errors_total ${snapshot.totals.errors}`);

    lines.push('# HELP app_route_requests_total Total requests by route');
    lines.push('# TYPE app_route_requests_total counter');
    for (const route of snapshot.routes) {
      const escaped = route.route.replace(/"/g, '\\"');
      lines.push(`app_route_requests_total{route="${escaped}"} ${route.count}`);
    }

    lines.push('# HELP app_request_duration_ms HTTP request latency histogram in milliseconds');
    lines.push('# TYPE app_request_duration_ms histogram');
    for (let i = 0; i < LATENCY_BUCKETS_MS.length; i += 1) {
      lines.push(`app_request_duration_ms_bucket{le="${LATENCY_BUCKETS_MS[i]}"} ${this.latencyBucketCounts[i]}`);
    }
    lines.push(`app_request_duration_ms_bucket{le="+Inf"} ${this.latencyCount}`);
    lines.push(`app_request_duration_ms_sum ${this.latencySumMs}`);
    lines.push(`app_request_duration_ms_count ${this.latencyCount}`);

    return lines.join('\n');
  }
}
