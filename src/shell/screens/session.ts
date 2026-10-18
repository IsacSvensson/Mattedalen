import { answerDigits, type Feedback, type FocusSet, type ItemId, type Question, type SessionMode, type SessionSummary } from '../../engine';
import type { Profile } from '../../storage';
import { show, type AppContext } from '../app';
import { icon } from '../components/icons';
import { plantIcon } from '../components/plant';
import { numPad } from '../components/numPad';
import { scene } from '../components/scene';
import { h, prefersReducedMotion, wait } from '../dom';
import { PlayController, type GameDeps } from '../play';
import { DEFAULT_DIVISION_SIGN, mathNodes, type DivisionSign } from '../divisionSign';
import { hasSwedishVoice, speak, speechSupported, spokenText, stopSpeaking } from '../speech';
import { keepTerms } from '../words';
import { choiceKeys } from '../components/choiceKeys';

/** One step on a derivation path ("räknestigen"). Only the last step is the answer to the question. */
export interface PathStep {
  label: string;
  prompt: string;
  answer: number;
}

/** A new item, as the place introduces it. */
export interface IntroParts {
  /** Above the prompt, e.g. a seed and "Ett nytt frö". */
  label: (Node | string)[];
  /** Read aloud when the card appears. */
  spoken: string;
  /** What the child does with the new item; calls `ready` when the child may answer. */
  body: HTMLElement;
  /** Shown with the "Nu du!" button once ready, e.g. the strategy. */
  after: (Node | null)[];
}

/** Support for a hard item: steps from known items, or something the child builds before answering. */
export type Support = { steps: PathStep[]; visual: Element } | { build: (q: Question, ready: () => void) => IntroParts };

/** Help after a wrong answer, as the place shows it. */
export interface HelpParts {
  /** A friendly word about a typical mix-up, e.g. "48 är 8 × 6 – nära!". */
  note?: string | null;
  /** A way to think. */
  strategy?: string;
  /** A picture of the item. */
  visual?: Element;
}

/**
 * What a place adds to a practice session. The session itself (the band of
 * drops, questions, answers, read-aloud, the derivation path and the help
 * card) is the same in every place.
 */
export interface SessionPlace {
  deps: GameDeps;
  /** Label of the button back to the place, e.g. "Tillbaka till trädgården". */
  homeLabel: string;
  /** Back to the place when the session ends early; `grew` are items that reached a new level. */
  leave(grew: Set<ItemId>): Promise<void>;
  /** The ending after a whole session. */
  end(summary: SessionSummary, focus?: FocusSet): void;
  intro(q: Question, ready: () => void): IntroParts;
  /**
   * Support for a hard item: a derivation path with a picture beside it, or
   * something to build first (then the item is asked), or null for none.
   */
  derivation(q: Question): Support | null;
  help(q: Question, fb: Feedback): HelpParts;
  /** A line above the prompt, e.g. "Stämmer det?". */
  questionLabel?(q: Question): string | null;
  /** How an option is shown, e.g. "Ja" for `ja`. */
  choiceLabel?(value: string): string;
  /** A fixed order for the choices (Ja before Nej), where shuffling them would only confuse. */
  choiceOrder?(values: string[]): string[];
  /** A picture beside the question while the item is new to the child (faded out later). */
  askVisual?(q: Question): Element | null;
  /** Time a typed answer to its first digit (J5), so 13 is not slower than 8 just to type. */
  timeToFirstDigit?: boolean;
  /** What the keys and answer buttons are made of: light wood (the default) or smooth stones (the brook). */
  keys?: 'wood' | 'stone';
}

/**
 * The prompt as shown: a blank (`__`) becomes an empty box, and long
 * prompts (`7 + 5 = __ + 8`) get a smaller size.
 */
export function promptView(prompt: string, sign: DivisionSign = divisionSign): HTMLElement {
  const parts = prompt.split('__');
  const blank = parts.length > 1;
  const content: (Node | string)[] = [];
  parts.forEach((part, i) => {
    if (i > 0) content.push(h('span', { class: 'blank', 'aria-hidden': 'true' }, '?'));
    // Divisions in the child's sign: a stacked fraction by default.
    content.push(...mathNodes(part, sign));
  });
  const stacked = sign === 'fraction' && prompt.includes('÷');
  const words = isWords(prompt);
  return h(
    'p',
    {
      class: `prompt${words ? ' words' : prompt.length > 7 ? ' long' : ''}${blank ? ' has-blank' : ''}${stacked ? ' has-frac' : ''}`,
      // The prompt as written, whatever the sign (for tests and tools).
      'data-prompt': prompt,
      // A question in words is read as it stands; one with its own equal sign too; "3 × 7" as "3 gånger 7 är lika med?".
      'aria-label': words ? prompt : prompt.includes('=') ? `${spokenText(prompt)}?` : `${spokenText(prompt)} är lika med?`,
    },
    content,
  );
}

