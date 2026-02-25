import { Controller, Get } from '@nestjs/common';
import { Roles } from '../../shared/decorators/roles.decorator';

@Controller('queue')
export class QueueController {
  @Roles('owner', 'admin')
  @Get('health')
  health(): { status: 'ok'; engine: 'bullmq' } {
    return { status: 'ok', engine: 'bullmq' };
  }
}
