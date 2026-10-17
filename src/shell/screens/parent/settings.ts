import { DEFAULT_CONFIG } from '../../../engine';
import { encodeTransfer, exportFileName, type Profile } from '../../../storage';
import type { AppContext } from '../../app';
import { AVATAR_KEYS, avatarName } from '../../components/avatars';
import { choose, toast } from '../../components/modal';
import { h } from '../../dom';
import type { SaveProfile } from '../../place';
import { loadProgress, moreTime } from '../../play';
import { hasSwedishVoice, speechSupported } from '../../speech';
import { qrSvgMarkup, transferOf } from '../../transfer';
import { genitive } from '../../words';
import { profileSaver, showParentPage } from './frame';
import { showParent } from './parent';
import { showPilotExport } from './pilot';

/**
 * The child's settings in one place (docs/PLAN-FORALDRAVYN.md): name, animal,
 * the day's time and read-aloud, then what each place lets a grown-up choose,
 * and last moving, saving or removing the child.
 */
export async function showChildSettings(ctx: AppContext, profileId: string): Promise<void> {
  const profile = await ctx.store.getProfile(profileId);
  if (!profile) return showParent(ctx);
  const save = profileSaver(ctx, profile, () => showChildSettings(ctx, profileId));
  const places = (
    await Promise.all(
      ctx.places.map(async (place) => {
        const part = place.parentSettings ? await place.parentSettings(ctx, profile, save) : null;
        return part ? h('section', { class: 'parent-section', 'aria-label': place.name }, h('h2', null, place.name), part) : null;
      }),
    )
  ).filter((x) => x !== null);

  showParentPage(
    ctx,
    { title: `${genitive(profile.name)} inställningar`, back: () => void showParent(ctx, profileId) },
    h('section', { class: 'parent-section', 'aria-label': 'I alla platser' }, h('h2', null, 'I alla platser'), settingsForm(profile, save)),
    ...places,
    h(
      'section',
      { class: 'parent-section', 'aria-labelledby': 'move-heading' },
      h('h2', { id: 'move-heading' }, 'Flytta eller spara'),
      h('p', { class: 'muted' }, 'QR-koden flyttar barnets status (vad som sitter). Säkerhetskopian (JSON) flyttar allt, även historiken.'),
      h(
        'div',
        { class: 'button-row' },
        h('button', { class: 'soft-button', type: 'button', onclick: () => void showQr(ctx, profile) }, 'Visa QR-kod'),
        h('button', { class: 'soft-button', type: 'button', onclick: () => void downloadBackup(ctx, profile) }, 'Spara säkerhetskopia (JSON)'),
        h('button', { class: 'soft-button', type: 'button', onclick: () => void showPilotExport(ctx, profile.id) }, 'Fil till piloten…'),
      ),
      h('button', { class: 'link-button danger', type: 'button', onclick: () => void deleteProfile(ctx, profile) }, `Ta bort ${profile.name}…`),
    ),
  );
}

const rules = DEFAULT_CONFIG.status;
const more = moreTime(rules);
const sec = (ms: number) => `${ms / 1000} s`;

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
    h('p', { class: 'muted' }, 'Passlängden är hela dagens tid. Den delas mellan dagens platser efter hur mycket som ska repeteras.'),
    h(
      'label',
      { class: 'check' },
      h('input', {
        type: 'checkbox',
        checked: profile.settings.moreTime === true,
        onchange: (e: Event) => void save({ settings: { moreTime: (e.target as HTMLInputElement).checked } }),
      }),
      h('span', null, 'Ge mer tid'),
    ),
    h(
      'p',
      { class: 'muted' },
      `För ett barn som svarar rätt men långsamt. En buske kräver då svar under ${sec(more.fluentRtMs)} i stället för ${sec(rules.fluentRtMs)}, och ett träd under ${sec(more.automaticRtMs)} i stället för ${sec(rules.automaticRtMs)}. Det som redan har vuxit står kvar om du slår av det.`,
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
      h('span', null, 'Läs upp frågorna och dalens platser (svenska)'),
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
    h('div', { class: 'qr-wrap' }, qr, h('p', null, 'Öppna För vuxna på den andra enheten, välj ”Hämta ett barn” och ”Skanna QR-kod”, och rikta kameran hit. Det går också att fotografera koden och välja bilden.')),
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

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
