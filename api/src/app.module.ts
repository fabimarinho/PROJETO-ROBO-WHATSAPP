import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './modules/health/health.controller';
import { TenantsController } from './modules/tenants/tenants.controller';
import { TenantsService } from './modules/tenants/tenants.service';
import { CampaignsController } from './modules/campaigns/campaigns.controller';
import { CampaignsService } from './modules/campaigns/campaigns.service';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { JwtAuthGuard } from './shared/guards/jwt-auth.guard';
import { RolesGuard } from './shared/guards/roles.guard';
import { PostgresService } from './shared/database/postgres.service';
import { RabbitPublisherService } from './shared/messaging/rabbit-publisher.service';
import { WebhooksController } from './modules/webhooks/webhooks.controller';
import { WebhooksService } from './modules/webhooks/webhooks.service';
import { ContactsController } from './modules/contacts/contacts.controller';
import { ContactsService } from './modules/contacts/contacts.service';

@Module({
  imports: [],
  controllers: [
    HealthController,
    AuthController,
    TenantsController,
    CampaignsController,
    ContactsController,
    WebhooksController
  ],
  providers: [
    PostgresService,
    RabbitPublisherService,
    TenantsService,
    CampaignsService,
    AuthService,
    WebhooksService,
    ContactsService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard
    }
  ]
})
export class AppModule {}
