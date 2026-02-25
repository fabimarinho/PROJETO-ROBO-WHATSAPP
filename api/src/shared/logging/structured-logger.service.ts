import { Injectable, LoggerService } from '@nestjs/common';

type LogLevel = 'log' | 'error' | 'warn' | 'debug';

@Injectable()
export class StructuredLoggerService implements LoggerService {
  log(message: unknown, context?: string): void {
    this.write('log', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, context, trace);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  private write(level: LogLevel, message: unknown, context?: string, trace?: string): void {
    const payload = {
      ts: new Date().toISOString(),
      level,
      context: context ?? 'app',
      message,
      trace
    };

    if (level === 'error') {
      console.error(JSON.stringify(payload));
      return;
    }

    console.log(JSON.stringify(payload));
  }
}
