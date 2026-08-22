export type QueuedMutation = {
  clientId: string;
  habitId: string;
  localDate: string;
  status: "done" | "skip" | "miss";
};

export interface QueueStorage {
  load(): Promise<QueuedMutation[]>;
  save(items: QueuedMutation[]): Promise<void>;
}

export class MutationQueue {
  private flushing: Promise<void> | null = null;
  constructor(
    private readonly storage: QueueStorage,
    private readonly send: (mutation: QueuedMutation) => Promise<void>,
  ) {}

  async enqueue(mutation: QueuedMutation) {
    const items = await this.storage.load();
    if (!items.some((item) => item.clientId === mutation.clientId)) {
      items.push(mutation);
      await this.storage.save(items);
    }
  }

  flush() {
    if (this.flushing) return this.flushing;
    this.flushing = this.flushOnce().finally(() => (this.flushing = null));
    return this.flushing;
  }

  private async flushOnce() {
    const items = await this.storage.load();
    for (const item of items) {
      await this.send(item);
      const remaining = (await this.storage.load()).filter(
        (candidate) => candidate.clientId !== item.clientId,
      );
      await this.storage.save(remaining);
    }
  }

  async size() {
    return (await this.storage.load()).length;
  }
}
