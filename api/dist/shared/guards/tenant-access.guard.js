"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantAccessGuard = void 0;
const common_1 = require("@nestjs/common");
let TenantAccessGuard = class TenantAccessGuard {
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const tenantId = request.params.tenantId;
        if (!tenantId) {
            return true;
        }
        const hasAccess = request.user.memberships.some((item) => item.tenantId === tenantId);
        if (!hasAccess) {
            throw new common_1.ForbiddenException('Tenant access denied');
        }
        return true;
    }
};
exports.TenantAccessGuard = TenantAccessGuard;
exports.TenantAccessGuard = TenantAccessGuard = __decorate([
    (0, common_1.Injectable)()
], TenantAccessGuard);
