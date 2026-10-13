import { DEFAULT_SETTINGS, type Profile } from '../../storage';
import { show, type AppContext } from '../app';
import { h } from '../dom';
import { showGarden } from './garden';

export const AVATARS = ['🦊', '🐢', '🐸', '🐰', '🐻', '🦉', '🐝', '🦋', '🐞', '🐱', '🐶', '🦁'];

export async function showProfiles(ctx: AppContext): Promise<void> {
  const profiles = await ctx.store.listProfiles();
  if (profiles.length === 0) return showNewProfile(ctx, true);

  const view = h(
    'main',
    { class: 'screen profiles' },
    h('h1', null, 'Vem spelar?'),
    h(
      'div',
      { class: 'profile-list' },
      profiles.map((p) =>
        h(
          'button',
          { class: 'profile-tile', type: 'button', onclick: () => void openProfile(ctx, p) },
          h('span', { class: 'avatar', 'aria-hidden': 'true' }, p.avatar),
          h('span', { class: 'profile-name' }, p.name),
        ),
      ),
      h(
        'button',
        { class: 'profile-tile add', type: 'button', onclick: () => showNewProfile(ctx, false) },
        h('span', { class: 'avatar', 'aria-hidden': 'true' }, '＋'),
        h('span', { class: 'profile-name' }, 'Ny spelare'),
      ),
    ),
    storageNotice(ctx),
  );
  show(ctx, view);
}

async function openProfile(ctx: AppContext, profile: Profile): Promise<void> {
  await ctx.store.setSetting('lastProfileId', profile.id);
  await showGarden(ctx, profile);
}

function showNewProfile(ctx: AppContext, first: boolean): void {
  let avatar = AVATARS[0] as string;
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
  const avatarButtons = AVATARS.map((a) =>
    h(
      'button',
      {
        class: `avatar-choice${a === avatar ? ' selected' : ''}`,
        type: 'button',
        'aria-label': `Välj ${a}`,
        'aria-pressed': String(a === avatar),
        onclick: () => {
          avatar = a;
          for (const b of avatarButtons) {
            const on = b.textContent === a;
            b.classList.toggle('selected', on);
            b.setAttribute('aria-pressed', String(on));
          }
        },
      },
      a,
    ),
  );

  function update() {
    done.disabled = input.value.trim().length === 0;
  }

  async function create() {
    const profile: Profile = {
      id: crypto.randomUUID(),
      name: input.value.trim().slice(0, 20),
      avatar,
      createdAt: Date.now(),
      settings: { ...DEFAULT_SETTINGS },
    };
    await ctx.store.saveProfile(profile);
    await openProfile(ctx, profile);
  }

  const view = h(
    'main',
    { class: 'screen new-profile' },
    first ? h('p', { class: 'welcome' }, '🌱 Välkommen till Gångerträdgården!') : null,
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
      h('div', { class: 'avatar-grid', role: 'group', 'aria-label': 'Välj djur' }, avatarButtons),
      done,
    ),
    first ? null : h('button', { class: 'link-button', type: 'button', onclick: () => void showProfiles(ctx) }, 'Tillbaka'),
  );
  show(ctx, view);
}

/** Small note for grown-ups when progress cannot be saved. */
function storageNotice(ctx: AppContext): HTMLElement | null {
  if (ctx.storageKind === 'memory') {
    return h('p', { class: 'notice' }, 'Obs! Webbläsaren tillåter inte sparande just nu (privat läge?). Framstegen försvinner när sidan stängs.');
  }
  return null;
}
