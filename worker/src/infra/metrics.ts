import http from 'node:http';
import { Gauge, Registry, Counter, collectDefaultMetrics } from 'prom-client';

type WorkerCounters = {
  launchJobsProcessed: Counter;
  messageProcessed: Counter;
  messageFailedPermanent: Counter;
  messageRateLimited: Counter;
  messageRetried: Counter;
};

type WorkerGauges = {
  queueDepth: Gauge;
};

export class WorkerMetrics {
  private readonly registry = new Registry();
  private readonly counters: WorkerCounters;
  private readonly gauges: WorkerGauges;

  constructor() {
    collectDefaultMetrics({ register: this.registry });

    this.counters = {
      launchJobsProcessed: new Counter({
        name: 'worker_launch_jobs_processed_total',
        help: 'Total de jobs de launch processados',
        registers: [this.registry]
      }),
      messageProcessed: new Counter({
        name: 'worker_messages_processed_total',
        help: 'Total de mensagens processadas com sucesso',
        registers: [this.registry]
      }),
      messageFailedPermanent: new Counter({
        name: 'worker_messages_failed_permanent_total',
        help: 'Total de mensagens com falha permanente',
        registers: [this.registry]
      }),
      messageRateLimited: new Counter({
        name: 'worker_messages_rate_limited_total',
        help: 'Total de eventos de rate limit no envio',
        registers: [this.registry]
      }),
      messageRetried: new Counter({
        name: 'worker_messages_retried_total',
        help: 'Total de retries enfileirados',
        labelNames: ['stage'],
        registers: [this.registry]
      })
    };

    this.gauges = {
      queueDepth: new Gauge({
        name: 'worker_queue_depth',
        help: 'Profundidade das filas do worker',
        labelNames: ['queue'],
        registers: [this.registry]
      })
    };
  }

  startServer(): void {
    const port = Number(process.env.WORKER_METRICS_PORT ?? 9464);

    const server = http.createServer(async (req, res) => {
      if (req.url !== '/metrics') {
        res.statusCode = 404;
        res.end('not found');
        return;
      }

      const metrics = await this.registry.metrics();
      res.statusCode = 200;
      res.setHeader('Content-Type', this.registry.contentType);
      res.end(metrics);
    });

    server.listen(port);
  }

  incLaunchProcessed(): void {
    this.counters.launchJobsProcessed.inc();
  }

  incMessageProcessed(): void {
    this.counters.messageProcessed.inc();
  }

  incMessageFailedPermanent(): void {
    this.counters.messageFailedPermanent.inc();
  }

  incMessageRateLimited(): void {
    this.counters.messageRateLimited.inc();
  }

  incMessageRetried(stage: 'campaign' | 'message'): void {
    this.counters.messageRetried.inc({ stage });
  }

  setQueueDepth(queue: string, depth: number): void {
    this.gauges.queueDepth.set({ queue }, depth);
  }
}
