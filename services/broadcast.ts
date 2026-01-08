
import { features } from '../config/featureFlags';
import { SyncMessage } from '../types/enhancements';

class BroadcastService {
  private channel: BroadcastChannel | null = null;
  private listeners: ((msg: SyncMessage) => void)[] = [];

  constructor() {
    if (features.multiTabSync && typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('medicore_sync_v1');
      this.channel.onmessage = (ev) => {
        this.notifyListeners(ev.data as SyncMessage);
      };
    }
  }

  public publish(type: SyncMessage['type'], payload?: any) {
    if (this.channel) {
      const msg: SyncMessage = {
        type,
        payload,
        timestamp: Date.now(),
        sourceId: this.getTabId()
      };
      this.channel.postMessage(msg);
    }
  }

  public subscribe(callback: (msg: SyncMessage) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners(msg: SyncMessage) {
    this.listeners.forEach(l => l(msg));
  }

  private getTabId() {
    let id = sessionStorage.getItem('tab_id');
    if (!id) {
      id = Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('tab_id', id);
    }
    return id;
  }
}

export const broadcastService = new BroadcastService();
