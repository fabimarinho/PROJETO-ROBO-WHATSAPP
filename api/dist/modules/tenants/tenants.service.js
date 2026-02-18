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
exports.TenantsService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const postgres_service_1 = require("../../shared/database/postgres.service");
let TenantsService = class TenantsService {
    db;
    constructor(db) {
        this.db = db;
    }
    async create(input) {
        const id = (0, node_crypto_1.randomUUID)();
        const res = await this.db.query(`insert into tenants (id, name, plan_code, status)
       values ($1, $2, $3, 'active')
       returning id, name, plan_code, status, created_at`, [id, input.name, input.planCode]);
        return this.toTenant(res.rows[0]);
    }
    async listByUserId(userId) {
        const res = await this.db.query(`select t.id, t.name, t.plan_code, t.status, t.created_at
       from tenants t
       inner join tenant_users tu on tu.tenant_id = t.id
       where tu.user_id = $1 and tu.status = 'active'
       order by t.created_at desc`, [userId]);
        return res.rows.map((row) => this.toTenant(row));
    }
    async getOrThrow(id) {
        const res = await this.db.query('select id, name, plan_code, status, created_at from tenants where id = $1 limit 1', [id]);
        const tenant = res.rows[0];
        if (!tenant) {
            throw new common_1.NotFoundException('Tenant not found');
        }
        return this.toTenant(tenant);
    }
    toTenant(row) {
        return {
            id: row.id,
            name: row.name,
            planCode: row.plan_code,
            status: row.status,
            createdAt: row.created_at
        };
    }
};
exports.TenantsService = TenantsService;
exports.TenantsService = TenantsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [postgres_service_1.PostgresService])
], TenantsService);
