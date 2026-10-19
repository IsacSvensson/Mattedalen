import './styles.css';
import { backen } from '../places/backen';
import { stigen } from '../places/stigen';
import { tradgarden } from '../places/tradgarden';
import { createProgressStore, importLegacyData, requestPersistence } from '../storage';
import type { AppContext } from './app';
import { plantSprite } from './components/plant';
import { captureInstallPrompt, registerServiceWorker } from './pwa';
import { showNewsIfAny } from './news';
import { placeIsOpen } from './place';
import { takeResume, type ParentPage, type Where } from './resume';
import { showDevice } from './screens/parent/device';
import { showFeedback } from './screens/parent/feedback';
import { showNews } from './screens/parent/news';
import { showImport } from './screens/parent/importPage';
import { showParent, showParentPlace } from './screens/parent/parent';
import { showPinGate } from './screens/parent/pinGate';
import { showPilotExport } from './screens/parent/pilot';
import { showChildSettings } from './screens/parent/settings';
import { showProfiles } from './screens/profiles';
import { showValley } from './screens/valley';

async function start(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) return;
  captureInstallPrompt();
  void registerServiceWorker();
  document.body.prepend(plantSprite());

  const { store, kind } = await createProgressStore();
  // A device without children shows no old news, also when children come from Gångerträdgården below.
  const newDevice = (await store.listProfiles()).length === 0;
  // Children who played Gångerträdgården on this device come along on the first start.
  if (kind === 'indexeddb') await importLegacyData(store);
  const persist = await requestPersistence();
  const ctx: AppContext = {
    root,
    store,
    // In map order: the garden first, as before; then the brook, and Stigen between them.
    // In the order the child meets them, which is also the valley's order (docs/PLAN-DALEN.md).
    places: [backen, stigen, tradgarden],
    storageKind: kind,
    persist,
  };
  // After an update's reload: back to the same screen (docs/PLAN-UPPDATERING.md).
  const back = takeResume();
  if (back?.kind === 'parent') {
    // Back in "För vuxna": the question how it is going first, then what is new (docs/PLAN-FRAGA.md).
    await resumeAt(ctx, back, () => showNewsIfAny(ctx, newDevice));
    return;
  }
  if (!back || !(await resumeAt(ctx, back))) await showProfiles(ctx);
  // What is new, over the first screen after an update (docs/PLAN-UPPDATERING.md).
  await showNewsIfAny(ctx, newDevice);
}

/** Opens the screen the app was on before the update; false when it is gone (then the app starts over). */
async function resumeAt(ctx: AppContext, where: Where, afterAsk?: () => Promise<void>): Promise<boolean> {
  if (where.kind === 'parent') {
    // "För vuxna" asks for the grown-ups' code again, then opens the same page.
    await showPinGate(ctx, () => parentPage(ctx, where.page, where.profileId, where.placeId), afterAsk);
    return true;
  }
  const profile = await ctx.store.getProfile(where.profileId);
  if (!profile) return false;
  const place = where.kind === 'place' ? ctx.places.find((p) => p.id === where.placeId) : undefined;
  if (place && (await placeIsOpen(place, ctx, profile))) await place.open(ctx, profile);
  else await showValley(ctx, profile, place ? { at: place.id } : {});
  return true;
}

function parentPage(ctx: AppContext, page: ParentPage, profileId?: string, placeId?: string): Promise<void> {
  if (!profileId) {
    if (page === 'device') return showDevice(ctx);
    if (page === 'import') return showImport(ctx);
    if (page === 'feedback') return Promise.resolve(showFeedback(ctx));
    if (page === 'news') return Promise.resolve(showNews(ctx));
    return showParent(ctx);
  }
  switch (page) {
    case 'place':
      return placeId ? showParentPlace(ctx, profileId, placeId) : showParent(ctx, profileId);
    case 'settings':
      return showChildSettings(ctx, profileId);
    case 'pilot':
      return showPilotExport(ctx, profileId);
    case 'device':
      return showDevice(ctx, profileId);
    case 'import':
      return showImport(ctx, profileId);
    case 'feedback':
      showFeedback(ctx, profileId);
      return Promise.resolve();
    case 'news':
      showNews(ctx, profileId);
      return Promise.resolve();
    default:
      return showParent(ctx, profileId);
  }
}

void start();
