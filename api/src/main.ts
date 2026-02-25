import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { StructuredLoggerService } from './shared/logging/structured-logger.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.useLogger(app.get(StructuredLoggerService));
  app.use(helmet());
  app.setGlobalPrefix('v1');
  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
