import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { MetricsService } from '../observability/metrics.service';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.originalUrl;
      this.metrics.record(route, req.method, res.statusCode, duration);

      // Structured log for traceability and simple observability.
      console.log(
        JSON.stringify({
          type: 'http_access',
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: duration
        })
      );
    });

    next();
  }
}
