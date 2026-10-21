import { DEFAULT_SETTINGS } from '../../storage';
import { show, type AppContext } from '../app';
import { h } from '../dom';
import { icon } from '../components/icons';
import { plantIcon } from '../components/plant';
import { scene } from '../components/scene';
import { detectPlatform, installGuide, isStandalone } from '../pwa';
import { hasSwedishVoice, speechSupported } from '../speech';
import { setWhere } from '../resume';
import { showImport } from './parent/importPage';
import { choosePin, hasPin } from './parent/pinGate';
import { avatarGrid, FIRST_AVATAR, parentLink, showNewProfile, stagingNotice, startNewChild } from './profiles';

/**
 * The grown-ups' first start (docs/PLAN-ENKLARE.md, E2): on a device without
 * children, once. What the app is, the home screen, the grown-ups' code and a
 * few answers about the child; then the child chooses an animal and starts.
 * Every step can be skipped, to the child's own screen as before.
 */
export const INTRO_KEY = 'grownUpIntro';

export async function introDue(ctx: AppContext): Promise<boolean> {
  return !(await ctx.store.getSetting<string>(INTRO_KEY));
}

/** What the app is, in four lines: also the page "Så fungerar Mattedalen" in "För vuxna". */
export function aboutFacts(): HTMLElement {
  const fact = (iconEl: Element, title: string, text: string) => h('li', null, iconEl, h('span', null, h('strong', null, title), ' ', text));
  return h(
    'ul',
    { class: 'about-facts' },
    fact(plantIcon('sprout'), 'Vad:', 'taluppfattning, plus och minus och gångertabellerna, i små steg efter det barnet kan.'),
    fact(icon('watch'), 'Hur länge:', '10–15 minuter om dagen. Appen säger när det räcker.'),
    fact(icon('grownup'), 'Följa barnet:', 'under ”För vuxna” längst ned, bakom en kod.'),
    fact(icon('lock'), 'Var:', 'allt sparas bara på den här enheten. Inget skickas, och inget spåras.'),
  );
}

interface Answers {
  name: string;
  /** Whether the child reads by themselves; null when not answered or not asked. */
  reads: boolean | null;
  /** Whether to do the start check; null when not answered. */
  check: boolean | null;
  minutes: number;
}

export async function showIntro(ctx: AppContext): Promise<void> {
  setWhere(null);
  const steps: Step[] = ['welcome'];
  if (!isStandalone()) steps.push('home');
  if (!(await hasPin(ctx))) steps.push('pin');
  steps.push('child');
  const answers: Answers = { name: '', reads: null, check: null, minutes: DEFAULT_SETTINGS.sessionMinutes };
  const flow: Flow = { ctx, steps, answers };
  go(flow, 0);
}

type Step = 'welcome' | 'home' | 'pin' | 'child';

interface Flow {
  ctx: AppContext;
  steps: Step[];
  answers: Answers;
}

function go(flow: Flow, at: number): void {
  const step = flow.steps[at];
  if (step === undefined) return handOver(flow);
  const next = () => go(flow, at + 1);
  if (step === 'welcome') return welcome(flow, at, next);
  if (step === 'home') return home(flow, at, next);
  if (step === 'pin') return pin(flow, at, next);
  void child(flow, at, next);
}

/** Skipped: the child's own screen, as before the first start existed. */
async function skip(ctx: AppContext): Promise<void> {
  await ctx.store.setSetting(INTRO_KEY, 'skipped');
  showNewProfile(ctx, true);
}

/** Where the grown-up is: one dot per step. */
function dots(flow: Flow, at: number): HTMLElement {
  return h(
    'div',
    { class: 'intro-dots', role: 'img', 'aria-label': `Steg ${at + 1} av ${flow.steps.length}` },
    flow.steps.map((_, i) => h('span', { class: `intro-dot${i === at ? ' on' : i < at ? ' done' : ''}` })),
  );
}

const skipButton = (ctx: AppContext) => h('button', { class: 'link-button intro-skip', type: 'button', onclick: () => void skip(ctx) }, 'Hoppa över');

function page(flow: Flow, at: number, ...content: (Node | null)[]): HTMLElement {
  return h('main', { class: 'screen intro has-scene' }, scene({ height: 56 }), dots(flow, at), ...content, skipButton(flow.ctx));
}

function welcome(flow: Flow, at: number, next: () => void): void {
  show(
    flow.ctx,
    page(
      flow,
      at,
      h('p', { class: 'welcome' }, plantIcon('sprout'), 'Välkommen till Mattedalen!'),
      stagingNotice(),
      h('h1', null, 'Hej! Det här är för dig som vuxen.'),
      aboutFacts(),
      h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: next }, 'Kom igång', icon('arrow', 'on-primary')),
      parentLink(flow.ctx, 'Har barnet spelat på en annan enhet? Hämta det här', () => showImport(flow.ctx)),
    ),
  );
}

