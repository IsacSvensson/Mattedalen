import { buildChoices, mathRandomRng, systemClock } from '../../../engine';
import { factId, formatFact, isFactId, parseFactId } from '../../../content/multiplication';
import type { Profile } from '../../../storage';
import { show, type AppContext } from '../../../shell/app';
import { numPad } from '../../../shell/components/numPad';
import { avatarIcon } from '../../../shell/components/avatars';
import { icon } from '../../../shell/components/icons';
import { h, type Child } from '../../../shell/dom';
import { drawRound, duelPool, DUEL_ROUNDS, roundWinner, scoreRound, type DuelCard, type DuelScore } from '../challenge';
import { engineFor, loadProgress } from '../../../shell/play';
import { hasSwedishVoice, speak, speechSupported, stopSpeaking } from '../../../shell/speech';
import { genitive, showGarden } from './garden';
import { gardenDeps, pack } from '../pack';
import { choiceKeys } from '../../../shell/components/choiceKeys';

const MIN_CARDS = 6;

/**
 * "Gångerkrig": a child and a grown-up on the same device, inspired by the
 * card game multiplication war. Both draw a fact from the child's known
 * facts and answer their own; the higher correct product takes the round.
 */
export async function showDuel(ctx: AppContext, profile: Profile): Promise<void> {
  const view = h(
    'main',
    { class: 'screen duel' },
    h('header', { class: 'top-bar' }, h('button', { class: 'icon-button', type: 'button', 'aria-label': 'Tillbaka till trädgården', onclick: () => void showGarden(ctx, profile) }, icon('home'))),
    h('div', { class: 'end-icon', 'aria-hidden': 'true' }, icon('cards')),
    h('h1', null, 'Gångerkrig'),
    h(
      'ol',
      { class: 'duel-rules' },
      h('li', null, `${profile.name} och en vuxen drar varsitt kort.`),
      h('li', null, 'Båda räknar ut sitt kort.'),
      h('li', null, 'Störst rätt svar vinner rundan. Lika? Då blir det krig – nästa runda är värd dubbelt!'),
    ),
    h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void runDuel(ctx, profile) }, 'Dra kort!', icon('arrow', 'on-primary')),
  );
  show(ctx, view);
}

