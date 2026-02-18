"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbClient = void 0;
const pg_1 = require("pg");
class DbClient {
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
    async close() {
        await this.pool.end();
    }
}
exports.DbClient = DbClient;
