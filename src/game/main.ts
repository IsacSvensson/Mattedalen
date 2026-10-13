import { createProgressStore, requestPersistence } from '../storage';

// Placeholder until phase 3 builds the game shell: open storage and ask for
// persistent storage at startup, and show the result.
async function start(): Promise<void> {
  const app = document.getElementById('app');
  const { kind } = await createProgressStore();
  const persist = await requestPersistence();
  if (app) {
    app.textContent = `Gångerträdgården – under uppbyggnad. Lagring: ${kind === 'indexeddb' ? 'IndexedDB' : 'endast minne'}, beständig: ${
      persist === 'persisted' ? 'ja' : persist === 'unsupported' ? 'stöds inte' : 'nej'
    }.`;
  }
}

void start();
