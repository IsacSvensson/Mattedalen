import { formatDay as toDayKey, systemClock } from '../../../engine';
import { decodeTransfer, ImportError, parseExport, LEGACY_IMPORT_KEY, type LegacyImportRecord } from '../../../storage';
import type { AppContext } from '../../app';
import { choose, toast } from '../../components/modal';
import { cameraScanner, decodeImageFile, type Scanner } from '../../components/qrScanner';
import { h } from '../../dom';
import { engineFor } from '../../play';
import { formatDay } from '../../stats';
import { profileFromSnapshot, progressFromSnapshot } from '../../transfer';
import { showParentPage } from './frame';
import { showParent } from './parent';
import { setWhere } from '../../resume';

/** "Hämta ett barn": a QR code, a backup or Gångerträdgården (docs/PLAN-FORALDRAVYN.md). */
export async function showImport(ctx: AppContext, backTo?: string): Promise<void> {
  setWhere({ kind: 'parent', page: 'import', profileId: backTo });
  showParentPage(ctx, { title: 'Hämta ett barn', back: () => void showParent(ctx, backTo) }, importSection(ctx, await legacyNote(ctx)));
}

/** How children come along from Gångerträdgården, and whether some already did. */
async function legacyNote(ctx: AppContext): Promise<HTMLElement> {
  const record = await ctx.store.getSetting<LegacyImportRecord>(LEGACY_IMPORT_KEY);
  const done = record?.done && record.profiles > 0;
  return h(
    'div',
    { class: 'legacy-note' },
    h('h3', null, 'Från Gångerträdgården'),
    done
      ? h(
          'p',
          null,
          `${record.profiles === 1 ? 'Ett barn' : `${record.profiles} barn`} hämtades från Gångerträdgården ${formatDay(dayOfTime(record.at))}. `,
          'Gångerträdgården finns kvar som förut, men det som övas där syns inte här.',
        )
      : null,
    h(
      'p',
      { class: 'muted' },
      done ? 'Saknas ett barn? ' : '',
      'Barn som spelat Gångerträdgården i den här webbläsaren följer med av sig själva första gången Mattedalen startar. ',
      'Har barnet spelat på en annan enhet, eller som app på hemskärmen på iPhone eller iPad (den har egen lagring), öppnar du Gångerträdgårdens föräldravy och väljer ”Visa QR-kod” eller ”Spara säkerhetskopia”. Hämta sedan barnet här.',
    ),
  );
}

function importSection(ctx: AppContext, legacy: HTMLElement): HTMLElement {
  const scanArea = h('div', { class: 'scan-area' });
  const imageInput = h('input', {
    type: 'file',
    accept: 'image/*',
    hidden: true,
    'aria-label': 'Välj bild med QR-kod',
    onchange: async () => {
      const file = imageInput.files?.[0];
      imageInput.value = '';
      if (!file) return;
      const text = await decodeImageFile(file).catch(() => null);
      if (text) await importQr(ctx, text);
      else toast('Ingen QR-kod hittades i bilden.');
    },
  });
  const jsonInput = h('input', {
    type: 'file',
    accept: '.json,application/json',
    hidden: true,
    'aria-label': 'Välj säkerhetskopia',
    onchange: async () => {
      const file = jsonInput.files?.[0];
      jsonInput.value = '';
      if (file) await importJson(ctx, await file.text());
    },
  });
  let scanner: Scanner | undefined;
  const startScan = () => {
    scanner?.stop();
    const current = cameraScanner(
      (text) => {
        scanArea.replaceChildren();
        void importQr(ctx, text);
      },
      (message) => scanArea.replaceChildren(h('p', { class: 'notice' }, message)),
    );
    scanner = current;
    scanArea.replaceChildren(
      current.el,
      h('button', { class: 'link-button', type: 'button', onclick: () => (current.stop(), scanArea.replaceChildren()) }, 'Avbryt skanning'),
    );
  };
  return h(
    'section',
    { class: 'parent-section', 'aria-labelledby': 'import-heading' },
    h('h2', { id: 'import-heading' }, 'Från en annan enhet'),
    h(
      'div',
      { class: 'button-row' },
      h('button', { class: 'soft-button', type: 'button', onclick: startScan }, 'Skanna QR-kod'),
      h('button', { class: 'soft-button', type: 'button', onclick: () => imageInput.click() }, 'Läs QR-kod från bild'),
      h('button', { class: 'soft-button', type: 'button', onclick: () => jsonInput.click() }, 'Öppna säkerhetskopia (JSON)'),
    ),
    imageInput,
    jsonInput,
    scanArea,
    legacy,
  );
}

