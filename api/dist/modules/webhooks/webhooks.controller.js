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
exports.WebhooksController = void 0;
const common_1 = require("@nestjs/common");
const public_decorator_1 = require("../../shared/decorators/public.decorator");
const webhooks_service_1 = require("./webhooks.service");
let WebhooksController = class WebhooksController {
    webhooksService;
    constructor(webhooksService) {
        this.webhooksService = webhooksService;
    }
    verify(mode, verifyToken, challenge) {
        const expected = process.env.META_WEBHOOK_VERIFY_TOKEN ?? 'dev-verify-token';
        if (mode === 'subscribe' && verifyToken === expected) {
            return challenge;
        }
        throw new common_1.UnauthorizedException('Invalid verify token');
    }
    async receive(tenantId, req, body, signature) {
        const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(body));
        const signatureOk = await this.webhooksService.verifySignature(rawBody, signature);
        await this.webhooksService.storeEvent(tenantId, body, signatureOk);
        return { received: true, signatureOk };
    }
};
exports.WebhooksController = WebhooksController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('hub.mode')),
    __param(1, (0, common_1.Query)('hub.verify_token')),
    __param(2, (0, common_1.Query)('hub.challenge')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", String)
], WebhooksController.prototype, "verify", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('tenantId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)('x-hub-signature-256')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, String]),
    __metadata("design:returntype", Promise)
], WebhooksController.prototype, "receive", null);
exports.WebhooksController = WebhooksController = __decorate([
    (0, common_1.Controller)('webhooks/meta/whatsapp/:tenantId'),
    __metadata("design:paramtypes", [webhooks_service_1.WebhooksService])
], WebhooksController);
