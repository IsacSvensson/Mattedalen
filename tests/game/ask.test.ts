import { describe, expect, it } from 'vitest';
import { addDays } from '../../src/engine';
import { afterChoice, askDue, type AskState } from '../../src/shell/ask';
import { feedbackMailto } from '../../src/shell/screens/parent/feedback';

const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i));

describe('the app asks how it is going (docs/PLAN-FRAGA.md)', () => {
  it('asks first after five play days', () => {
    expect(askDue({}, days('2026-10-01', 4), '2026-10-10')).toBe(false);
    expect(askDue({}, days('2026-10-01', 5), '2026-10-10')).toBe(true);
  });

  it('asks again after a quarter, and only if the app is still in use', () => {
    const answered: AskState = { lastDay: '2026-10-10' };
    const before = days('2026-10-01', 9);
    expect(askDue(answered, [...before, ...days('2026-10-11', 10)], '2026-12-31')).toBe(false);
    expect(askDue(answered, [...before, ...days('2026-10-11', 10)], '2027-01-08')).toBe(true);
    expect(askDue(answered, [...before, ...days('2026-10-11', 4)], '2027-03-01')).toBe(false);
  });

  it('"Inte nu" asks again after a week, twice; then the question waits a quarter', () => {
    const played = days('2026-10-01', 5);
    let s = afterChoice({}, 'later', '2026-10-10');
    expect(askDue(s, played, '2026-10-16')).toBe(false);
    expect(askDue(s, played, '2026-10-17')).toBe(true);
    s = afterChoice(s, 'later', '2026-10-17');
    expect(askDue(s, played, '2026-10-24')).toBe(true);
    s = afterChoice(s, 'later', '2026-10-24');
    expect(s).toEqual({ lastDay: '2026-10-24', snoozes: 0 });
    expect(askDue(s, played, '2026-11-24')).toBe(false);
  });

  it('"Fråga inte igen" never asks again, and an answer waits a quarter', () => {
    const played = days('2026-10-01', 200);
    expect(askDue(afterChoice({}, 'never', '2026-10-10'), played, '2027-10-10')).toBe(false);
    expect(afterChoice({ snoozes: 1, snoozedUntil: '2026-10-17' }, 'answered', '2026-10-12')).toEqual({ lastDay: '2026-10-12', snoozes: 0 });
  });

  it('the mail carries the answer at the top', () => {
    const body = decodeURIComponent(new URL(feedbackMailto('v1', 'Så där')).searchParams.get('body')!);
    expect(body.split('\n')[0]).toBe('Hur går det? Så där');
    expect(body).toContain('Appens version: v1');
  });
});