async function importQr(ctx: AppContext, text: string): Promise<void> {
  try {
    const snap = decodeTransfer(text);
    const tmp = profileFromSnapshot(snap, 'tmp', 0);
    // Every place the code has a block for; a place it lacks starts from the beginning.
    const restored = snap.packs.map((block) => {
      const place = ctx.places.find((p) => p.pack.id === block.packId);
      // A block from an older version of a pack holds its first items, which keep their order.
      if (!place || block.packVersion > place.pack.version || block.levels.length > place.pack.items.length) {
        throw new ImportError('QR-koden passar inte den här versionen av appen.');
      }
      const engine = engineFor(tmp, { store: ctx.store, pack: place.pack });
      return { place, engine, ...progressFromSnapshot(block, engine, systemClock.today()) };
    });
    const summary = restored.map(({ place, engine, states }) => {
      const c = engine.statusCounts(states);
      return h('li', null, h('strong', null, place.name), `: ${c.automatic} automatiserade, ${c.fluent} flytande och ${c.learning} som övas.`);
    });
    const existing = (await ctx.store.listProfiles()).find((p) => p.name === snap.name);
    const answer = await choose(
      `Hämta ${snap.name}?`,
      h('ul', { class: 'qr-summary' }, summary),
      [
        ...(existing ? [{ value: 'replace' as const, label: `Ersätt ${existing.name} här`, primary: true }] : []),
        { value: 'new' as const, label: existing ? 'Lägg till som ny spelare' : 'Lägg till', primary: !existing },
      ],
    );
    if (!answer) return;
    const profile =
      answer === 'replace' && existing
        ? {
            ...existing,
            avatar: snap.avatar || existing.avatar,
            settings: {
              ...existing.settings,
              ...(snap.gardenOpen ? { gardenOpen: true } : {}),
              ...(snap.pathOpen ? { pathOpen: true } : {}),
              ...(snap.tablesWait === false ? { tablesWait: false } : {}),
              ...(snap.moreTime ? { moreTime: true } : {}),
              ...(snap.tableReady ? { tableReady: snap.tableReady } : {}),
            },
          }
        : profileFromSnapshot(snap, crypto.randomUUID(), Date.now());
    await ctx.store.saveProfile(profile);
    for (const { place, states, meta } of restored) {
      await ctx.store.save({ profileId: profile.id, packId: place.pack.id, packVersion: place.pack.version, states, meta, updatedAt: Date.now() });
    }
    toast(`${profile.name} är hämtad`);
    await showParent(ctx, profile.id);
  } catch (e) {
    toast(e instanceof ImportError ? e.message : 'QR-koden kunde inte läsas.');
  }
}

async function importJson(ctx: AppContext, text: string): Promise<void> {
  try {
    const data = parseExport(text);
    const existing = await ctx.store.getProfile(data.profile.id);
    let onConflict: 'replace' | 'copy' = 'copy';
    if (existing) {
      const answer = await choose(
        `${data.profile.name} finns redan`,
        h('p', null, 'Vill du ersätta barnets framsteg på den här enheten med säkerhetskopian, eller lägga till den som en kopia?'),
        [
          { value: 'replace' as const, label: 'Ersätt', primary: true },
          { value: 'copy' as const, label: 'Lägg till som kopia' },
        ],
      );
      if (!answer) return;
      onConflict = answer;
    }
    const profile = await ctx.store.import(data, { onConflict });
    toast(`${profile.name} är återställd`);
    await showParent(ctx, profile.id);
  } catch (e) {
    toast(e instanceof ImportError ? e.message : 'Filen kunde inte läsas.');
  }
}

const dayOfTime = (ms: number) => {
  const d = new Date(ms);
  return toDayKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
};

