import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ requestId?: string }>();
    return next.handle().pipe(
      map((data) => ({
        data,
        meta: {
          requestId: request.requestId ?? null,
          timestamp: new Date().toISOString()
        }
      }))
    );
  }
}
