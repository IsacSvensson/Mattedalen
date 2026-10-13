import { buildChoices, mathRandomRng, systemClock, type FocusSet } from '../../engine';
import type { Profile } from '../../storage';
import { show, type AppContext } from '../app';
import { numPad } from '../components/numPad';
import { h, wait } from '../dom';
import { bestChallengeScore, CHALLENGE_SECONDS, challengeDeck, challengePool } from '../challenge';
import { engineFor, loadProgress } from '../play';
import { speak, speechSupported, stopSpeaking } from '../speech';
import { showGarden } from './garden';

/**
 * "Slå ditt rekord": optional, short and timed, only with facts the child
 * already knows. The only comparison is with the child's own best score.
 */
export async function showChallenge(ctx: AppContext, profile: Profile, focus?: FocusSet): Promise<void> {
  const record = bestChallengeScore(await ctx.store.listSessions(profile.id), focus?.id);
  const view = h(
    'main',
    { class: 'screen challenge' },
    h('header', { class: 'top-bar' }, h('button', { class: 'icon-button', type: 'button', 'aria-label': 'Tillbaka till trädgården', onclick: () => void showGarden(ctx, profile) }, '🏡')),
    h('p', { class: 'end-icon', 'aria-hidden': 'true' }, '⚡'),
    h('h1', null, focus ? `Slå ditt rekord på ${focus.title}` : 'Slå ditt rekord'),
    h('p', { class: 'end-text' }, `Svara på så många du kan på ${CHALLENGE_SECONDS} sekunder. Bara sådant du redan kan!`),
    h('p', { class: 'record' }, record === null ? 'Första gången – sätt ett rekord!' : `Ditt rekord: ${record}`),
    h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void runChallenge(ctx, profile, record, focus) }, 'Kör! ▶'),
  );
  show(ctx, view);
}

async function runChallenge(ctx: AppContext, profile: Profile, record: number | null, focus?: FocusSet): Promise<void> {
  const engine = engineFor(profile, ctx.deps);
  const { states } = await loadProgress(profile, ctx.deps, engine);
  const pool = challengePool(states, focus?.itemIds);
  const next = challengeDeck(pool, mathRandomRng);
  const free = profile.settings.allowFree;
  const voice = profile.settings.readAloud && speechSupported();
  const startedAt = systemClock.now();
  const endsAt = performance.now() + CHALLENGE_SECONDS * 1000;
  let score = 0;
  let answered = 0;
  let over = false;
  let onKey: ((e: KeyboardEvent) => void) | undefined;

  const bar = h('div', { class: 'time-bar', role: 'progressbar', 'aria-label': 'Tid kvar', 'aria-valuemin': 0, 'aria-valuemax': CHALLENGE_SECONDS });
  const scoreEl = h('p', { class: 'challenge-score', 'aria-live': 'polite' }, '0');
  const stage = h('section', { class: 'play-stage' });
  const view = h(
    'main',
    { class: 'screen session challenge-run' },
    h('header', { class: 'top-bar' }, h('button', { class: 'icon-button', type: 'button', 'aria-label': 'Avbryt', onclick: () => void stop(true) }, '🏡'), h('div', { class: 'time-track' }, bar), scoreEl),
    stage,
  );
  const setKey = (handler?: (e: KeyboardEvent) => void) => {
    if (onKey) document.removeEventListener('keydown', onKey);
    onKey = handler;
    if (handler) document.addEventListener('keydown', handler);
  };
  show(ctx, view, () => {
    setKey(undefined);
    stopSpeaking();
  });

  const tick = () => {
    if (over) return;
    const left = Math.max(0, endsAt - performance.now());
    bar.style.width = `${(left / (CHALLENGE_SECONDS * 1000)) * 100}%`;
    bar.setAttribute('aria-valuenow', String(Math.ceil(left / 1000)));
    if (left <= 0) void stop(false);
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  async function stop(aborted: boolean) {
    if (over) return;
    over = true;
    setKey(undefined);
    if (aborted) return showGarden(ctx, profile);
    if (answered > 0) {
      await ctx.store.saveSession({
        id: crypto.randomUUID(),
        profileId: profile.id,
        packId: ctx.pack.id,
        mode: 'challenge',
        day: systemClock.today(),
        startedAt,
        endedAt: systemClock.now(),
        answered,
        correct: score,
        introduced: [],
        ...(focus ? { focusId: focus.id } : {}),
        extra: { score },
      });
    }
    showChallengeResult(ctx, profile, score, record, focus);
  }

  while (!over) {
    const item = engine.item(next());
    if (voice) void speak(item.prompt);
    const given = await new Promise<string | null>((resolve) => {
      const finishRace = setInterval(() => over && (clearInterval(finishRace), resolve(null)), 100);
      const submit = (value: string) => {
        clearInterval(finishRace);
        resolve(value);
      };
      const prompt = h('p', { class: 'prompt' }, item.prompt, ' = ?');
      if (free) {
        const pad = numPad((v) => {
          pad.disable();
          submit(v);
        });
        stage.replaceChildren(h('div', { class: 'question free' }, prompt, pad.el));
        setKey((e) => pad.onKey(e));
      } else {
        const choices = buildChoices(ctx.pack, item, states[item.id], mathRandomRng, 4);
        const buttons = choices.map((v) => h('button', { class: 'choice', type: 'button', dataset: { value: v }, onclick: () => submit(v) }, v));
        stage.replaceChildren(h('div', { class: 'question' }, prompt, h('div', { class: 'choices' }, buttons)));
        setKey((e) => {
          const v = choices[Number(e.key) - 1];
          if (v) submit(v);
        });
      }
    });
    if (given === null || over) break;
    answered++;
    if (ctx.pack.normalizeAnswer(given) === item.answer) {
      score++;
      scoreEl.textContent = String(score);
      scoreEl.classList.remove('bump');
      void scoreEl.getBoundingClientRect();
      scoreEl.classList.add('bump');
    } else {
      // No penalty: just the right answer for a moment.
      stage.replaceChildren(h('p', { class: 'help-answer challenge-correction' }, `${item.prompt} = ${item.answer}`));
      await wait(900);
    }
  }
}

function showChallengeResult(ctx: AppContext, profile: Profile, score: number, record: number | null, focus?: FocusSet): void {
  const newRecord = score > 0 && (record === null || score > record);
  const view = h(
    'main',
    { class: 'screen session-end' },
    h('p', { class: 'end-icon', 'aria-hidden': 'true' }, newRecord ? '🏆' : '⚡'),
    h('h1', null, `${score} rätt!`),
    h(
      'p',
      { class: 'end-text' },
      newRecord ? (record === null ? 'Ditt första rekord!' : `Nytt rekord! Förra var ${record}.`) : `Ditt rekord är ${record ?? 0}. Bra kämpat!`,
    ),
    h(
      'div',
      { class: 'garden-actions' },
      h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void showChallenge(ctx, profile, focus) }, 'Igen'),
      h('button', { class: 'soft-button', type: 'button', onclick: () => void showGarden(ctx, profile) }, 'Till trädgården'),
    ),
  );
  show(ctx, view);
}