/** How the child writes "delat med" (profile setting), for this session. */
let divisionSign: DivisionSign = DEFAULT_DIVISION_SIGN;

/** Pause after a correct answer before the next question. */
const CORRECT_PAUSE_MS = 650;

/** Read questions aloud in this session (profile setting, if the device can speak). */
let voiceOn = false;
/** The prompt on screen, for the "read again" button in the top band. */
let currentPrompt = '';

/** Drops in the top band: they fill up as the session's time passes (no clock, no count). */
const DROPS = 12;

export async function runSession(
  ctx: AppContext,
  profile: Profile,
  place: SessionPlace,
  mode: SessionMode,
  focus?: FocusSet,
): Promise<void> {
  const play = await PlayController.start(profile, place.deps, mode, focus);
  voiceOn = profile.settings.readAloud && speechSupported() && (await hasSwedishVoice());
  divisionSign = profile.settings.divisionSign ?? DEFAULT_DIVISION_SIGN;
  const stage = h('section', { class: 'play-stage', 'aria-live': 'polite' });
  let keyHandler: ((e: KeyboardEvent) => void) | undefined;
  let finished = false;

  const finish = async (early: boolean) => {
    if (finished) return;
    finished = true;
    const summary = await play.finish();
    if (early || summary.answered === 0) await place.leave(new Set(summary.promoted));
    else place.end(summary, play.focus);
  };

  const drops = Array.from({ length: DROPS }, () => h('i', { class: 'drop' }));
  const progress = h(
    'div',
    { class: 'session-progress', role: 'progressbar', 'aria-label': 'Hur långt passet har kommit', 'aria-valuemin': 0, 'aria-valuemax': 100 },
    play.focus ? h('span', { class: 'focus-tag' }, icon('target'), play.focus.title) : null,
    h('span', { class: 'drops' }, drops),
  );
  const updateProgress = () => {
    const done = play.progress();
    drops.forEach((d, i) => d.classList.toggle('on', i < Math.round(done * DROPS)));
    progress.setAttribute('aria-valuenow', String(Math.round(done * 100)));
  };
  updateProgress();

  const view = h(
    'main',
    { class: `screen session has-scene mode-${mode} keys-${place.keys ?? 'wood'}` },
    h(
      'header',
      { class: 'play-head' },
      scene({ height: 92, sun: false, cloud: false }),
      h(
        'div',
        { class: 'scene-controls' },
        h('button', { class: 'icon-button', type: 'button', 'aria-label': place.homeLabel, onclick: () => void finish(true) }, icon('home')),
        progress,
        voiceOn
          ? h('button', { class: 'icon-button speak-button', type: 'button', 'aria-label': 'Läs upp igen', onclick: () => void speak(currentPrompt) }, icon('speaker'))
          : null,
      ),
    ),
    stage,
  );
  show(ctx, view, () => {
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
    stopSpeaking();
  });

  const setKeys = (handler?: (e: KeyboardEvent) => void) => {
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
    keyHandler = handler;
    if (handler) document.addEventListener('keydown', handler);
  };

  while (!finished) {
    const q = play.question();
    if (!q) break;
    if (q.kind === 'new') await introduce(stage, q, (ready) => place.intro(q, ready), setKeys);
    if (finished) return;
    const support = q.kind === 'derive' ? place.derivation(q) : null;
    // Something to build first: then the item itself, still with support (no evidence).
    if (support && 'build' in support) await introduce(stage, q, (ready) => support.build(q, ready), setKeys);
    if (finished) return;
    const { given, rtMs } = support && 'steps' in support ? await derive(stage, support.steps, support.visual, setKeys, answerDigits(place.deps.pack)) : await ask(stage, q, place, setKeys);
    if (finished) return;
    const fb = await play.answer(given, rtMs);
    updateProgress();
    await showFeedback(stage, q, fb, place, setKeys);
  }
  setKeys(undefined);
  await finish(false);
}

type SetKeys = (handler?: (e: KeyboardEvent) => void) => void;

/** A new item: the place shows how it works, then the child answers it themselves ("Nu du!"). */
function introduce(stage: HTMLElement, q: Question, intro: (ready: () => void) => IntroParts, setKeys: SetKeys): Promise<void> {
  return new Promise((resolve) => {
    const go = h('button', { class: 'big-button', type: 'button', onclick: () => resolve() }, 'Nu du!', icon('arrow', 'on-primary'));
    const after = h('div', { class: 'intro-after', hidden: true });
    const parts = intro(() => {
      after.hidden = false;
      go.focus();
      setKeys((e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          resolve();
        }
      });
    });
    after.append(...parts.after.filter((n): n is Node => n !== null), go);
    currentPrompt = q.prompt;
    if (voiceOn) void speak(parts.spoken);
    stage.replaceChildren(
      h('div', { class: 'intro-card card' }, h('p', { class: 'intro-label' }, parts.label), introPrompt(q.prompt), parts.body, after),
    );
    setKeys(undefined);
  });
}

