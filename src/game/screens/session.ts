import type { Feedback, Question } from '../../engine';
import { parseFactId } from '../../content/multiplication';
import type { Profile } from '../../storage';
import { show, type AppContext } from '../app';
import { arrayView } from '../components/arrayView';
import { h, prefersReducedMotion, wait } from '../dom';
import { PlayController } from '../play';
import { showGarden } from './garden';
import { showSessionEnd } from './sessionEnd';

/** Pause after a correct answer before the next question. */
const CORRECT_PAUSE_MS = 650;

export async function showSession(ctx: AppContext, profile: Profile, mode: 'daily' | 'extra'): Promise<void> {
  const play = await PlayController.start(profile, ctx.deps, mode);
  const stage = h('section', { class: 'play-stage', 'aria-live': 'polite' });
  let keyHandler: ((e: KeyboardEvent) => void) | undefined;
  let finished = false;

  const finish = async (early: boolean) => {
    if (finished) return;
    finished = true;
    const summary = await play.finish();
    if (early || summary.answered === 0) await showGarden(ctx, profile, new Set(summary.promoted));
    else showSessionEnd(ctx, profile, summary);
  };

  const view = h(
    'main',
    { class: `screen session mode-${mode}` },
    h(
      'header',
      { class: 'top-bar' },
      h('button', { class: 'icon-button', type: 'button', 'aria-label': 'Tillbaka till trädgården', onclick: () => void finish(true) }, '🏡'),
    ),
    stage,
  );
  show(ctx, view, () => {
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
  });

  const setKeys = (handler?: (e: KeyboardEvent) => void) => {
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
    keyHandler = handler;
    if (handler) document.addEventListener('keydown', handler);
  };

  while (!finished) {
    const q = play.question();
    if (!q) break;
    if (q.kind === 'new') await introduce(stage, q, setKeys);
    if (finished) return;
    const { given, rtMs } = await ask(stage, q, setKeys);
    if (finished) return;
    const fb = await play.answer(given, rtMs);
    await showFeedback(stage, q, fb, setKeys);
  }
  setKeys(undefined);
  await finish(false);
}

type SetKeys = (handler?: (e: KeyboardEvent) => void) => void;

/** A new fact: show it as a rectangle of dots and how it connects to known facts, then ask. */
function introduce(stage: HTMLElement, q: Question, setKeys: SetKeys): Promise<void> {
  const { a, b } = parseFactId(q.item.id);
  const strategy = q.item.hints.find((x) => x.kind === 'strategy')?.text;
  const swap = q.pairKnown ? q.item.hints.find((x) => x.kind === 'swap')?.text : undefined;
  return new Promise((resolve) => {
    const go = h('button', { class: 'big-button', type: 'button', onclick: () => resolve() }, 'Nu du! ▶');
    stage.replaceChildren(
      h(
        'div',
        { class: 'intro-card' },
        h('p', { class: 'intro-label' }, '🌱 Ett nytt frö'),
        h('p', { class: 'prompt' }, q.item.prompt),
        arrayView(a, b),
        h('p', { class: 'array-caption' }, `${a} ${a === 1 ? 'rad' : 'rader'} med ${b} i varje`),
        strategy ? h('p', { class: 'strategy' }, strategy) : null,
        swap ? h('p', { class: 'strategy swap' }, `🔄 ${swap}`) : null,
        go,
      ),
    );
    go.focus();
    setKeys((e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        resolve();
      }
    });
  });
}

/** Multiple choice. Response time is measured but never shown. */
function ask(stage: HTMLElement, q: Question, setKeys: SetKeys): Promise<{ given: string; rtMs: number }> {
  return new Promise((resolve) => {
    let answered = false;
    const shownAt = performance.now();
    const choose = (value: string, button: HTMLButtonElement) => {
      if (answered) return;
      answered = true;
      button.classList.add('chosen');
      for (const b of buttons) b.disabled = true;
      resolve({ given: value, rtMs: Math.round(performance.now() - shownAt) });
    };
    const choices = q.choices ?? [];
    const buttons = choices.map((value, i) =>
      h(
        'button',
        {
          class: 'choice',
          type: 'button',
          dataset: { value },
          'aria-keyshortcuts': String(i + 1),
          onclick: (e: Event) => choose(value, e.currentTarget as HTMLButtonElement),
        },
        value,
      ),
    );
    stage.replaceChildren(
      h('div', { class: 'question' }, h('p', { class: 'prompt', 'aria-label': q.item.prompt.replace('×', 'gånger') }, q.item.prompt, ' = ?'), h('div', { class: 'choices' }, buttons)),
    );
    setKeys((e) => {
      const i = Number(e.key) - 1;
      const button = buttons[i];
      if (button) choose(choices[i] as string, button);
    });
  });
}

/** Correct: a short cheer. Wrong: never just "fel" — show the right answer and a way to think. */
async function showFeedback(stage: HTMLElement, q: Question, fb: Feedback, setKeys: SetKeys): Promise<void> {
  const buttons = [...stage.querySelectorAll<HTMLButtonElement>('.choice')];
  for (const b of buttons) {
    if (b.dataset.value === fb.expected) b.classList.add('correct');
    else if (b.dataset.value === fb.given) b.classList.add('wrong');
  }
  setKeys(undefined);
  if (fb.correct) {
    stage.querySelector('.question')?.classList.add('cheer');
    await wait(prefersReducedMotion() ? 300 : CORRECT_PAUSE_MS);
    return;
  }

  const { a, b } = parseFactId(q.item.id);
  const strategy = q.item.hints.find((x) => x.kind === 'strategy')?.text;
  await new Promise<void>((resolve) => {
    const next = h('button', { class: 'big-button', type: 'button', onclick: () => resolve() }, 'Fortsätt ▶');
    // The help card takes the place of the options so it fits on one screen.
    stage.querySelector('.choices')?.replaceWith(
      h(
        'div',
        { class: 'help-card' },
        h('p', { class: 'help-answer' }, `${q.item.prompt} = ${fb.expected}`),
        strategy ? h('p', { class: 'strategy' }, strategy) : null,
        arrayView(a, b, 'small'),
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
