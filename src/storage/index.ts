import { IndexedDbProgressStore } from './idb';
import { MemoryProgressStore } from './memory';
import type { ProgressStore } from './ProgressStore';

export * from './types';
export * from './ProgressStore';
export * from './backup';
export * from './compact';
export * from './persist';
export { maybeCompactLog } from './shared';
export { IndexedDbProgressStore, openProgressDb, MIGRATIONS, DB_NAME, type Migration, type ProgressDB } from './idb';
export { MemoryProgressStore } from './memory';
export * from './legacy';

export interface OpenedStore {
  store: ProgressStore;
  /** `memory` means nothing survives a reload (IndexedDB blocked, e.g. some private modes). */
  kind: 'indexeddb' | 'memory';
}

export async function createProgressStore(): Promise<OpenedStore> {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB saknas');
    return { store: await IndexedDbProgressStore.open(), kind: 'indexeddb' };
  } catch {
    return { store: new MemoryProgressStore(), kind: 'memory' };
  }
}
export * from './qrCodec';
