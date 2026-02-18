"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobQueue = void 0;
class JobQueue {
    items = [];
    enqueue(job) {
        this.items.push(job);
    }
    dequeue() {
        return this.items.shift();
    }
    size() {
        return this.items.length;
    }
}
exports.JobQueue = JobQueue;
