/** Minimal typed publish/subscribe bus. Modules talk to each other through it instead of importing each other. */

export type Listener<T> = (payload: T) => void;

export class EventBus<Events> {
  private readonly listeners = new Map<keyof Events, Set<Listener<any>>>();

  /** Subscribes and returns an unsubscribe function. */
  on<K extends keyof Events>(type: K, fn: Listener<Events[K]>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(fn);
    return () => this.off(type, fn);
  }

  once<K extends keyof Events>(type: K, fn: Listener<Events[K]>): () => void {
    const off = this.on(type, (payload) => {
      off();
      fn(payload);
    });
    return off;
  }

  off<K extends keyof Events>(type: K, fn: Listener<Events[K]>): void {
    this.listeners.get(type)?.delete(fn);
  }

  /** Calls every listener. A throwing listener never prevents the others from running. */
  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.listeners.get(type);
    if (!set || set.size === 0) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[events] listener for "${String(type)}" threw`, err);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
