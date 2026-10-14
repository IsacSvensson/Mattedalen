import { systemClock, type ItemState } from '../../../engine';
import { factId, formatFact, MAX_FACTOR, MIN_FACTOR } from '../../../content/multiplication';
import {
  decodeSnapshot,
  encodeSnapshot,
  exportFileName,
  ImportError,
  parseExport,
  persistenceStatus,
  requestPersistence,
  storageEstimate,
  type Profile,
} from '../../../storage';
import { show, type AppContext } from '../../app';
import { choose, toast } from '../../components/modal';
import { cameraScanner, decodeImageFile } from '../../components/qrScanner';
import { h } from '../../dom';
import { formatDay, factStats, minutesPerDay, STATUS_TEXT, topConfusions, type FactStats } from '../../parentStats';
import { engineFor, loadProgress } from '../../play';
import { profileFromSnapshot, progressFromSnapshot, qrSvgMarkup, snapshotOf } from '../../transfer';
import { showProfiles } from '../profiles';
import { AVATAR_KEYS, avatarIcon, avatarName } from '../../components/avatars';
import { icon } from '../../components/icons';
import { installGuide } from '../../pwa';
import { hasSwedishVoice, speechSupported } from '../../speech';
import { showPlacementOffer } from '../placement';
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
    importSection(ctx),
    await deviceSection(ctx),
  );
  show(ctx, view);
}

// --- one child ----------------------------------------------------------

async function childSection(ctx: AppContext, profile: Profile): Promise<HTMLElement> {
  const engine = engineFor(profile, ctx.deps);
  const { states, meta } = await loadProgress(profile, ctx.deps, engine);
  const [sessions, attempts, summaries] = await Promise.all([
    ctx.store.listSessions(profile.id),
    ctx.store.listAttempts(profile.id),
    ctx.store.listDaySummaries(profile.id),
  ]);
  const counts = engine.statusCounts(states);
  const stats = factStats(attempts, summaries);
  const today = systemClock.today();
  const lastPlayed = sessions.length ? sessions[sessions.length - 1]!.day : null;

  return h(
    'section',
    { class: 'parent-section', 'aria-labelledby': 'child-heading' },
    h('h2', { id: 'child-heading', class: 'child-heading' }, h('span', { class: 'avatar-badge small' }, avatarIcon(profile.avatar)), profile.name),
    h(
      'ul',
      { class: 'status-summary' },
      (['automatic', 'fluent', 'learning', 'new'] as const).map((s) =>
        h('li', { class: `status-${s}` }, h('strong', null, counts[s]), ` ${STATUS_TEXT[s]}`),
      ),
    ),
    h(
      'p',
      { class: 'muted' },
      `${meta.sessionsCompleted} fullständiga pass`,
      lastPlayed ? ` · senast ${formatDay(lastPlayed)}` : '',
      ` · ${meta.unlockedUnitIds.length} av ${ctx.pack.units.length} enheter upplåsta`,
    ),
    h('h3', null, 'Värmekarta'),
    heatmap(states, stats),
    h('h3', null, 'Vanligaste förväxlingarna'),
    confusionList(states),
    h('h3', null, 'Övade minuter per dag'),
    minutesChart(minutesPerDay(sessions, today, 14)),
    h('h3', null, 'Inställningar'),
    settingsForm(ctx, profile),
    h('h3', null, 'Flytta till en annan enhet'),
    h(
      'p',
      { class: 'muted' },
      'QR-koden flyttar barnets status (vad som sitter). Säkerhetskopian (JSON) flyttar allt, även historiken.',
    ),
    h(
      'div',
      { class: 'button-row' },
      h('button', { class: 'soft-button', type: 'button', onclick: () => showQr(ctx, profile, states) }, 'Visa QR-kod'),
      h('button', { class: 'soft-button', type: 'button', onclick: () => void downloadBackup(ctx, profile) }, 'Spara säkerhetskopia (JSON)'),
    ),
    h('h3', null, 'Startkoll'),
    h('p', { class: 'muted' }, 'En kort koll av vilka tabeller barnet redan kan. Den kan bara flytta fram barnet, aldrig bakåt.'),
    h('button', { class: 'soft-button', type: 'button', onclick: () => showPlacementOffer(ctx, profile) }, 'Gör om startkollen'),
    h(
      'button',
      { class: 'link-button danger', type: 'button', onclick: () => void deleteProfile(ctx, profile) },
      `Ta bort ${profile.name}…`,
    ),
  );
}

const HEAT_CLASS = (s: ItemState | undefined) => {
  if (!s || s.status === 'new') return 'heat-new';
  if (s.status === 'learning') return s.box === 0 ? 'heat-learning-0' : 'heat-learning-1';
  return s.status === 'fluent' ? 'heat-fluent' : 'heat-automatic';
};

