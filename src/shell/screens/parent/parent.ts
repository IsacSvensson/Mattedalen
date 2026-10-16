import { formatDay as toDayKey, systemClock } from '../../../engine';
import {
  decodeTransfer,
  encodeTransfer,
  exportFileName,
  ImportError,
  parseExport,
  persistenceStatus,
  requestPersistence,
  storageEstimate,
  LEGACY_IMPORT_KEY,
  type LegacyImportRecord,
  type Profile,
} from '../../../storage';
import { show, type AppContext } from '../../app';
import { choose, toast } from '../../components/modal';
import { cameraScanner, decodeImageFile, type Scanner } from '../../components/qrScanner';
import { h } from '../../dom';
import { formatDay, minutesPerDay } from '../../stats';
import { engineFor, loadProgress } from '../../play';
import type { SaveProfile } from '../../place';
import { profileFromSnapshot, progressFromSnapshot, qrSvgMarkup, transferOf } from '../../transfer';
import { showProfiles } from '../profiles';
import { AVATAR_KEYS, avatarIcon, avatarName } from '../../components/avatars';
import { icon } from '../../components/icons';
import { APP_BUILD, checkForUpdate, installGuide } from '../../pwa';
import { hasSwedishVoice, speechSupported } from '../../speech';
import { choosePin } from './pinGate';

export async function showParent(ctx: AppContext, selectedId?: string): Promise<void> {
  const profiles = await ctx.store.listProfiles();
  const selected = profiles.find((p) => p.id === selectedId) ?? profiles[0];

  const view = h(
    'main',
    { class: 'screen parent' },
    h(
      'header',
      { class: 'top-bar' },
      h('button', { class: 'icon-button', type: 'button', 'aria-label': 'Stäng föräldravyn', onclick: () => void showProfiles(ctx) }, icon('close')),
      h('h1', null, 'Föräldravy'),
    ),
    profiles.length
      ? h(
          'nav',
          { class: 'parent-tabs', 'aria-label': 'Barn' },
          profiles.map((p) =>
            h(
              'button',
              { class: `parent-tab${p.id === selected?.id ? ' active' : ''}`, type: 'button', 'aria-pressed': String(p.id === selected?.id), onclick: () => void showParent(ctx, p.id) },
              h('span', { class: 'avatar-badge small' }, avatarIcon(p.avatar)),
              p.name,
            ),
          ),
        )
      : h('p', null, 'Inga barn ännu. Skapa en spelare på startsidan, eller importera nedan.'),
    selected ? await childSection(ctx, selected) : null,
    importSection(ctx, await legacyNote(ctx)),
    await deviceSection(ctx),
  );
  show(ctx, view);
}

// --- one child ----------------------------------------------------------

async function childSection(ctx: AppContext, profile: Profile): Promise<HTMLElement> {
  const sessions = await ctx.store.listSessions(profile.id);
  const today = systemClock.today();
  const save = profileSaver(ctx, profile);

  // The child (shared by every place), then one part per place in the valley.
  const places = await Promise.all(ctx.places.map((place) => place.parentSection(ctx, profile, save)));

  return h(
    'section',
    { class: 'parent-section', 'aria-labelledby': 'child-heading' },
    h('h2', { id: 'child-heading', class: 'child-heading' }, h('span', { class: 'avatar-badge small' }, avatarIcon(profile.avatar)), profile.name),
    h('h3', null, 'Övade minuter per dag'),
    minutesChart(minutesPerDay(sessions, today, 14)),
    h('h3', null, 'Inställningar'),
    settingsForm(profile, save),
    places,
    h('h3', null, 'Flytta till en annan enhet'),
    h(
      'p',
      { class: 'muted' },
      'QR-koden flyttar barnets status (vad som sitter). Säkerhetskopian (JSON) flyttar allt, även historiken.',
    ),
    h(
      'div',
      { class: 'button-row' },
      h('button', { class: 'soft-button', type: 'button', onclick: () => void showQr(ctx, profile) }, 'Visa QR-kod'),
      h('button', { class: 'soft-button', type: 'button', onclick: () => void downloadBackup(ctx, profile) }, 'Spara säkerhetskopia (JSON)'),
    ),
    h(
      'button',
      { class: 'link-button danger', type: 'button', onclick: () => void deleteProfile(ctx, profile) },
      `Ta bort ${profile.name}…`,
    ),
  );
}

