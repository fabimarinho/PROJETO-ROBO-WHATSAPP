import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../../shared/decorators/public.decorator';
import { MetricsService } from '../../shared/observability/metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @Get('json')
  json(): ReturnType<MetricsService['snapshot']> {
    return this.metrics.snapshot();
  }

  @Public()
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  prometheus(): string {
    return this.metrics.toPrometheus();
  }
}