async function runDuel(ctx: AppContext, profile: Profile): Promise<void> {
  const engine = engineFor(profile, gardenDeps(ctx));
  const { states } = await loadProgress(profile, gardenDeps(ctx), engine);
  let ids = duelPool(states);
  // Too few known facts: play with the first table (×2), which every child starts with.
  const firstTable = pack.units.find((u) => u.itemIds.some(isFactId))?.itemIds.filter(isFactId) ?? [];
  if (ids.length < MIN_CARDS) ids = [...new Set([...ids, ...firstTable])];
  const cards: DuelCard[] = ids.map(parseFactId);
  const voice = profile.settings.readAloud && speechSupported() && (await hasSwedishVoice());
  const startedAt = systemClock.now();
  let score: DuelScore = { child: 0, adult: 0, stake: 1 };
  let childCorrect = 0;
  let onKey: ((e: KeyboardEvent) => void) | undefined;
  let left = false;

  const stage = h('section', { class: 'play-stage duel-stage' });
  const board = h('p', { class: 'duel-score', 'aria-live': 'polite' });
  const renderScore = () => {
    board.replaceChildren(
      h('span', { class: 'avatar-badge small' }, avatarIcon(profile.avatar)),
      h('span', { class: 'sr-only' }, `${profile.name} `),
      `${score.child} – ${score.adult}`,
      h('span', { class: 'sr-only' }, ' vuxen'),
      h('span', { class: 'avatar-badge small' }, icon('grownup')),
    );
  };
  const view = h(
    'main',
    { class: 'screen session duel-run' },
    h('header', { class: 'top-bar' }, h('button', { class: 'icon-button', type: 'button', 'aria-label': 'Avsluta spelet', onclick: () => ((left = true), void showGarden(ctx, profile)) }, icon('home')), board),
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
  renderScore();

  for (let round = 1; round <= DUEL_ROUNDS && !left; round++) {
    const r = drawRound(cards, mathRandomRng);
    const childAnswer = await turn([h('span', { class: 'avatar-badge small' }, avatarIcon(profile.avatar)), `${genitive(profile.name)} tur`], r.child, 'child');
    if (left) return;
    const adultAnswer = await turn([h('span', { class: 'avatar-badge small' }, icon('grownup')), 'Den vuxnas tur'], r.adult, 'adult');
    if (left) return;
    const cOk = Number(childAnswer) === r.child.a * r.child.b;
    const aOk = Number(adultAnswer) === r.adult.a * r.adult.b;
    if (cOk) childCorrect++;
    const winner = roundWinner(r, cOk, aOk);
    const stake = score.stake;
    score = scoreRound(score, winner);
    renderScore();
    await reveal(round, r, cOk, aOk, winner, stake);
  }
  if (left) return;

  await ctx.store.saveSession({
    id: crypto.randomUUID(),
    profileId: profile.id,
    packId: pack.id,
    mode: 'duel',
    day: systemClock.today(),
    startedAt,
    endedAt: systemClock.now(),
    answered: DUEL_ROUNDS,
    correct: childCorrect,
    introduced: [],
    extra: { child: score.child, adult: score.adult },
  });
  showDuelResult(ctx, profile, score);

  /** One player answers their card: the child with options, the grown-up on the number pad. */
  function turn(title: Child[], card: DuelCard, who: 'child' | 'adult'): Promise<string> {
    const prompt = formatFact(card.a, card.b);
    if (voice && who === 'child') void speak(prompt);
    return new Promise((resolve) => {
      const head = [h('p', { class: `duel-turn ${who}` }, title), h('div', { class: 'duel-card', 'aria-label': `Kort: ${prompt}` }, prompt, ' = ?')];
      if (who === 'adult') {
        const pad = numPad((v) => {
          pad.disable();
          resolve(v);
        });
        stage.replaceChildren(h('div', { class: 'question free' }, head, pad.el));
        setKey((e) => pad.onKey(e));
        return;
      }
      const item = engine.item(factId(card.a, card.b));
      const choices = buildChoices(pack, item, states[item.id], mathRandomRng, 4);
      const buttons = choices.map((v) => h('button', { class: 'choice', type: 'button', onclick: () => resolve(v) }, v));
      stage.replaceChildren(h('div', { class: 'question' }, head, h('div', { class: 'choices' }, buttons)));
      const keys = choiceKeys(choices, (i) => resolve(choices[i]!));
      setKey((e) => keys.onKey(e));
    });
  }

  function reveal(round: number, r: { child: DuelCard; adult: DuelCard }, cOk: boolean, aOk: boolean, winner: string, stake: number): Promise<void> {
    setKey(undefined);
    const side = (who: 'child' | 'adult', card: DuelCard, ok: boolean) =>
      h(
        'div',
        { class: `duel-reveal ${who}${winner === who ? ' winner' : ''}` },
        h(
          'p',
          { class: 'duel-name' },
          h('span', { class: 'avatar-badge small' }, who === 'child' ? avatarIcon(profile.avatar) : icon('grownup')),
          who === 'child' ? profile.name : 'Vuxen',
        ),
        h('p', { class: 'duel-product' }, `${formatFact(card.a, card.b)} = ${card.a * card.b}`),
        h('p', { class: 'duel-mark' }, ok ? icon('check') : null, ok ? 'rätt' : 'inte rätt den här gången'),
      );
    const message =
      winner === 'tie'
        ? `Krig! Nästa runda är värd ${stake * 2} poäng.`
        : `${winner === 'child' ? profile.name : 'Den vuxna'} vinner rundan${stake > 1 ? ` och ${stake} poäng` : ''}!`;
    return new Promise((resolve) => {
      const next = h('button', { class: 'big-button', type: 'button', onclick: () => resolve() }, round < DUEL_ROUNDS ? 'Nästa runda' : 'Se resultatet', icon('arrow', 'on-primary'));
      stage.replaceChildren(
        h('div', { class: 'duel-result-round' }, h('p', { class: 'muted' }, `Runda ${round} av ${DUEL_ROUNDS}`), h('div', { class: 'duel-sides' }, side('child', r.child, cOk), side('adult', r.adult, aOk)), h('p', { class: 'duel-message' }, message), next),
      );
      next.focus();
      if (voice && winner === 'child') void speak(`${profile.name} vinner rundan!`);
    });
  }
}

function showDuelResult(ctx: AppContext, profile: Profile, score: DuelScore): void {
  const childWon = score.child > score.adult;
  const tie = score.child === score.adult;
  const view = h(
    'main',
    { class: 'screen session-end' },
    h('div', { class: 'end-icon', 'aria-hidden': 'true' }, icon(childWon ? 'trophy' : 'cards')),
    h('h1', null, childWon ? `${profile.name} vann!` : tie ? 'Oavgjort!' : 'Den vuxna vann den här gången!'),
    h('p', { class: 'end-text' }, `${score.child} – ${score.adult}`),
    h(
      'div',
      { class: 'garden-actions' },
      h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void showDuel(ctx, profile) }, 'Spela igen'),
      h('button', { class: 'soft-button', type: 'button', onclick: () => void showGarden(ctx, profile) }, 'Till trädgården'),
    ),
  );
  show(ctx, view);
}
