/**
 * Persistent storage: asks the browser not to evict our IndexedDB data under
 * storage pressure. Browsers decide on their own (Chrome grants it more
 * readily to installed PWAs, Safari to home-screen apps), so the parent view
 * shows the status.
 */
export type PersistStatus = 'persisted' | 'not-persisted' | 'unsupported';

export interface StorageManagerLike {
  persist?(): Promise<boolean>;
  persisted?(): Promise<boolean>;
  estimate?(): Promise<{ usage?: number; quota?: number }>;
}

const defaultManager = (): StorageManagerLike | undefined =>
  typeof navigator !== 'undefined' ? (navigator.storage as StorageManagerLike | undefined) : undefined;

export async function requestPersistence(manager = defaultManager()): Promise<PersistStatus> {
  if (!manager?.persist) return 'unsupported';
  try {
    if (manager.persisted && (await manager.persisted())) return 'persisted';
    return (await manager.persist()) ? 'persisted' : 'not-persisted';
  } catch {
    return 'not-persisted';
  }
}

export async function persistenceStatus(manager = defaultManager()): Promise<PersistStatus> {
  if (!manager?.persisted) return 'unsupported';
  try {
    return (await manager.persisted()) ? 'persisted' : 'not-persisted';
  } catch {
    return 'not-persisted';
  }
}

export async function storageEstimate(manager = defaultManager()): Promise<{ usage: number; quota: number } | undefined> {
  if (!manager?.estimate) return undefined;
  try {
    const { usage = 0, quota = 0 } = await manager.estimate();
    return { usage, quota };
  } catch {
    return undefined;
  }
}