function minutesChart(days: { day: string; minutes: number }[]): HTMLElement {
  const max = Math.max(15, ...days.map((d) => d.minutes));
  const total = days.slice(-7).reduce((s, d) => s + d.minutes, 0);
  return h(
    'div',
    { class: 'minutes' },
    h(
      'div',
      { class: 'minutes-chart', role: 'img', 'aria-label': days.map((d) => `${formatDay(d.day)}: ${d.minutes} min`).join(', ') },
      days.map((d) =>
        h(
          'div',
          { class: 'minutes-bar', title: `${formatDay(d.day)}: ${d.minutes} min` },
          h('span', { class: 'minutes-value' }, d.minutes || ''),
          h('span', { class: 'minutes-fill', style: `height:${(d.minutes / max) * 100}%` }),
          h('span', { class: 'minutes-day' }, formatDay(d.day).split(' ')[0]),
        ),
      ),
    ),
    h('p', { class: 'muted' }, `Senaste 7 dagarna: ${total} minuter.`),
  );
}

/** Saves changes to a child; every setting on the page goes through the same one. */
function profileSaver(ctx: AppContext, profile: Profile): SaveProfile {
  // Always merge into the latest saved version; only name/avatar changes need a redraw.
  let current = profile;
  return async (change) => {
    current = { ...current, ...change, settings: { ...current.settings, ...change.settings } };
    await ctx.store.saveProfile(current);
    toast('Sparat');
    if (change.name !== undefined || change.avatar !== undefined) await showParent(ctx, profile.id);
  };
}

/** Settings for the child in every place. */
function settingsForm(profile: Profile, save: SaveProfile): HTMLElement {
  const name = h('input', { type: 'text', value: profile.name, maxlength: 20, 'aria-label': 'Namn' });
  const voiceNote = h('p', { class: 'muted voice-note' });
  if (!speechSupported()) voiceNote.textContent = 'Den här webbläsaren kan inte läsa upp text.';
  else
    void hasSwedishVoice().then((ok) => {
      if (!ok)
        voiceNote.textContent =
          'Ingen svensk röst finns på enheten. Uppläsningen använder bara röster på enheten, så att ingen text skickas iväg. Lägg till en svensk röst i enhetens inställningar för tal/uppläsning.';
    });
  return h(
    'div',
    { class: 'settings' },
    h(
      'label',
      null,
      'Namn ',
      name,
      h('button', { class: 'soft-button small', type: 'button', onclick: () => name.value.trim() && void save({ name: name.value.trim() }) }, 'Spara'),
    ),
    h(
      'label',
      null,
      'Djur ',
      h(
        'select',
        { 'aria-label': 'Djur', onchange: (e: Event) => void save({ avatar: (e.target as HTMLSelectElement).value }) },
        AVATAR_KEYS.map((a) => h('option', { value: a, selected: a === profile.avatar }, capitalize(avatarName(a) ?? a))),
      ),
    ),
    h(
      'label',
      null,
      'Passlängd ',
      h(
        'select',
        { 'aria-label': 'Passlängd', onchange: (e: Event) => void save({ settings: { sessionMinutes: Number((e.target as HTMLSelectElement).value) } }) },
        [10, 11, 12, 13, 14, 15].map((m) => h('option', { value: m, selected: m === profile.settings.sessionMinutes }, `${m} minuter`)),
      ),
    ),
    h(
      'label',
      { class: 'check' },
      h('input', {
        type: 'checkbox',
        checked: profile.settings.readAloud,
        disabled: !speechSupported(),
        onchange: (e: Event) => void save({ settings: { readAloud: (e.target as HTMLInputElement).checked } }),
      }),
      ' Läs upp frågorna och dalens platser (svenska)',
    ),
    voiceNote,
  );
}

/** The QR code holds every place: one block of levels per content pack (MD1). The JSON backup holds the full history. */
async function showQr(ctx: AppContext, profile: Profile): Promise<void> {
  const packs = await Promise.all(
    ctx.places.map(async (place) => ({ pack: place.pack, states: (await loadProgress(profile, { store: ctx.store, pack: place.pack })).states })),
  );
  const text = encodeTransfer(transferOf(profile, packs));
  const qr = h('div', { class: 'qr-code', 'aria-label': `QR-kod för ${profile.name}` });
  qr.innerHTML = qrSvgMarkup(text).svg;
  void choose(
    `QR-kod för ${profile.name}`,
    h('div', { class: 'qr-wrap' }, qr, h('p', null, 'Öppna föräldravyn på den andra enheten, välj ”Skanna QR-kod” och rikta kameran hit. Det går också att fotografera koden och välja bilden.')),
    [{ value: 'ok', label: 'Klar', primary: true }],
    { cancel: false },
  );
}

async function downloadBackup(ctx: AppContext, profile: Profile): Promise<void> {
  const data = await ctx.store.export(profile.id);
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: exportFileName(profile) });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function deleteProfile(ctx: AppContext, profile: Profile): Promise<void> {
  const answer = await choose(
    `Ta bort ${profile.name}?`,
    h('p', null, 'All information om barnets framsteg försvinner från den här enheten. Spara gärna en säkerhetskopia först.'),
    [{ value: 'delete', label: 'Ta bort', primary: true }],
  );
  if (answer !== 'delete') return;
  await ctx.store.deleteProfile(profile.id);
  toast(`${profile.name} är borttagen`);
  await showParent(ctx);
}