/**
 * The item with its answer: "3 × 7 = 21", the blank filled in
 * ("5 + 3 = 4 + 4"), or a statement with its verdict ("3 + 4 = 4 + 3: Ja").
 */
export function helpAnswer(prompt: string, expected: string): string {
  if (prompt.includes('__')) return prompt.replace('__', expected);
  if (isWords(prompt)) return `${prompt} Svaret är ${expected}.`;
  if (prompt.includes('=')) return `${prompt}: ${expected}`;
  return `${prompt} = ${expected}`;
}

/** The prompt on the intro card (a blank stays a blank until the child answers). */
function introPrompt(prompt: string): HTMLElement {
  if (prompt.includes('__')) return promptView(prompt);
  const stacked = divisionSign === 'fraction' && prompt.includes('÷');
  return h('p', { class: `prompt${stacked ? ' has-frac' : ''}${isWords(prompt) ? ' words' : ''}`, 'data-prompt': prompt }, mathNodes(prompt, divisionSign));
}

/** A prompt in words ("12 jordgubbar delas lika i 3 korgar …") rather than a number sentence. */
const isWords = (prompt: string) => /[a-zåäö]{3}/i.test(prompt);

/**
 * "Räknestigen": an item the child finds hard, reached in steps from items it
 * knows (5 × 7 = 35 → 35 + 7 → 6 × 7). A wrong step just shows the number and
 * the path goes on; only the last step is the answer to the question.
 */
async function derive(stage: HTMLElement, steps: PathStep[], visual: Element, setKeys: SetKeys, digits: number): Promise<{ given: string; rtMs: number }> {
  const list = h('ol', { class: 'derive-steps' });
  const card = h('div', { class: 'derive-card card' }, h('p', { class: 'derive-title' }, icon('steps'), 'Räknestigen'), list, visual);
  const done: HTMLElement[] = [];
  let result = { given: '', rtMs: 0 };
  // Built once, so the picture does not animate again at every step.
  const padSlot = h('div', { class: 'derive-pad' });
  stage.replaceChildren(h('div', { class: 'question free derive' }, card, padSlot));

  for (const [i, step] of steps.entries()) {
    const last = i === steps.length - 1;
    const current = h(
      'li',
      { class: `derive-step current${last ? ' target' : ''}` },
      h('span', { class: 'derive-label' }, step.label),
      h('span', { class: 'derive-prompt', 'data-prompt': step.prompt }, mathNodes(step.prompt, divisionSign)),
      h('span', { class: 'derive-eq' }, ' = ?'),
    );
    list.replaceChildren(...done, current);
    currentPrompt = step.prompt;
    if (voiceOn) void speak(`${step.label}. ${step.prompt}`);
    const answer = await new Promise<{ given: string; rtMs: number }>((resolve) => {
      const shownAt = performance.now();
      const pad = numPad((value) => {
        pad.disable();
        resolve({ given: value, rtMs: Math.round(performance.now() - shownAt) });
      }, digits);
      padSlot.replaceChildren(pad.el);
      setKeys((e) => pad.onKey(e));
    });
    setKeys(undefined);
    if (last) {
      result = answer;
      break;
    }
    const right = Number(answer.given) === step.answer;
    current.classList.remove('current');
    current.classList.add(right ? 'right' : 'shown');
    current.querySelector('.derive-eq')?.replaceWith(h('span', { class: 'derive-eq' }, ` = ${step.answer}`), right ? icon('check') : '');
    done.push(current);
    // A wrong step: the number stays visible a moment longer, without any red.
    await wait(prefersReducedMotion() ? 200 : right ? 450 : 1200);
  }
  return result;
}

