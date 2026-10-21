import { STAGING } from '../../staging';
import { DEFAULT_SETTINGS, type Profile } from '../../storage';
import { show, type AppContext } from '../app';
import { h } from '../dom';
import { choose } from '../components/modal';
import { installGuide, isStandalone } from '../pwa';
import { showImport } from './parent/importPage';
import { showPinGate } from './parent/pinGate';
import { placeIsOpen } from '../place';
import { prepareDayPlan, showValley } from './valley';
import { AVATAR_KEYS, avatarIcon, avatarName } from '../components/avatars';
import { icon } from '../components/icons';
import { plantIcon } from '../components/plant';
import { scene } from '../components/scene';
import { setWhere } from '../resume';
import { introDue, showIntro } from './intro';

/** The animals a player can be (stored as emoji, drawn as pictures). */
export const AVATARS = AVATAR_KEYS;

export async function showProfiles(ctx: AppContext): Promise<void> {
  setWhere(null);
  const profiles = await ctx.store.listProfiles();
  // No children yet: the grown-ups' first start, once (docs/PLAN-ENKLARE.md, E2), then the child's own screen.
  if (profiles.length === 0) return (await introDue(ctx)) ? showIntro(ctx) : showNewProfile(ctx, true);

  const view = h(
    'main',
    { class: 'screen profiles has-scene' },
    scene({ height: 120 }),
    h('h1', null, 'Vem spelar?'),
    h(
      'div',
      { class: 'profile-list' },
      profiles.map((p) =>
        h(
          'button',
          { class: 'profile-tile', type: 'button', onclick: () => void openProfile(ctx, p) },
          h('span', { class: 'avatar' }, avatarIcon(p.avatar)),
          h('span', { class: 'profile-name' }, p.name),
        ),
      ),
      h(
        'button',
        { class: 'profile-tile add', type: 'button', onclick: () => showNewProfile(ctx, false) },
        h('span', { class: 'avatar add-ring' }, icon('plus')),
        h('span', { class: 'profile-name' }, 'Ny spelare'),
      ),
    ),
    stagingNotice(),
    storageNotice(ctx),
    await installBanner(ctx),
    parentLink(ctx),
  );
  show(ctx, view);
}

const INSTALL_DISMISSED = 'installBannerDismissed';

/** A gentle hint for grown-ups to add the app to the home screen (once dismissed, gone). */
async function installBanner(ctx: AppContext): Promise<HTMLElement | null> {
  if (isStandalone() || (await ctx.store.getSetting<boolean>(INSTALL_DISMISSED))) return null;
  const banner: HTMLElement = h(
    'div',
    { class: 'install-banner' },
    h('p', null, icon('phone'), 'Lägg till appen på hemskärmen – då fungerar den utan internet och framstegen sparas säkrare.'),
    h(
      'div',
      { class: 'button-row' },
      h('button', { class: 'soft-button small', type: 'button', onclick: () => void choose('Lägg till på hemskärmen', installGuide(), [{ value: 'ok', label: 'Klar', primary: true }], { cancel: false }) }, 'Visa hur'),
      h(
        'button',
        {
          class: 'link-button',
          type: 'button',
          onclick: async () => {
            await ctx.store.setSetting(INSTALL_DISMISSED, true);
            banner.remove();
          },
        },
        'Inte nu',
      ),
    ),
  );
  return banner;
}

export function parentLink(ctx: AppContext, text = 'För vuxna', then?: () => Promise<void>): HTMLElement {
  return h('button', { class: 'link-button parent-link', type: 'button', onclick: () => void showPinGate(ctx, then) }, icon('lock'), text);
}

async function openProfile(ctx: AppContext, profile: Profile): Promise<void> {
  await ctx.store.setSetting('lastProfileId', profile.id);
  await showValley(ctx, profile);
}

