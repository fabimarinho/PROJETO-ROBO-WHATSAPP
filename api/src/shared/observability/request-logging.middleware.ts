import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { StructuredLoggerService } from '../logging/structured-logger.service';
import { MetricsService } from './metrics.service';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  constructor(
    private readonly metrics: MetricsService,
    private readonly logger: StructuredLoggerService
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.originalUrl;
      this.metrics.record(route, req.method, res.statusCode, duration);
      this.logger.log(
        {
          type: 'http_access',
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: duration,
          requestId: req.headers['x-request-id']
        },
        'RequestLoggingMiddleware'
      );
    });

    next();
  }
}