function heatmap(states: Record<string, ItemState>, stats: Map<string, FactStats>): HTMLElement {
  const detail = h('p', { class: 'heat-detail', 'aria-live': 'polite' }, 'Tryck på en ruta för detaljer.');
  const cells: HTMLElement[] = [h('div', { class: 'grid-corner' }, '×')];
  for (let b = MIN_FACTOR; b <= MAX_FACTOR; b++) cells.push(h('div', { class: 'grid-head' }, b));
  for (let a = MIN_FACTOR; a <= MAX_FACTOR; a++) {
    cells.push(h('div', { class: 'grid-head' }, a));
    for (let b = MIN_FACTOR; b <= MAX_FACTOR; b++) {
      const id = factId(a, b);
      const s = states[id];
      const st = stats.get(id);
      const text = describeFact(a, b, s, st);
      cells.push(h('button', { class: `heat-cell ${HEAT_CLASS(s)}`, type: 'button', 'aria-label': text, onclick: () => (detail.textContent = text) }));
    }
  }
  const legend = h(
    'ul',
    { class: 'heat-legend' },
    [
      ['heat-new', 'inte påbörjad'],
      ['heat-learning-0', 'ny'],
      ['heat-learning-1', 'övas'],
      ['heat-fluent', 'flytande'],
      ['heat-automatic', 'automatiserad'],
    ].map(([cls, label]) => h('li', null, h('span', { class: `heat-swatch ${cls}` }), label)),
  );
  return h('div', { class: 'heatmap-wrap' }, h('div', { class: 'heatmap', role: 'group', 'aria-label': 'Värmekarta' }, cells), legend, detail);
}

function describeFact(a: number, b: number, s: ItemState | undefined, st: FactStats | undefined): string {
  const parts = [`${formatFact(a, b)} = ${a * b}: ${STATUS_TEXT[s?.status ?? 'new']}`];
  if (st?.attempts) {
    parts.push(`${st.attempts} försök, ${Math.round((st.correct / st.attempts) * 100)} % rätt`);
    if (st.meanRtMs) parts.push(`snitt ${(st.meanRtMs / 1000).toFixed(1)} s`);
  }
  const worst = Object.entries(s?.confusions ?? {}).sort((x, y) => y[1] - x[1])[0];
  if (worst) parts.push(`vanligaste felsvar ${worst[0]}`);
  return parts.join(' · ');
}

function confusionList(states: Record<string, ItemState>): HTMLElement {
  const list = topConfusions(states, 8);
  if (!list.length) return h('p', { class: 'muted' }, 'Inga förväxlingar ännu.');
  return h(
    'ol',
    { class: 'confusions' },
    list.map((c) => h('li', null, h('strong', null, c.fact), ` – svarade ${c.given} `, h('span', { class: 'muted' }, `(${c.count} ${c.count === 1 ? 'gång' : 'gånger'})`))),
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

function settingsForm(ctx: AppContext, profile: Profile): HTMLElement {
  // Always merge into the latest saved version; only name/avatar changes need a redraw.
  let current = profile;
  const save = async (change: Partial<Omit<Profile, 'settings'>> & { settings?: Partial<Profile['settings']> }) => {
    current = { ...current, ...change, settings: { ...current.settings, ...change.settings } };
    await ctx.store.saveProfile(current);
    toast('Sparat');
    if (change.name !== undefined || change.avatar !== undefined) await showParent(ctx, profile.id);
  };
  const name = h('input', { type: 'text', value: profile.name, maxlength: 20, 'aria-label': 'Namn' });
  const voiceNote = h('p', { class: 'muted voice-note' });
  if (!speechSupported()) voiceNote.textContent = 'Den här webbläsaren kan inte läsa upp text.';
  else
    void hasSwedishVoice().then((ok) => {
      if (!ok) voiceNote.textContent = 'Ingen svensk röst hittades på enheten. Lägg till en i enhetens inställningar för tal/uppläsning.';
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
        checked: profile.settings.allowFree,
        onchange: (e: Event) => void save({ settings: { allowFree: (e.target as HTMLInputElement).checked } }),
      }),
      ' Fritt svar med sifferknappar när en fakta sitter (annars bara flerval)',
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
      ' Läs upp frågorna (svenska)',
    ),
    voiceNote,
  );
}

function showQr(ctx: AppContext, profile: Profile, states: Record<string, ItemState>): void {
  const text = encodeSnapshot(snapshotOf(profile, ctx.pack, states));
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

function importSection(ctx: AppContext): HTMLElement {
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
  const startScan = () => {
    const scanner = cameraScanner(
      (text) => {
        scanArea.replaceChildren();
        void importQr(ctx, text);
      },
      (message) => scanArea.replaceChildren(h('p', { class: 'notice' }, message)),
    );
    scanArea.replaceChildren(
      scanner.el,
      h('button', { class: 'link-button', type: 'button', onclick: () => (scanner.stop(), scanArea.replaceChildren()) }, 'Avbryt skanning'),
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
  );
}

async function importQr(ctx: AppContext, text: string): Promise<void> {
  try {
    const snap = decodeSnapshot(text);
    const engine = engineFor(profileFromSnapshot(snap, 'tmp', 0), ctx.deps);
    const { states, meta } = progressFromSnapshot(snap, engine, systemClock.today());
    const counts = engine.statusCounts(states);
    const existing = (await ctx.store.listProfiles()).find((p) => p.name === snap.name);
    const answer = await choose(
      `Hämta ${snap.name}?`,
      h('p', null, `${counts.automatic} automatiserade, ${counts.fluent} flytande och ${counts.learning} som övas.`),
      [
        ...(existing ? [{ value: 'replace' as const, label: `Ersätt ${existing.name} här`, primary: true }] : []),
        { value: 'new' as const, label: existing ? 'Lägg till som ny spelare' : 'Lägg till', primary: !existing },
      ],
    );
    if (!answer) return;
    const profile =
      answer === 'replace' && existing
        ? { ...existing, avatar: snap.avatar || existing.avatar }
        : profileFromSnapshot(snap, crypto.randomUUID(), Date.now());
    await ctx.store.saveProfile(profile);
    await ctx.store.save({ profileId: profile.id, packId: ctx.pack.id, packVersion: ctx.pack.version, states, meta, updatedAt: Date.now() });
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

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
