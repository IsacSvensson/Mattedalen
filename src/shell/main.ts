import './styles.css';
import { tradgarden } from '../places/tradgarden';
import { createProgressStore, importLegacyData, requestPersistence } from '../storage';
import type { AppContext } from './app';
import { plantSprite } from './components/plant';
import { captureInstallPrompt, registerServiceWorker } from './pwa';
import { showProfiles } from './screens/profiles';

async function start(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) return;
  captureInstallPrompt();
  void registerServiceWorker();
  document.body.prepend(plantSprite());

  const { store, kind } = await createProgressStore();
  // Children who played Gångerträdgården on this device come along on the first start.
  if (kind === 'indexeddb') await importLegacyData(store);
  const persist = await requestPersistence();
  const ctx: AppContext = {
    root,
    store,
    places: [tradgarden],
    storageKind: kind,
    persist,
  };
  await showProfiles(ctx);
}

void start();
