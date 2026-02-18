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
exports.PostgresService = void 0;
const common_1 = require("@nestjs/common");
const pg_1 = require("pg");
let PostgresService = class PostgresService {
    pool;
    constructor() {
        const connectionString = process.env.DATABASE_URL;
        this.pool = new pg_1.Pool(connectionString
            ? { connectionString }
            : {
                host: process.env.DB_HOST ?? 'localhost',
                port: Number(process.env.DB_PORT ?? 5432),
                database: process.env.DB_NAME ?? 'robo_whatsapp',
                user: process.env.DB_USER ?? 'app',
                password: process.env.DB_PASSWORD ?? 'app123'
            });
    }
    query(text, values = []) {
        return this.pool.query(text, values);
    }
    async onModuleDestroy() {
        await this.pool.end();
    }
};
exports.PostgresService = PostgresService;
exports.PostgresService = PostgresService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], PostgresService);
