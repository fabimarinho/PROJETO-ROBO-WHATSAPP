"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbitPublisherService = void 0;
const common_1 = require("@nestjs/common");
const amqplib_1 = require("amqplib");
let RabbitPublisherService = class RabbitPublisherService {
    connection = null;
    channel = null;
    async publish(queue, payload) {
        const channel = await this.getChannel();
        await channel.assertQueue(queue, { durable: true });
        channel.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), {
            persistent: true,
            contentType: 'application/json'
        });
    }
    async getChannel() {
        if (this.channel) {
            return this.channel;
        }
        const url = process.env.RABBITMQ_URL ?? 'amqp://localhost:5672';
        this.connection = await (0, amqplib_1.connect)(url);
        this.channel = await this.connection.createChannel();
        return this.channel;
    }
    async onModuleDestroy() {
        if (this.channel) {
            await this.channel.close();
            this.channel = null;
        }
        if (this.connection) {
            await this.connection.close();
            this.connection = null;
        }
    }
};
exports.RabbitPublisherService = RabbitPublisherService;
exports.RabbitPublisherService = RabbitPublisherService = __decorate([
    (0, common_1.Injectable)()
], RabbitPublisherService);
