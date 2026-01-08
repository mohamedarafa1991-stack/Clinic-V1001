
export interface DBHealthStats {
  sizeBytes: number;
  tableCount: number;
  integrity: 'ok' | 'corrupt' | 'unknown';
  lastCompacted: string | null;
}

export interface SyncMessage {
  type: 'db-update' | 'auth-state' | 'lock-acquire';
  payload?: any;
  timestamp: number;
  sourceId: string;
}

export interface BackupMetadata {
  id: string;
  timestamp: string;
  type: 'full' | 'incremental';
  sizeBytes: number;
}
