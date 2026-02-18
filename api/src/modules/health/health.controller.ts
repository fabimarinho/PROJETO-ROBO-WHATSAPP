import { Controller, Get } from '@nestjs/common';
import { Public } from '../../shared/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check(): { status: string } {
    return { status: 'ok' };
  }
}
