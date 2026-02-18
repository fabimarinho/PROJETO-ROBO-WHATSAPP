type SendJob = {
  tenantId: string;
  campaignId: string;
  contact: string;
  template: string;
};

export class JobQueue {
  private readonly items: SendJob[] = [];

  enqueue(job: SendJob): void {
    this.items.push(job);
  }

  dequeue(): SendJob | undefined {
    return this.items.shift();
  }

  size(): number {
    return this.items.length;
  }
}
