import './styles.css';
import { createMultiplicationPack } from '../content/multiplication';
import { createProgressStore, requestPersistence } from '../storage';
import type { AppContext } from './app';
import { plantSprite } from './components/plant';
import { showProfiles } from './screens/profiles';

async function start(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) return;
  document.body.prepend(plantSprite());

  const pack = createMultiplicationPack();
  const { store, kind } = await createProgressStore();
  const persist = await requestPersistence();
  const ctx: AppContext = {
    root,
    store,
    pack,
    storageKind: kind,
    persist,
    deps: { store, pack },
  };
  await showProfiles(ctx);
}

void start();
