"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampaignsController = void 0;
const common_1 = require("@nestjs/common");
const campaigns_service_1 = require("./campaigns.service");
const tenants_service_1 = require("../tenants/tenants.service");
const tenant_access_guard_1 = require("../../shared/guards/tenant-access.guard");
const roles_decorator_1 = require("../../shared/decorators/roles.decorator");
const current_user_decorator_1 = require("../../shared/decorators/current-user.decorator");
let CampaignsController = class CampaignsController {
    campaignsService;
    tenantsService;
    constructor(campaignsService, tenantsService) {
        this.campaignsService = campaignsService;
        this.tenantsService = tenantsService;
    }
    async create(tenantId, body, user) {
        await this.tenantsService.getOrThrow(tenantId);
        return this.campaignsService.create({
            tenantId,
            name: body.name,
            templateName: body.templateName,
            createdBy: user.userId
        });
    }
    async list(tenantId) {
        await this.tenantsService.getOrThrow(tenantId);
        return this.campaignsService.listByTenant(tenantId);
    }
    async launch(tenantId, campaignId) {
        await this.tenantsService.getOrThrow(tenantId);
        return this.campaignsService.launch(tenantId, campaignId);
    }
    async metrics(tenantId, campaignId) {
        await this.tenantsService.getOrThrow(tenantId);
        return this.campaignsService.getMetrics(tenantId, campaignId);
    }
};
exports.CampaignsController = CampaignsController;
__decorate([
    (0, roles_decorator_1.Roles)('owner', 'admin', 'operator'),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Param)('tenantId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], CampaignsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Param)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CampaignsController.prototype, "list", null);
__decorate([
    (0, roles_decorator_1.Roles)('owner', 'admin', 'operator'),
    (0, common_1.Post)(':campaignId/launch'),
    __param(0, (0, common_1.Param)('tenantId')),
    __param(1, (0, common_1.Param)('campaignId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CampaignsController.prototype, "launch", null);
__decorate([
    (0, common_1.Get)(':campaignId/metrics'),
    __param(0, (0, common_1.Param)('tenantId')),
    __param(1, (0, common_1.Param)('campaignId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CampaignsController.prototype, "metrics", null);
exports.CampaignsController = CampaignsController = __decorate([
    (0, common_1.UseGuards)(tenant_access_guard_1.TenantAccessGuard),
    (0, common_1.Controller)('tenants/:tenantId/campaigns'),
    __metadata("design:paramtypes", [campaigns_service_1.CampaignsService,
        tenants_service_1.TenantsService])
], CampaignsController);
