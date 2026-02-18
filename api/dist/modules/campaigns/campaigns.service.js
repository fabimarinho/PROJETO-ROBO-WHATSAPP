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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampaignsService = void 0;
const common_1 = require("@nestjs/common");
const postgres_service_1 = require("../../shared/database/postgres.service");
const rabbit_publisher_service_1 = require("../../shared/messaging/rabbit-publisher.service");
let CampaignsService = class CampaignsService {
    db;
    publisher;
    constructor(db, publisher) {
        this.db = db;
        this.publisher = publisher;
    }
    async create(input) {
        const templateRes = await this.db.query(`insert into templates (tenant_id, name, language_code, category, status)
       values ($1, $2, 'pt_BR', 'MARKETING', 'approved')
       on conflict (tenant_id, name, language_code)
       do update set category = excluded.category
       returning id`, [input.tenantId, input.templateName]);
        const templateId = templateRes.rows[0].id;
        const campaignRes = await this.db.query(`insert into campaigns (tenant_id, name, template_id, status, created_by)
       values ($1, $2, $3, 'draft', $4)
       returning id, tenant_id, name, status, created_at,
       (select name from templates where id = $3) as template_name`, [input.tenantId, input.name, templateId, input.createdBy]);
        return this.toCampaign(campaignRes.rows[0]);
    }
    async launch(tenantId, campaignId) {
        const exists = await this.getOrThrow(tenantId, campaignId);
        await this.db.query(`update campaigns
       set status = 'running'
       where id = $1 and tenant_id = $2`, [campaignId, tenantId]);
        await this.publisher.publish(process.env.RABBITMQ_CAMPAIGN_QUEUE ?? 'campaign.launch', {
            tenantId,
            campaignId,
            requestedAt: new Date().toISOString(),
            requestId: `${tenantId}:${campaignId}`
        });
        return {
            ...exists,
            status: 'running'
        };
    }
    async getMetrics(tenantId, campaignId) {
        await this.getOrThrow(tenantId, campaignId);
        const metricsRes = await this.db.query(`select
        count(*) filter (where status = 'queued')::text as queued,
        count(*) filter (where status in ('sent','accepted_meta'))::text as sent,
        count(*) filter (where status = 'delivered')::text as delivered,
        count(*) filter (where status like 'failed%')::text as failed
      from campaign_messages
      where tenant_id = $1 and campaign_id = $2`, [tenantId, campaignId]);
        const row = metricsRes.rows[0] ?? { queued: '0', sent: '0', delivered: '0', failed: '0' };
        return {
            queued: Number(row.queued),
            sent: Number(row.sent),
            delivered: Number(row.delivered),
            failed: Number(row.failed)
        };
    }
    async listByTenant(tenantId) {
        const res = await this.db.query(`select c.id, c.tenant_id, c.name, c.status, c.created_at, t.name as template_name
       from campaigns c
       inner join templates t on t.id = c.template_id
       where c.tenant_id = $1
       order by c.created_at desc`, [tenantId]);
        return res.rows.map((item) => this.toCampaign(item));
    }
    async getOrThrow(tenantId, campaignId) {
        const res = await this.db.query(`select c.id, c.tenant_id, c.name, c.status, c.created_at, t.name as template_name
       from campaigns c
       inner join templates t on t.id = c.template_id
       where c.id = $1 and c.tenant_id = $2
       limit 1`, [campaignId, tenantId]);
        const campaign = res.rows[0];
        if (!campaign) {
            throw new common_1.NotFoundException('Campaign not found');
        }
        return this.toCampaign(campaign);
    }
    toCampaign(row) {
        return {
            id: row.id,
            tenantId: row.tenant_id,
            name: row.name,
            templateName: row.template_name,
            status: row.status,
            createdAt: row.created_at
        };
    }
};
exports.CampaignsService = CampaignsService;
exports.CampaignsService = CampaignsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [postgres_service_1.PostgresService,
        rabbit_publisher_service_1.RabbitPublisherService])
], CampaignsService);
