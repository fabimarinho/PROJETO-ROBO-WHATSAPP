import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MetricsService } from '../shared/observability/metrics.service';

describe('MetricsService', () => {
  it('exports latency histogram metrics in prometheus format', () => {
    const metrics = new MetricsService();

    metrics.record('/v1/health', 'GET', 200, 42);
    metrics.record('/v1/health', 'GET', 503, 700);

    const text = metrics.toPrometheus();

    assert.match(text, /app_requests_total 2/);
    assert.match(text, /app_errors_total 1/);
    assert.match(text, /app_request_duration_ms_bucket\{le="50"\} 1/);
    assert.match(text, /app_request_duration_ms_bucket\{le="1000"\} 2/);
    assert.match(text, /app_request_duration_ms_count 2/);
  });
});