// --- import -------------------------------------------------------------

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
    h('h2', { id: 'import-heading' }, 'Hämta ett barn från en annan enhet'),
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
        ? { ...existing, avatar: snap.avatar || existing.avatar, settings: { ...existing.settings, ...(snap.gardenOpen ? { gardenOpen: true } : {}), ...(snap.pathOpen ? { pathOpen: true } : {}) } }
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

// --- this device --------------------------------------------------------

async function deviceSection(ctx: AppContext): Promise<HTMLElement> {
  const persist = await persistenceStatus();
  const estimate = await storageEstimate();
  const statusText =
    ctx.storageKind === 'memory'
      ? 'Webbläsaren tillåter inte sparande just nu (privat läge?). Framstegen försvinner när sidan stängs.'
      : persist === 'persisted'
        ? 'Beständig lagring är på: webbläsaren raderar inte datan för att frigöra utrymme.'
        : persist === 'unsupported'
          ? 'Webbläsaren stöder inte beständig lagring.'
          : 'Beständig lagring är inte beviljad. Webbläsaren kan radera datan om utrymmet tar slut.';
  return h(
    'section',
    { class: 'parent-section', 'aria-labelledby': 'device-heading' },
    h('h2', { id: 'device-heading' }, 'Den här enheten'),
    h('p', null, h('strong', null, 'Lagring: '), statusText),
    estimate ? h('p', { class: 'muted' }, `Använder ${(estimate.usage / 1024).toFixed(0)} kB.`) : null,
    persist === 'not-persisted' && ctx.storageKind === 'indexeddb'
      ? h(
          'button',
          {
            class: 'soft-button',
            type: 'button',
            onclick: async () => {
              const result = await requestPersistence();
              toast(result === 'persisted' ? 'Beständig lagring är på' : 'Webbläsaren sa nej – lägg till appen på hemskärmen och försök igen');
              await showParent(ctx);
            },
          },
          'Be om beständig lagring',
        )
      : null,
    h('h3', null, 'Version'),
    h('p', { class: 'muted' }, `Appen: ${APP_BUILD}. Nya versioner hämtas av sig själva och tas i bruk när appen startas, eller med knappen ”Ny version finns”.`),
    h(
      'p',
      { class: 'muted' },
      'Ett ideellt projekt, fritt att använda för icke-kommersiella syften (PolyForm Noncommercial 1.0.0). ',
      h('a', { href: './THIRD-PARTY-LICENSES.txt', target: '_blank', rel: 'noopener' }, 'Licenser för ingående delar'),
      '.',
    ),
    h(
      'button',
      {
        class: 'soft-button',
        type: 'button',
        onclick: async (e: Event) => {
          const button = e.currentTarget as HTMLButtonElement;
          button.disabled = true;
          const result = await checkForUpdate();
          button.disabled = false;
          toast(
            result === 'updating'
              ? 'Ny version hittad – appen startar om'
              : result === 'latest'
                ? 'Du har den senaste versionen'
                : 'Kunde inte söka just nu (ingen anslutning?)',
          );
        },
      },
      icon('refresh'),
      'Sök efter uppdatering',
    ),
    h('h3', null, 'Lägg till på hemskärmen'),
    installGuide(),
    h('h3', null, 'Varför lägga till på hemskärmen?'),
    h(
      'p',
      null,
      'All data finns bara på den här enheten. Webbläsare städar ibland bort data från webbplatser – Safari på iPhone och iPad kan radera den efter sju dagar utan besök. ',
      'En app som är tillagd på hemskärmen räknas som installerad och behandlas inte så. Spara också en säkerhetskopia då och då.',
    ),
    h('h3', null, 'Integritet'),
    h(
      'ul',
      { class: 'privacy' },
      h('li', null, 'Appen använder inga cookies och har ingen spårning, analys eller reklam.'),
      h('li', null, 'Barnens namn och framsteg sparas bara här på enheten. Inget skickas iväg – utom när du själv exporterar med QR-kod eller fil.'),
      h('li', null, 'Appen sparar sina egna filer på enheten så att den fungerar utan internet.'),
      h('li', null, 'Sidan ligger på GitHub Pages. Som alla webbservrar loggar GitHub besökares IP-adresser, enligt GitHubs integritetspolicy.'),
      h('li', null, 'Vill du radera allt? Ta bort barnen här ovanför, eller rensa webbplatsdata för sidan i webbläsarens inställningar.'),
    ),
    h('h3', null, 'Vuxenkod'),
    h('button', { class: 'soft-button', type: 'button', onclick: () => choosePin(ctx, async () => (toast('Ny kod sparad'), showParent(ctx))) }, 'Byt vuxenkod'),
  );
}

const dayOfTime = (ms: number) => {
  const d = new Date(ms);
  return toDayKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
