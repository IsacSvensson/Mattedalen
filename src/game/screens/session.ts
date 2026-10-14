import type { Feedback, FocusSet, Question, SessionMode } from '../../engine';
import { confusionNote, parseFactId } from '../../content/multiplication';
import type { Profile } from '../../storage';
import { show, type AppContext } from '../app';
import { arrayBuilder } from '../components/arrayBuilder';
import { arrayView, partsOf } from '../components/arrayView';
import { icon } from '../components/icons';
import { plantIcon } from '../components/plant';
import { scene } from '../components/scene';
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
/** The prompt on screen, for the "read again" button in the top band. */
let currentPrompt = '';

/** Drops in the top band: they fill up as the session's time passes (no clock, no count). */
const DROPS = 12;

export async function showSession(ctx: AppContext, profile: Profile, mode: SessionMode, focus?: FocusSet): Promise<void> {
  const play = await PlayController.start(profile, ctx.deps, mode, focus);
  voiceOn = profile.settings.readAloud && speechSupported();
  const stage = h('section', { class: 'play-stage', 'aria-live': 'polite' });
  let keyHandler: ((e: KeyboardEvent) => void) | undefined;
  let finished = false;

  const finish = async (early: boolean) => {
    if (finished) return;
    finished = true;
    const summary = await play.finish();
    if (early || summary.answered === 0) await showGarden(ctx, profile, new Set(summary.promoted));
    else showSessionEnd(ctx, profile, summary, play.focus);
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
    { class: `screen session has-scene mode-${mode}` },
    h(
      'header',
      { class: 'play-head' },
      scene({ height: 92, sun: false, cloud: false }),
      h(
        'div',
        { class: 'scene-controls' },
        h('button', { class: 'icon-button', type: 'button', 'aria-label': 'Tillbaka till trädgården', onclick: () => void finish(true) }, icon('home')),
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
    if (q.kind === 'new') await introduce(stage, q, setKeys);
    if (finished) return;
    const { given, rtMs } = await ask(stage, q, setKeys);
    if (finished) return;
    const fb = await play.answer(given, rtMs);
    updateProgress();
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
    const go = h('button', { class: 'big-button', type: 'button', onclick: () => resolve() }, 'Nu du!', icon('arrow', 'on-primary'));
    const after = h(
      'div',
      { class: 'intro-after', hidden: true },
      strategy ? h('p', { class: 'strategy' }, strategy) : null,
      swap ? h('p', { class: 'strategy swap' }, icon('rotate'), swap) : null,
      go,
    );
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
    currentPrompt = q.item.prompt;
    if (voiceOn) void speak(`Ett nytt frö. ${q.item.prompt}`);
    stage.replaceChildren(
      h(
        'div',
        { class: 'intro-card card' },
        h('p', { class: 'intro-label' }, plantIcon('seed'), 'Ett nytt frö'),
        h('p', { class: 'prompt' }, q.item.prompt),
        builder,
        after,
      ),
    );
    setKeys(undefined);
  });
}

/** Multiple choice or free answer on a number pad. Response time is measured but never shown. */
function ask(stage: HTMLElement, q: Question, setKeys: SetKeys): Promise<{ given: string; rtMs: number }> {
  return new Promise((resolve) => {
    let answered = false;
    let shownAt = performance.now();
    currentPrompt = q.item.prompt;
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
      { class: 'prompt-card card' },
      h('p', { class: 'prompt', 'aria-label': `${q.item.prompt.replace('×', 'gånger')} är lika med?` }, q.item.prompt),
      q.format === 'free' ? null : h('p', { class: 'eq', 'aria-hidden': 'true' }, '= ?'),
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
    const card = stage.querySelector('.prompt-card');
    card?.classList.add('is-right');
    const eq = card?.querySelector('.eq');
    if (eq) eq.textContent = `= ${fb.expected}`;
    card?.append(h('span', { class: 'cheer-plant', 'aria-hidden': 'true' }, plantIcon('sprout')));
    await wait(prefersReducedMotion() ? 300 : CORRECT_PAUSE_MS);
    return;
  }

  const { a, b } = parseFactId(q.item.id);
  const strategy = q.item.hints.find((x) => x.kind === 'strategy')?.text;
  const note = confusionNote(a, b, fb.given);
  if (voiceOn) void speak(`${q.item.prompt} = ${fb.expected}`);
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
          h('p', { class: 'you-said' }, fb.given ? `Du svarade ${fb.given}.` : 'Inget svar den här gången.', strategy ? ' Så här kan du tänka:' : ''),
          h('p', { class: 'help-answer' }, `${q.item.prompt} = ${fb.expected}`),
          note ? h('p', { class: 'confusion-note' }, note) : null,
          strategy ? h('p', { class: 'strategy' }, strategy) : null,
          arrayView(a, b, { size: 'small', parts: partsOf(q.item.hints) }),
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
