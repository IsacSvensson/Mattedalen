import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import type { MinusAfter } from '../../src/content/addition';
import { AVERAGE, SLOW, WEAK, type LearnerProfile } from './learner';
import { simulateValley } from './valley';

/**
 * Plus first at the brook (docs/PLAN-PLUSFORST.md, C1): the whole valley with
 * minus facts as before, waiting for the first plus fact of their family, or
 * for both. It shows what waiting costs in time, not what it gives: the
 * simulated child does not read minus as plus. Not part of the normal test run:
 *
 *   PLUSFORST_REPORT=1 npx vitest run tests/simulation/plusforstReport.test.ts
 *
 * The table goes to VALLEY_OUT (default `tests/simulation/out`, not committed).
 */
const ON = process.env.PLUSFORST_REPORT;
const OUT = process.env.VALLEY_OUT ?? join(__dirname, 'out');
const SEEDS = Number(process.env.VALLEY_SEEDS ?? 8);
const WEEKS = 26;

const PROFILES: LearnerProfile[] = [AVERAGE, WEAK, SLOW];
const VARIANTS: { id: MinusAfter; title: string }[] = [
  { id: 'none', title: 'Som förut' },
  { id: 'first', title: 'Efter första plus' },
  { id: 'family', title: 'Efter familjens plus' },
];

const week = (day: number | null | undefined) => (day === null || day === undefined ? null : Math.floor(day / 7));

/** "12 (10–15)": the median and the range over the seeds; "–" when it never happened. */
function spread(values: (number | null)[], format = (n: number) => String(n)): string {
  const got = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (!got.length) return '–';
  const median = got[Math.floor((got.length - 1) / 2)]!;
  const range = format(got[0]!) === format(got.at(-1)!) ? '' : ` (${format(got[0]!)}–${format(got.at(-1)!)})`;
  const missing = got.length < values.length ? ` [${values.length - got.length} aldrig]` : '';
  return `${format(median)}${range}${missing}`;
}
const pct = (n: number) => `${Math.round(100 * n)} %`;

describe.skipIf(!ON)('the plus-first report', () => {
  it('runs', { timeout: 3_600_000 }, () => {
    mkdirSync(OUT, { recursive: true });
    const lines = ['# Plus först vid bäcken (C1)', '', `${SEEDS} frön, ${WEEKS} veckor. Median (min–max).`, ''];
    for (const profile of PROFILES) {
      const runs = VARIANTS.map((v) => Array.from({ length: SEEDS }, (_, seed) => simulateValley({ profile, seed, weeks: WEEKS, path: true, minusAfter: v.id })));
      const row = (title: string, f: (r: ReturnType<typeof simulateValley>) => number | null, format?: (n: number) => string) =>
        `| ${title} | ${runs.map((rs) => spread(rs.map(f), format)).join(' | ')} |`;
      lines.push(
        `## Elev: ${profile.name}`,
        '',
        `| | ${VARIANTS.map((v) => v.title).join(' | ')} |`,
        `|---|${VARIANTS.map(() => '---').join('|')}|`,
        row('Trädgården öppnar, vecka', (r) => week(r.openDay.multiplication)),
        row('Stigen öppnar, vecka', (r) => week(r.openDay.hundred)),
        row('Över tiotalet sitter, vecka', (r) => week(r.sitDay['addition:overtio'])),
        row('Plus sitter, vecka 4', (r) => r.brookWeekly[3]!.plus, pct),
        row('Minus sitter, vecka 4', (r) => r.brookWeekly[3]!.minus, pct),
        row('Minus sitter, vecka 8', (r) => r.brookWeekly[7]!.minus, pct),
        row('Minus sitter, vecka 26', (r) => r.brookWeekly[WEEKS - 1]!.minus, pct),
        row('Minus som väntar på plus, vecka 2', (r) => r.brookWeekly[1]!.waiting),
        row('Minus som väntar på plus, vecka 8', (r) => r.brookWeekly[7]!.waiting),
        row('Gånger sitter, vecka 26', (r) => r.timesSit(WEEKS), pct),
        row('Rätt svar', (r) => r.correct / r.answered, pct),
        '',
      );
    }
    writeFileSync(join(OUT, 'plusforst.md'), lines.join('\n'));
  });
});
