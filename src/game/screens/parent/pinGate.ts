import { show, type AppContext } from '../../app';
import { h } from '../../dom';
import { showProfiles } from '../profiles';
import { showParent } from './parent';

const PIN_KEY = 'parentPin';
const PIN_LENGTH = 4;

/**
 * A simple PIN in front of the parent view. It is not a security feature
 * (the data is on the device anyway), it just keeps children from wandering
 * in by accident.
 */
export async function showPinGate(ctx: AppContext): Promise<void> {
  const pin = await ctx.store.getSetting<string>(PIN_KEY);
  if (!pin) return choosePin(ctx);
  pinScreen(ctx, 'Vuxenkod', 'Skriv in koden för att komma till föräldravyn.', async (entered, retry) => {
    if (entered === pin) await showParent(ctx);
    else retry('Fel kod. Försök igen.');
  }, true);
}

export function choosePin(ctx: AppContext, afterSave: () => Promise<void> = () => showParent(ctx)): void {
  pinScreen(ctx, 'Välj en vuxenkod', 'Fyra siffror som barnen inte känner till.', (first) => {
    pinScreen(ctx, 'Skriv koden igen', 'För att vara säker på att den blev rätt.', async (second, retry) => {
      if (second !== first) return retry('Koderna var olika. Börja om.', () => choosePin(ctx, afterSave));
      await ctx.store.setSetting(PIN_KEY, first);
      await afterSave();
    });
  });
}

type Retry = (message: string, then?: () => void) => void;

function pinScreen(ctx: AppContext, title: string, text: string, onPin: (pin: string, retry: Retry) => void | Promise<void>, canReset = false): void {
  let value = '';
  const dots = h('div', { class: 'pin-dots', 'aria-live': 'polite', 'aria-label': 'Inmatade siffror' });
  const message = h('p', { class: 'pin-message', role: 'alert' });
  const renderDots = () => {
    dots.replaceChildren(...Array.from({ length: PIN_LENGTH }, (_, i) => h('span', { class: `pin-dot${i < value.length ? ' filled' : ''}` })));
    dots.setAttribute('aria-label', `${value.length} av ${PIN_LENGTH} siffror`);
  };
  const retry: Retry = (msg, then) => {
    value = '';
    renderDots();
    message.textContent = msg;
    dots.classList.remove('shake');
    void dots.getBoundingClientRect();
    dots.classList.add('shake');
    if (then) setTimeout(then, 1200);
  };
  const type = (d: string) => {
    if (value.length >= PIN_LENGTH) return;
    value += d;
    message.textContent = '';
    renderDots();
    if (value.length === PIN_LENGTH) void onPin(value, retry);
  };
  const erase = () => {
    value = value.slice(0, -1);
    renderDots();
  };
  const key = (d: string) => h('button', { class: 'numpad-key', type: 'button', onclick: () => type(d) }, d);
  const keys = h(
    'div',
    { class: 'numpad-keys pin-keys' },
    [...'123456789'].map(key),
    h('button', { class: 'numpad-key back', type: 'button', 'aria-label': 'Sudda', onclick: erase }, '⌫'),
    key('0'),
    h('span'),
  );
  const onKey = (e: KeyboardEvent) => {
    if (/^\d$/.test(e.key)) type(e.key);
    else if (e.key === 'Backspace') erase();
  };

  const view = h(
    'main',
    { class: 'screen pin-screen' },
    h('header', { class: 'top-bar' }, h('button', { class: 'icon-button', type: 'button', 'aria-label': 'Tillbaka', onclick: () => void showProfiles(ctx) }, '←')),
    h('h1', null, `🔒 ${title}`),
    h('p', null, text),
    dots,
    message,
    keys,
    canReset ? h('button', { class: 'link-button', type: 'button', onclick: () => forgotPin(ctx) }, 'Glömt koden?') : null,
  );
  renderDots();
  document.addEventListener('keydown', onKey);
  show(ctx, view, () => document.removeEventListener('keydown', onKey));
}

/** Forgotten PIN: a grown-up check (an addition no young child does quickly), then a new PIN. */
function forgotPin(ctx: AppContext): void {
  const x = 23 + Math.floor(Math.random() * 60);
  const y = 31 + Math.floor(Math.random() * 60);
  const input = h('input', { class: 'name-input', type: 'text', inputmode: 'numeric', 'aria-label': 'Svar', autofocus: true });
  const message = h('p', { class: 'pin-message', role: 'alert' });
  const view = h(
    'main',
    { class: 'screen pin-screen' },
    h('h1', null, 'Glömt koden'),
    h('p', null, `Svara på frågan för att välja en ny kod: vad är ${x} + ${y} + ${x}?`),
    h(
      'form',
      {
        class: 'new-profile-form',
        onsubmit: (e: Event) => {
          e.preventDefault();
          if (Number(input.value) === x + y + x) choosePin(ctx);
          else message.textContent = 'Inte rätt. Försök igen.';
        },
      },
      input,
      message,
      h('button', { class: 'big-button', type: 'submit' }, 'Fortsätt'),
    ),
    h('button', { class: 'link-button', type: 'button', onclick: () => void showProfiles(ctx) }, 'Avbryt'),
  );
  show(ctx, view);
}
