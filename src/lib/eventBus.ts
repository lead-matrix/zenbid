export type AppEventMap = {
  'proposal.sent': { projectId: string; sentAt: string; clientEmail?: string };
  'proposal.viewed': { projectId: string; versionId?: string; viewedAt: string };
  'proposal.approved': { projectId: string; versionId?: string; approvedAt: string; signatureData?: string; selectedTier?: string };
  'proposal.expired': { projectId: string; expiredAt: string };
  'proposal.abandoned': { projectId: string; abandonedAt: string; reason?: string };
  'ai.scope.generated': { projectId: string; tokensUsed: number; costCents: number; durationMs: number };
  'upsell.selected': { projectId: string; itemId: string; isSelected: boolean; totalValue: number };
};

export type AppEventName = keyof AppEventMap;

type EventCallback<T extends AppEventName> = (payload: AppEventMap[T]) => void | Promise<void>;

class EventBus {
  private listeners: { [K in AppEventName]?: EventCallback<K>[] } = {};

  /**
   * Subscribe to a specific application event
   */
  public on<K extends AppEventName>(event: K, callback: EventCallback<K>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    
    this.listeners[event]!.push(callback);

    // Return an unsubscribe function
    return () => {
      this.off(event, callback);
    };
  }

  /**
   * Unsubscribe from a specific application event
   */
  public off<K extends AppEventName>(event: K, callback: EventCallback<K>): void {
    const list = this.listeners[event];
    if (!list) return;

    this.listeners[event] = list.filter(cb => cb !== callback) as any;
  }

  /**
   * Emit an event with its typed payload. Triggers all registered listeners.
   */
  public async emit<K extends AppEventName>(event: K, payload: AppEventMap[K]): Promise<void> {
    const list = this.listeners[event];
    if (!list) return;

    // Run callbacks in parallel, catching any internal listener errors safely
    const promises = list.map(async (callback) => {
      try {
        await callback(payload);
      } catch (err) {
        console.error(`[EventBus] Error in listener for event "${event}":`, err);
      }
    });

    await Promise.all(promises);
  }
}

export const eventBus = new EventBus();
