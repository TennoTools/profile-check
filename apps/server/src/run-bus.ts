/**
 * In-memory event bus with replay, for SSE: a client that connects after a job
 * started still receives the history, then live events. Bounded per-id history.
 */

type Listener<T> = (event: T) => void;

export class EventBus<T> {
  private readonly history = new Map<string, T[]>();
  private readonly listeners = new Map<string, Set<Listener<T>>>();
  private readonly maxIds: number;

  constructor(maxIds = 50) {
    this.maxIds = maxIds;
  }

  publish(id: string, event: T): void {
    let events = this.history.get(id);
    if (!events) {
      events = [];
      this.history.set(id, events);
      // Evict the oldest ids (Map preserves insertion order).
      while (this.history.size > this.maxIds) {
        const oldest = this.history.keys().next().value;
        if (oldest === undefined) break;
        this.history.delete(oldest);
        this.listeners.delete(oldest);
      }
    }
    events.push(event);
    for (const listener of this.listeners.get(id) ?? []) listener(event);
  }

  /** Replays past events synchronously, then subscribes. Returns the unsubscribe function. */
  subscribe(id: string, listener: Listener<T>): () => void {
    for (const event of this.history.get(id) ?? []) listener(event);
    let set = this.listeners.get(id);
    if (!set) {
      set = new Set();
      this.listeners.set(id, set);
    }
    set.add(listener);
    return () => {
      const current = this.listeners.get(id);
      current?.delete(listener);
      if (current && current.size === 0) this.listeners.delete(id);
    };
  }
}
