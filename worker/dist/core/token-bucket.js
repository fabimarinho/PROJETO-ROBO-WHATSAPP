"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenBucket = void 0;
class TokenBucket {
    capacity;
    refillPerSecond;
    tokens;
    lastRefillTs;
    constructor(capacity, refillPerSecond) {
        this.capacity = capacity;
        this.refillPerSecond = refillPerSecond;
        this.tokens = capacity;
        this.lastRefillTs = Date.now();
    }
    tryConsume(amount) {
        this.refill();
        if (this.tokens < amount) {
            return false;
        }
        this.tokens -= amount;
        return true;
    }
    refill() {
        const now = Date.now();
        const elapsedSeconds = (now - this.lastRefillTs) / 1000;
        if (elapsedSeconds <= 0) {
            return;
        }
        const refillAmount = elapsedSeconds * this.refillPerSecond;
        this.tokens = Math.min(this.capacity, this.tokens + refillAmount);
        this.lastRefillTs = now;
    }
}
exports.TokenBucket = TokenBucket;
