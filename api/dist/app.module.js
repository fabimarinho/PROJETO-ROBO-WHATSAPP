"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const health_controller_1 = require("./modules/health/health.controller");
const tenants_controller_1 = require("./modules/tenants/tenants.controller");
const tenants_service_1 = require("./modules/tenants/tenants.service");
const campaigns_controller_1 = require("./modules/campaigns/campaigns.controller");
const campaigns_service_1 = require("./modules/campaigns/campaigns.service");
const auth_controller_1 = require("./modules/auth/auth.controller");
const auth_service_1 = require("./modules/auth/auth.service");
const jwt_auth_guard_1 = require("./shared/guards/jwt-auth.guard");
const roles_guard_1 = require("./shared/guards/roles.guard");
const postgres_service_1 = require("./shared/database/postgres.service");
const rabbit_publisher_service_1 = require("./shared/messaging/rabbit-publisher.service");
const webhooks_controller_1 = require("./modules/webhooks/webhooks.controller");
const webhooks_service_1 = require("./modules/webhooks/webhooks.service");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [],
        controllers: [health_controller_1.HealthController, auth_controller_1.AuthController, tenants_controller_1.TenantsController, campaigns_controller_1.CampaignsController, webhooks_controller_1.WebhooksController],
        providers: [
            postgres_service_1.PostgresService,
            rabbit_publisher_service_1.RabbitPublisherService,
            tenants_service_1.TenantsService,
            campaigns_service_1.CampaignsService,
            auth_service_1.AuthService,
            webhooks_service_1.WebhooksService,
            {
                provide: core_1.APP_GUARD,
                useClass: jwt_auth_guard_1.JwtAuthGuard
            },
            {
                provide: core_1.APP_GUARD,
                useClass: roles_guard_1.RolesGuard
            }
        ]
    })
], AppModule);