function home(flow: Flow, at: number, next: () => void): void {
  const ios = detectPlatform() === 'ios';
  show(
    flow.ctx,
    page(
      flow,
      at,
      h('h1', null, 'Lägg till appen på hemskärmen'),
      h('p', null, 'Då fungerar appen utan internet, och framstegen sparas säkrare.'),
      ios
        ? h('p', { class: 'notice' }, 'Gör det först och börja i appen på hemskärmen. På iPhone och iPad har den egen lagring, så det du gör här i Safari följer inte med.')
        : null,
      h('div', { class: 'intro-install' }, installGuide()),
      h('button', { class: 'big-button', type: 'button', onclick: next }, 'Fortsätt här', icon('arrow', 'on-primary')),
    ),
  );
}

function pin(flow: Flow, at: number, next: () => void): void {
  choosePin(
    flow.ctx,
    async () => next(),
    {
      text: 'Välj fyra siffror som barnen inte känner till. Koden skyddar inställningarna.',
      head: dots(flow, at),
      later: h('div', { class: 'intro-later' }, h('button', { class: 'link-button', type: 'button', onclick: next }, 'Senare'), skipButton(flow.ctx)),
    },
  );
}

/** Two answers side by side; `onPick` gets the chosen one. */
function choice<T>(label: string, options: [T, string][], picked: T | null, onPick: (value: T) => void): HTMLElement {
  const buttons = options.map(([value, text]) =>
    h(
      'button',
      {
        class: 'soft-button intro-choice',
        type: 'button',
        'aria-pressed': String(value === picked),
        onclick: () => {
          onPick(value);
          buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i]![0] === value)));
        },
      },
      text,
    ),
  );
  return h('fieldset', { class: 'intro-question' }, h('legend', null, label), h('div', { class: 'intro-choices' }, buttons));
}

async function child(flow: Flow, at: number, next: () => void): Promise<void> {
  const a = flow.answers;
  const voice = speechSupported() && (await hasSwedishVoice());
  const goOn = h('button', { class: 'big-button', type: 'button', disabled: true, onclick: next });
  const update = () => {
    const name = a.name.trim();
    goOn.replaceChildren(name ? `Lämna över till ${name}` : 'Lämna över', icon('arrow', 'on-primary'));
    (goOn as HTMLButtonElement).disabled = !name || a.check === null || (voice && a.reads === null);
  };
  const input = h('input', {
    class: 'name-input',
    type: 'text',
    maxlength: 20,
    autocomplete: 'off',
    autocapitalize: 'words',
    'aria-label': 'Namn',
    placeholder: 'Namn',
    value: a.name,
    oninput: (e: Event) => {
      a.name = (e.target as HTMLInputElement).value;
      update();
    },
  });
  update();
  show(
    flow.ctx,
    page(
      flow,
      at,
      h('h1', null, 'Om barnet'),
      h('label', { class: 'intro-label' }, 'Barnets namn', input),
      voice
        ? choice('Läser barnet själv?', [[true, 'Ja'], [false, 'Inte än']], a.reads, (v) => {
            a.reads = v;
            update();
          })
        : h('p', { class: 'muted intro-hint' }, 'Den här enheten har ingen svensk röst för uppläsning. Den kan slås på senare under barnets inställningar.'),
      voice ? h('p', { class: 'muted intro-hint' }, 'Läser barnet inte själv läser appen upp frågorna.') : null,
      choice('Kan barnet redan lite plus och minus?', [[true, 'Ja eller kanske'], [false, 'Nej']], a.check, (v) => {
        a.check = v;
        update();
      }),
      h('p', { class: 'muted intro-hint' }, 'Ja ger en kort startkoll, så att barnet börjar rätt.'),
      h(
        'label',
        { class: 'intro-label inline' },
        'Tid per dag ',
        h(
          'select',
          { 'aria-label': 'Tid per dag', onchange: (e: Event) => (a.minutes = Number((e.target as HTMLSelectElement).value)) },
          [10, 11, 12, 13, 14, 15].map((m) => h('option', { value: m, selected: m === a.minutes }, `${m} minuter`)),
        ),
      ),
      goOn,
    ),
  );
  input.focus({ preventScroll: true });
}

/** The child's turn: an animal, then the first place. */
function handOver(flow: Flow): void {
  const { ctx, answers: a } = flow;
  const name = a.name.trim().slice(0, 20);
  let avatar = FIRST_AVATAR;
  const done = async () => {
    await ctx.store.setSetting(INTRO_KEY, 'done');
    await startNewChild(
      ctx,
      {
        id: crypto.randomUUID(),
        name,
        avatar,
        createdAt: Date.now(),
        settings: { ...DEFAULT_SETTINGS, sessionMinutes: a.minutes, readAloud: a.reads === false },
      },
      a.check ?? undefined,
    );
  };
  show(
    ctx,
    h(
      'main',
      { class: 'screen new-profile has-scene' },
      scene({ height: 96 }),
      h('h1', null, `Hej ${name}!`),
      h('p', { class: 'intro-turn' }, 'Välj ditt djur.'),
      h('div', { class: 'new-profile-form' }, avatarGrid(avatar, (x) => (avatar = x)), h('button', { class: 'big-button', type: 'button', onclick: () => void done() }, 'Klar')),
    ),
  );
}