/** Multiple choice or free answer on a number pad. Response time is measured but never shown. */
function ask(stage: HTMLElement, q: Question, place: SessionPlace, setKeys: SetKeys): Promise<{ given: string; rtMs: number }> {
  return new Promise((resolve) => {
    let answered = false;
    let shownAt = performance.now();
    currentPrompt = q.prompt;
    if (voiceOn) {
      // Time the answer from when the question has been heard, not while it is read.
      void speak(q.prompt).then(() => {
        if (!answered) shownAt = performance.now();
      });
    }
    const done = (value: string, firstDigitAt: number | null = null) => {
      if (answered) return false;
      answered = true;
      const end = place.timeToFirstDigit && firstDigitAt !== null ? firstDigitAt : performance.now();
      resolve({ given: value, rtMs: Math.round(Math.max(0, end - shownAt)) });
      return true;
    };
    const label = place.questionLabel?.(q);
    const prompt = h(
      'div',
      { class: 'prompt-card card' },
      label ? h('p', { class: 'ask-label' }, label) : null,
      promptView(q.prompt),
      q.format === 'free' || q.prompt.includes('=') || isWords(q.prompt) ? null : h('p', { class: 'eq', 'aria-hidden': 'true' }, '= ?'),
      place.askVisual?.(q) ?? null,
    );

    if (q.format === 'free') {
      const pad = numPad((value, firstDigitAt) => {
        if (done(value, firstDigitAt)) pad.disable();
      }, answerDigits(place.deps.pack));
      stage.replaceChildren(h('div', { class: 'question free' }, prompt, pad.el));
      setKeys((e) => pad.onKey(e));
      return;
    }

    const choices = place.choiceOrder?.(q.choices ?? []) ?? q.choices ?? [];
    const choose = (value: string, button: HTMLButtonElement) => {
      if (!done(value)) return;
      button.classList.add('chosen');
      for (const b of buttons) b.disabled = true;
    };
    const numeric = choices.every((c) => /^\d+$/.test(c));
    const buttons = choices.map((value, i) =>
      h(
        'button',
        {
          class: 'choice',
          type: 'button',
          dataset: { value },
          // The digit keys type a number answer; otherwise 1, 2, 3 … pick a choice.
          'aria-keyshortcuts': numeric ? undefined : String(i + 1),
          onclick: (e: Event) => choose(value, e.currentTarget as HTMLButtonElement),
        },
        place.choiceLabel?.(value) ?? value,
      ),
    );
    stage.replaceChildren(h('div', { class: 'question' }, prompt, h('div', { class: 'answer-area choices' }, buttons)));
    const keys = choiceKeys(choices, (i) => choose(choices[i]!, buttons[i]!), {
      typed: (text) => buttons.forEach((b, i) => b.classList.toggle('keyed', text !== '' && choices[i]!.startsWith(text))),
    });
    setKeys((e) => keys.onKey(e));
  });
}

/** Correct: a short cheer. Wrong: never just "fel" — show the right answer and a way to think. */
async function showFeedback(stage: HTMLElement, q: Question, fb: Feedback, place: SessionPlace, setKeys: SetKeys): Promise<void> {
  for (const b of stage.querySelectorAll<HTMLButtonElement>('.choice')) {
    if (b.dataset.value === fb.expected) b.classList.add('correct');
    else if (b.dataset.value === fb.given) b.classList.add('wrong');
  }
  stage.querySelector('.numpad-display')?.classList.add(fb.correct ? 'correct' : 'wrong');
  setKeys(undefined);
  if (fb.correct) {
    const card = stage.querySelector('.prompt-card');
    card?.classList.add('is-right');
    const eq = card?.querySelector('.eq');
    if (eq) eq.textContent = `= ${fb.expected}`;
    const blank = card?.querySelector('.blank');
    if (blank) {
      blank.textContent = place.choiceLabel?.(fb.expected) ?? fb.expected;
      blank.classList.add('filled');
    }
    card?.append(h('span', { class: 'cheer-plant', 'aria-hidden': 'true' }, plantIcon('sprout')));
    await wait(prefersReducedMotion() ? 300 : CORRECT_PAUSE_MS);
    return;
  }

  const help = place.help(q, fb);
  const label = (value: string) => place.choiceLabel?.(value) ?? value;
  // The help shows the item in its usual form, whatever form it was asked in.
  const answer = helpAnswer(q.item.prompt, label(fb.expected));
  if (voiceOn) void speak(answer);
  await new Promise<void>((resolve) => {
    const next = h('button', { class: 'big-button', type: 'button', onclick: () => resolve() }, 'Fortsätt', icon('arrow', 'on-primary'));
    // The help takes the place of the question: the answer is in it.
    stage.replaceChildren(
      h(
        'div',
        { class: 'help-wrap' },
        h(
          'div',
          { class: 'help-card card' },
          h('p', { class: 'you-said' }, fb.given ? `Du svarade ${label(fb.given)}.` : 'Inget svar den här gången.', help.strategy ? ' Så här kan du tänka:' : ''),
          h('p', { class: `help-answer${isWords(answer) ? ' words' : ''}`, 'data-prompt': answer }, mathNodes(answer, divisionSign)),
          help.note ? h('p', { class: 'confusion-note' }, help.note) : null,
          help.strategy ? h('p', { class: 'strategy' }, mathNodes(keepTerms(help.strategy), divisionSign)) : null,
          help.visual ?? null,
        ),
        next,
      ),
    );
    next.focus();
    setKeys((e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        resolve();
      }
    });
  });
  setKeys(undefined);
}
