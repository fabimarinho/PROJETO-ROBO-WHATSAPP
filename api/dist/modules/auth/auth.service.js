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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const bcryptjs_1 = require("bcryptjs");
const node_crypto_1 = require("node:crypto");
const jsonwebtoken_1 = require("jsonwebtoken");
const postgres_service_1 = require("../../shared/database/postgres.service");
let AuthService = class AuthService {
    db;
    bootstrapReady = false;
    constructor(db) {
        this.db = db;
    }
    async login(email, password) {
        await this.ensureBootstrapUser();
        const userRes = await this.db.query('select id, email, password_hash from users where email = $1 limit 1', [email]);
        const user = userRes.rows[0];
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const isValid = await (0, bcryptjs_1.compare)(password, user.password_hash);
        if (!isValid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const memberships = await this.getMemberships(user.id);
        const token = (0, jsonwebtoken_1.sign)({
            sub: user.id,
            email: user.email,
            memberships
        }, process.env.JWT_SECRET ?? 'dev-secret', { expiresIn: '8h' });
        return {
            accessToken: token,
            user: {
                userId: user.id,
                email: user.email,
                memberships
            }
        };
    }
    async addMembership(userId, tenantId, role) {
        await this.db.query(`insert into tenant_users (tenant_id, user_id, role, status)
       values ($1, $2, $3, 'active')
       on conflict (tenant_id, user_id)
       do update set role = excluded.role, status = 'active'`, [tenantId, userId, role]);
    }
    async getUserOrThrow(userId) {
        const userRes = await this.db.query('select id, email from users where id = $1 limit 1', [userId]);
        const user = userRes.rows[0];
        if (!user) {
            throw new common_1.UnauthorizedException('User not found');
        }
        const memberships = await this.getMemberships(user.id);
        return {
            userId: user.id,
            email: user.email,
            memberships
        };
    }
    async getMemberships(userId) {
        const membershipRes = await this.db.query(`select tenant_id, role
       from tenant_users
       where user_id = $1 and status = 'active'`, [userId]);
        return membershipRes.rows.map((item) => ({
            tenantId: item.tenant_id,
            role: item.role
        }));
    }
    async ensureBootstrapUser() {
        if (this.bootstrapReady) {
            return;
        }
        const email = process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@demo.com';
        const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'admin123';
        const existsRes = await this.db.query('select id from users where email = $1 limit 1', [email]);
        if (existsRes.rows.length === 0) {
            const passwordHash = await (0, bcryptjs_1.hash)(password, 10);
            await this.db.query('insert into users (id, email, password_hash, mfa_enabled) values ($1, $2, $3, false)', [(0, node_crypto_1.randomUUID)(), email, passwordHash]);
        }
        this.bootstrapReady = true;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [postgres_service_1.PostgresService])
], AuthService);
