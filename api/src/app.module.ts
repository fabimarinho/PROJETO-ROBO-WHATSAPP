import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { BillingController } from './modules/billing/billing.controller';
import { BillingWebhookController } from './modules/billing/billing-webhook.controller';
import { BillingService } from './modules/billing/billing.service';
import { CampaignsController } from './modules/campaigns/campaigns.controller';
import { CampaignsService } from './modules/campaigns/campaigns.service';
import { ContactsController } from './modules/contacts/contacts.controller';
import { ContactsService } from './modules/contacts/contacts.service';
import { HealthController } from './modules/health/health.controller';
import { MessagingController } from './modules/messaging/messaging.controller';
import { MessageVariationService } from './modules/messaging/message-variation.service';
import { MessagingService } from './modules/messaging/messaging.service';
import { WhatsAppCloudClient } from './modules/messaging/whatsapp-cloud.client';
import { MetricsController } from './modules/metrics/metrics.controller';
import { QueueController } from './modules/queue/queue.controller';
import { QueueService } from './modules/queue/queue.service';
import { TenantsController } from './modules/tenants/tenants.controller';
import { TenantsService } from './modules/tenants/tenants.service';
import { UsersController } from './modules/users/users.controller';
import { UsersService } from './modules/users/users.service';
import { WebhooksController } from './modules/webhooks/webhooks.controller';
import { WebhooksService } from './modules/webhooks/webhooks.service';
import { PostgresService } from './shared/database/postgres.service';
import { TenantRateLimitGuard } from './shared/guards/tenant-rate-limit.guard';
import { JwtAuthGuard } from './shared/guards/jwt-auth.guard';
import { RolesGuard } from './shared/guards/roles.guard';
import { HttpLoggingInterceptor } from './shared/interceptors/http-logging.interceptor';
import { ResponseEnvelopeInterceptor } from './shared/interceptors/response-envelope.interceptor';
import { StructuredLoggerService } from './shared/logging/structured-logger.service';
import { RequestContextMiddleware } from './shared/middleware/request-context.middleware';
import { MetricsService } from './shared/observability/metrics.service';
import { RequestLoggingMiddleware } from './shared/observability/request-logging.middleware';

@Module({
  imports: [],
  controllers: [
    HealthController,
    MetricsController,
    AuthController,
    TenantsController,
    CampaignsController,
    ContactsController,
    WebhooksController,
    QueueController,
    UsersController,
    MessagingController,
    BillingController,
    BillingWebhookController
  ],
  providers: [
    StructuredLoggerService,
    PostgresService,
    MetricsService,
    QueueService,
    TenantsService,
    CampaignsService,
    AuthService,
    WebhooksService,
    ContactsService,
    UsersService,
    MessagingService,
    MessageVariationService,
    BillingService,
    WhatsAppCloudClient,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard
    },
    {
      provide: APP_GUARD,
      useClass: TenantRateLimitGuard
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggingInterceptor
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseEnvelopeInterceptor
    }
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestContextMiddleware, RequestLoggingMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