/** The animals to choose from, the chosen one marked; `onPick` gets each new choice. */
export function avatarGrid(initial: string, onPick: (avatar: string) => void): HTMLElement {
  const buttons = AVATARS.map((a) =>
    h(
      'button',
      {
        class: `avatar-choice${a === initial ? ' selected' : ''}`,
        type: 'button',
        'aria-label': `Välj ${avatarName(a) ?? a}`,
        'aria-pressed': String(a === initial),
        dataset: { avatar: a },
        onclick: () => {
          onPick(a);
          for (const b of buttons) {
            const on = b.dataset.avatar === a;
            b.classList.toggle('selected', on);
            b.setAttribute('aria-pressed', String(on));
          }
        },
      },
      avatarIcon(a),
    ),
  );
  return h('div', { class: 'avatar-grid', role: 'group', 'aria-label': 'Välj djur' }, buttons);
}

/**
 * A new child, saved, and off to the first place open to them (the brook: the
 * garden opens later). The day's plan is made first, as the valley would, so
 * that place gets the whole day's time and not an even share with a place that
 * is not open. `check` is a grown-up's answer about the start check, when there
 * is one; otherwise the place asks the child.
 */
export async function startNewChild(ctx: AppContext, profile: Profile, check?: boolean): Promise<void> {
  await ctx.store.saveProfile(profile);
  await ctx.store.setSetting('lastProfileId', profile.id);
  await prepareDayPlan(ctx, profile);
  for (const place of ctx.places) {
    if (!(await placeIsOpen(place, ctx, profile))) continue;
    if (check !== undefined && place.firstStart) return place.firstStart(ctx, profile, check);
    return place.open(ctx, profile);
  }
  await showValley(ctx, profile);
}

/** A first avatar for a new child: the first one. */
export const FIRST_AVATAR = AVATARS[0] as string;

export function showNewProfile(ctx: AppContext, first: boolean): void {
  let avatar = FIRST_AVATAR;
  const input = h('input', {
    class: 'name-input',
    type: 'text',
    maxlength: 20,
    autocomplete: 'off',
    autocapitalize: 'words',
    'aria-label': 'Namn',
    placeholder: 'Namn',
    autofocus: true,
    oninput: () => update(),
  });
  const done = h('button', { class: 'big-button', type: 'button', disabled: true, onclick: () => void create() }, 'Klar');
  const avatars = avatarGrid(avatar, (a) => (avatar = a));

  function update() {
    done.disabled = input.value.trim().length === 0;
  }

  async function create() {
    await startNewChild(ctx, {
      id: crypto.randomUUID(),
      name: input.value.trim().slice(0, 20),
      avatar,
      createdAt: Date.now(),
      settings: { ...DEFAULT_SETTINGS },
    });
  }

  const view = h(
    'main',
    { class: 'screen new-profile has-scene' },
    scene({ height: 96 }),
    first ? h('p', { class: 'welcome' }, plantIcon('sprout'), 'Välkommen till Mattedalen!') : null,
    first ? stagingNotice() : null,
    h('h1', null, 'Vad heter du?'),
    h(
      'form',
      {
        class: 'new-profile-form',
        onsubmit: (e: Event) => {
          e.preventDefault();
          if (!done.disabled) void create();
        },
      },
      input,
      avatars,
      done,
    ),
    first
      ? parentLink(ctx, 'Har barnet spelat på en annan enhet? Hämta det här', () => showImport(ctx))
      : h('button', { class: 'link-button', type: 'button', 'data-back': '', onclick: () => void showProfiles(ctx) }, 'Tillbaka'),
  );
  show(ctx, view);
}

/** In the test version: its children are its own, apart from the real app's. */
export function stagingNotice(): HTMLElement | null {
  return STAGING ? h('p', { class: 'notice staging-notice' }, 'Testversion. Barnen här är skilda från den vanliga appen.') : null;
}

/** Small note for grown-ups when progress cannot be saved. */
function storageNotice(ctx: AppContext): HTMLElement | null {
  if (ctx.storageKind === 'memory') {
    return h('p', { class: 'notice' }, 'Obs! Webbläsaren tillåter inte sparande just nu (privat läge?). Framstegen försvinner när sidan stängs.');
  }
  return null;
}
