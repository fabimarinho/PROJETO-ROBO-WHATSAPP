import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { StructuredLoggerService } from '../logging/structured-logger.service';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: StructuredLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const now = Date.now();
    const request = context.switchToHttp().getRequest<{
      method?: string;
      originalUrl?: string;
      requestId?: string;
      user?: { userId: string };
    }>();
    const response = context.switchToHttp().getResponse<{ statusCode?: number }>();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            {
              type: 'http_request',
              method: request.method,
              path: request.originalUrl,
              statusCode: response.statusCode,
              durationMs: Date.now() - now,
              requestId: request.requestId,
              userId: request.user?.userId
            },
            'HttpLoggingInterceptor'
          );
        },
        error: (error: unknown) => {
          this.logger.error(
            {
              type: 'http_error',
              method: request.method,
              path: request.originalUrl,
              statusCode: response.statusCode,
              durationMs: Date.now() - now,
              requestId: request.requestId
            },
            error instanceof Error ? error.stack : undefined,
            'HttpLoggingInterceptor'
          );
        }
      })
    );
  }
}
