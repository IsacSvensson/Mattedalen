import type { Feedback, Question } from '../../engine';
import { confusionNote, parseFactId } from '../../content/multiplication';
import type { Profile } from '../../storage';
import { show, type AppContext } from '../app';
import { arrayBuilder } from '../components/arrayBuilder';
import { arrayView, partsOf } from '../components/arrayView';
import { numPad } from '../components/numPad';
import { h, prefersReducedMotion, wait } from '../dom';
import { PlayController } from '../play';
import { speak, speechSupported, stopSpeaking } from '../speech';
import { showGarden } from './garden';
import { showSessionEnd } from './sessionEnd';

/** Pause after a correct answer before the next question. */
const CORRECT_PAUSE_MS = 650;

/** Read questions aloud in this session (profile setting, if the device can speak). */
let voiceOn = false;

export async function showSession(ctx: AppContext, profile: Profile, mode: 'daily' | 'extra'): Promise<void> {
  const play = await PlayController.start(profile, ctx.deps, mode);
  voiceOn = profile.settings.readAloud && speechSupported();
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

/**
 * A new fact: the child builds it as a rectangle of dots (or turns the known
 * mirrored fact around) and sees how it splits into known parts. Then they
 * answer it themselves.
 */
function introduce(stage: HTMLElement, q: Question, setKeys: SetKeys): Promise<void> {
  const { a, b } = parseFactId(q.item.id);
  const strategy = q.item.hints.find((x) => x.kind === 'strategy')?.text;
  const swap = q.pairKnown ? q.item.hints.find((x) => x.kind === 'swap')?.text : undefined;
  return new Promise((resolve) => {
    const go = h('button', { class: 'big-button', type: 'button', onclick: () => resolve() }, 'Nu du! ▶');
    const after = h('div', { class: 'intro-after', hidden: true }, strategy ? h('p', { class: 'strategy' }, strategy) : null, swap ? h('p', { class: 'strategy swap' }, `🔄 ${swap}`) : null, go);
    const builder = arrayBuilder({
      rows: a,
      cols: b,
      parts: partsOf(q.item.hints),
      startRotated: q.pairKnown,
      onDone: () => {
        after.hidden = false;
        go.focus();
        setKeys((e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            resolve();
          }
        });
      },
    });
    if (voiceOn) void speak(`Ett nytt frö. ${q.item.prompt}`);
    stage.replaceChildren(
      h('div', { class: 'intro-card' }, h('p', { class: 'intro-label' }, '🌱 Ett nytt frö'), h('p', { class: 'prompt' }, q.item.prompt), builder, after),
    );
    setKeys(undefined);
  });
}

/** Multiple choice or free answer on a number pad. Response time is measured but never shown. */
function ask(stage: HTMLElement, q: Question, setKeys: SetKeys): Promise<{ given: string; rtMs: number }> {
  return new Promise((resolve) => {
    let answered = false;
    let shownAt = performance.now();
    if (voiceOn) {
      // Time the answer from when the question has been heard, not while it is read.
      void speak(q.item.prompt).then(() => {
        if (!answered) shownAt = performance.now();
      });
    }
    const done = (value: string) => {
      if (answered) return false;
      answered = true;
      resolve({ given: value, rtMs: Math.round(performance.now() - shownAt) });
      return true;
    };
    const prompt = h(
      'div',
      { class: 'prompt-row' },
      h('p', { class: 'prompt', 'aria-label': `${q.item.prompt.replace('×', 'gånger')} är lika med?` }, q.item.prompt, ' = ?'),
      voiceOn ? h('button', { class: 'icon-button speak-button', type: 'button', 'aria-label': 'Läs upp igen', onclick: () => void speak(q.item.prompt) }, '🔊') : null,
    );

    if (q.format === 'free') {
      const pad = numPad((value) => {
        if (done(value)) pad.disable();
      });
      stage.replaceChildren(h('div', { class: 'question free' }, prompt, pad.el));
      setKeys((e) => pad.onKey(e));
      return;
    }

    const choices = q.choices ?? [];
    const choose = (value: string, button: HTMLButtonElement) => {
      if (!done(value)) return;
      button.classList.add('chosen');
      for (const b of buttons) b.disabled = true;
    };
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
    stage.replaceChildren(h('div', { class: 'question' }, prompt, h('div', { class: 'answer-area choices' }, buttons)));
    setKeys((e) => {
      const i = Number(e.key) - 1;
      const button = buttons[i];
      if (button) choose(choices[i] as string, button);
    });
  });
}

/** Correct: a short cheer. Wrong: never just "fel" — show the right answer and a way to think. */
async function showFeedback(stage: HTMLElement, q: Question, fb: Feedback, setKeys: SetKeys): Promise<void> {
  for (const b of stage.querySelectorAll<HTMLButtonElement>('.choice')) {
    if (b.dataset.value === fb.expected) b.classList.add('correct');
    else if (b.dataset.value === fb.given) b.classList.add('wrong');
  }
  stage.querySelector('.numpad-display')?.classList.add(fb.correct ? 'correct' : 'wrong');
  setKeys(undefined);
  if (fb.correct) {
    stage.querySelector('.question')?.classList.add('cheer');
    await wait(prefersReducedMotion() ? 300 : CORRECT_PAUSE_MS);
    return;
  }

  const { a, b } = parseFactId(q.item.id);
  const strategy = q.item.hints.find((x) => x.kind === 'strategy')?.text;
  const note = confusionNote(a, b, fb.given);
  if (voiceOn) void speak(`${q.item.prompt} = ${fb.expected}`);
  await new Promise<void>((resolve) => {
    const next = h('button', { class: 'big-button', type: 'button', onclick: () => resolve() }, 'Fortsätt ▶');
    // The help card takes the place of the answer area so it fits on one screen.
    stage.querySelector('.choices, .numpad')?.replaceWith(
      h(
        'div',
        { class: 'help-card' },
        h('p', { class: 'help-answer' }, `${q.item.prompt} = ${fb.expected}`),
        note ? h('p', { class: 'confusion-note' }, note) : null,
        strategy ? h('p', { class: 'strategy' }, strategy) : null,
        arrayView(a, b, { size: 'small', parts: partsOf(q.item.hints) }),
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
