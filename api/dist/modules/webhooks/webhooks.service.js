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
exports.WebhooksService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const postgres_service_1 = require("../../shared/database/postgres.service");
let WebhooksService = class WebhooksService {
    db;
    constructor(db) {
        this.db = db;
    }
    async verifySignature(rawBody, signatureHeader) {
        const appSecret = process.env.META_APP_SECRET;
        if (!appSecret || !signatureHeader || !signatureHeader.startsWith('sha256=')) {
            return false;
        }
        const expected = `sha256=${(0, node_crypto_1.createHmac)('sha256', appSecret).update(rawBody).digest('hex')}`;
        const expectedBuffer = Buffer.from(expected);
        const receivedBuffer = Buffer.from(signatureHeader);
        if (expectedBuffer.length !== receivedBuffer.length) {
            return false;
        }
        return (0, node_crypto_1.timingSafeEqual)(expectedBuffer, receivedBuffer);
    }
    async storeEvent(tenantId, payload, signatureOk) {
        await this.db.query(`insert into webhook_events (tenant_id, source, payload_jsonb, signature_ok, processed_at)
       values ($1, 'meta_whatsapp', $2::jsonb, $3, now())`, [tenantId, JSON.stringify(payload), signatureOk]);
    }
};
exports.WebhooksService = WebhooksService;
exports.WebhooksService = WebhooksService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [postgres_service_1.PostgresService])
], WebhooksService);
