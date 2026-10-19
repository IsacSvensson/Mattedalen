import { addDays, diffDays, systemClock, type DayKey } from '../engine';
import type { AppContext } from './app';
import { h } from './dom';
import { feedbackMailto } from './screens/parent/feedback';

/**
 * The app asks the grown-up how it is going (docs/PLAN-FRAGA.md): when "För
 * vuxna" is opened after five play days, then at most once a quarter while the
 * app is still in use. Everything is counted on the device; an answer opens a
 * mail the grown-up sends from their own mail app.
 */
export const ASK_KEY = 'askState';

/** Play days on the device before the first question, and new ones before the next. */
export const ASK_PLAY_DAYS = 5;
/** Days from one question to the next. */
export const ASK_EVERY_DAYS = 90;
/** "Inte nu" asks again after so many days, at most `ASK_SNOOZES` times; then the question waits a quarter. */
export const ASK_SNOOZE_DAYS = 7;
export const ASK_SNOOZES = 2;

export interface AskState {
  /** The day the question was last answered (or put off for a quarter). */
  lastDay?: DayKey;
  /** "Inte nu" since then, and the day it may ask again. */
  snoozes?: number;
  snoozedUntil?: DayKey;
  /** "Fråga inte igen". */
  never?: boolean;
}

/** Whether to ask today, from the days anyone played on the device. */
export function askDue(state: AskState, playDays: readonly DayKey[], today: DayKey): boolean {
  if (state.never) return false;
  if (state.snoozedUntil !== undefined && today < state.snoozedUntil) return false;
  if (state.lastDay === undefined) return playDays.length >= ASK_PLAY_DAYS;
  const since = playDays.filter((d) => d > state.lastDay!).length;
  return diffDays(state.lastDay, today) >= ASK_EVERY_DAYS && since >= ASK_PLAY_DAYS;
}

export type AskChoice = 'answered' | 'later' | 'never';

/** The state after the grown-up's choice. A third "Inte nu" waits for the next quarter. */
export function afterChoice(state: AskState, choice: AskChoice, today: DayKey): AskState {
  if (choice === 'never') return { ...state, never: true };
  const snoozes = state.snoozes ?? 0;
  if (choice === 'later' && snoozes < ASK_SNOOZES) return { ...state, snoozes: snoozes + 1, snoozedUntil: addDays(today, ASK_SNOOZE_DAYS) };
  return { lastDay: today, snoozes: 0 };
}

/** Days anyone played on this device, from the saved sessions. */
async function playDays(ctx: AppContext): Promise<DayKey[]> {
  const days = new Set<DayKey>();
  for (const p of await ctx.store.listProfiles()) for (const s of await ctx.store.listSessions(p.id)) if (s.answered > 0) days.add(s.day);
  return [...days].sort();
}

const stateOf = async (ctx: AppContext) => (await ctx.store.getSetting<AskState>(ASK_KEY)) ?? {};

/** Whether the question is due now (also for the row in "Att göra för dig"). */
export async function askIsDue(ctx: AppContext, today = systemClock.today()): Promise<boolean> {
  return askDue(await stateOf(ctx), await playDays(ctx), today);
}

/** The box, if the question is due: answering, "Inte nu" or "Fråga inte igen". True when a choice was made. */
export async function askIfDue(ctx: AppContext): Promise<boolean> {
  return (await askIsDue(ctx)) && askNow(ctx);
}

/** The box "Hur går det med Mattedalen?". Closing it without a choice changes nothing; true when a choice was made. */
export async function askNow(ctx: AppContext): Promise<boolean> {
  const choice = await askBox();
  if (choice) await ctx.store.setSetting(ASK_KEY, afterChoice(await stateOf(ctx), choice, systemClock.today()));
  return choice !== null;
}

const ANSWERS = ['Bra', 'Så där', 'Inte bra'] as const;

function askBox(): Promise<AskChoice | null> {
  return new Promise((resolve) => {
    const close = (choice: AskChoice | null) => {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(choice);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(null);
    };
    // Real links: the mail opens in the grown-up's own mail app, with the answer at the top.
    const answers = ANSWERS.map((a) => h('a', { class: 'soft-button', href: feedbackMailto(undefined, a), onclick: () => close('answered') }, a));
    const overlay = h(
      'div',
      { class: 'modal-overlay', onclick: (e: Event) => e.target === overlay && close(null) },
      h(
        'div',
        { class: 'modal ask-box', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ask-title' },
        h('h2', { id: 'ask-title' }, 'Hur går det med Mattedalen?'),
        h('p', null, 'Appen spårar ingenting, så det du berättar är det enda vi får veta. Ett tryck öppnar ett mejl som du skickar själv.'),
        h('div', { class: 'ask-answers' }, answers),
        h(
          'div',
          { class: 'modal-buttons' },
          h('button', { class: 'link-button', type: 'button', onclick: () => close('later') }, 'Inte nu'),
          h('button', { class: 'link-button', type: 'button', onclick: () => close('never') }, 'Fråga inte igen'),
        ),
      ),
    );
    document.addEventListener('keydown', onKey);
    document.body.append(overlay);
    answers[0]?.focus({ preventScroll: true });
  });
}
