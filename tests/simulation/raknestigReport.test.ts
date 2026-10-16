import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import { AVERAGE, SLOW, STRONG, WEAK, type LearnerProfile } from './learner';
import { simulateValley } from './valley';

/**
 * Räknestig after what the child knows (docs/PLAN-RAKNESTIG.md, S3b): the whole
 * valley with one way per garden fact, as before, and with several. The child is
 * the same in both: only the help the game can give differs. Not part of the
 * normal test run. One profile per process, then a summary:
 *
 *   RAKNESTIG_REPORT=svag npx vitest run tests/simulation/raknestigReport.test.ts   (and genomsnittlig, stark, långsam)
 *   RAKNESTIG_REPORT=summary npx vitest run tests/simulation/raknestigReport.test.ts
 *
 * Results go to VALLEY_OUT (default `tests/simulation/out`, not committed).
 */
const MODE = process.env.RAKNESTIG_REPORT;
const OUT = process.env.VALLEY_OUT ?? join(__dirname, 'out');
const SEEDS = Number(process.env.VALLEY_SEEDS ?? 10);
const WEEKS = 52;

const PROFILES: LearnerProfile[] = [WEAK, AVERAGE, STRONG, SLOW];
const WAYS = [
  { id: 'one', title: 'En väg (förut)' },
  { id: 'all', title: 'Flera vägar' },
] as const;

interface Run {
  derives: number;
  /** Of the hard facts over the weeks, the share without a way the child knows. */
  noWay: number | null;
  /** Of the hard facts, the share that has no way at all. */
  noPath: number | null;
  hardWeeks: number;
  sit26: number;
  sit52: number;
  correct: number;
}

function run(profile: LearnerProfile, ways: 'one' | 'all', seed: number): Run {
  const r = simulateValley({ profile, seed, weeks: WEEKS, path: true, ways, ...(profile === SLOW ? { status: { fluentRtMs: 10_000, automaticRtMs: 8000 } } : {}) });
  const hard = r.weekly.reduce((n, w) => n + w.hard, 0);
  return {
    derives: r.weekly.reduce((n, w) => n + w.derives, 0),
    noWay: hard ? r.weekly.reduce((n, w) => n + w.hardNoWay, 0) / hard : null,
    noPath: hard ? r.weekly.reduce((n, w) => n + w.hardNoPath, 0) / hard : null,
    hardWeeks: hard,
    sit26: r.weekly[25]!.sit,
    sit52: r.weekly[51]!.sit,
    correct: r.correct / r.answered,
  };
}

function spread(values: (number | null)[], format = (n: number) => String(n)): string {
  const got = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (!got.length) return '–';
  const median = got[Math.floor((got.length - 1) / 2)]!;
  const range = format(got[0]!) === format(got.at(-1)!) ? '' : ` (${format(got[0]!)}–${format(got.at(-1)!)})`;
  return `${format(median)}${range}`;
}
const pct = (n: number) => `${Math.round(100 * n)} %`;
const fileOf = (profile: LearnerProfile) => join(OUT, `raknestig-${profile.name.replace(/ /g, '-')}.json`);

describe.skipIf(!MODE)('the räknestig report', () => {
  it('runs or sums up', { timeout: 3_600_000 }, () => {
    mkdirSync(OUT, { recursive: true });
    if (MODE !== 'summary') {
      const profile = PROFILES.find((p) => p.name === MODE);
      if (!profile) throw new Error(`Unknown profile ${MODE}`);
      const results = Object.fromEntries(WAYS.map((w) => [w.id, Array.from({ length: SEEDS }, (_, i) => run(profile, w.id, i + 1))]));
      writeFileSync(fileOf(profile), JSON.stringify(results));
      return;
    }
    const lines: string[] = [`# Räknestig efter det barnet kan: ${SEEDS} slumpfrön per elev, ${WEEKS} veckor`, '', 'Det långsamma barnet har ”Ge mer tid”.', ''];
    for (const profile of PROFILES) {
      const all: Record<string, Run[]> = JSON.parse(readFileSync(fileOf(profile), 'utf8'));
      lines.push(`## ${profile.name}`, '', '| | ' + WAYS.map((w) => w.title).join(' | ') + ' |', '|---|' + WAYS.map(() => '---').join('|') + '|');
      const row = (title: string, f: (r: Run) => number | null, format?: (n: number) => string) =>
        lines.push(`| ${title} | ${WAYS.map((w) => spread(all[w.id]!.map(f), format)).join(' | ')} |`);
      row('Räknestigar i trädgården på ett år', (r) => r.derives);
      row('Svåra fakta utan någon väg barnet kan', (r) => r.noWay, pct);
      row('… varav fakta som inte har någon väg (×1, ×2, ×10)', (r) => r.noPath, pct);
      row('… varav fakta där barnet inte kan stegen än', (r) => (r.noWay === null || r.noPath === null ? null : r.noWay - r.noPath), pct);
      row('Svåra fakta, summa över veckorna', (r) => r.hardWeeks);
      row('Gånger: buske eller träd, vecka 26', (r) => r.sit26, pct);
      row('Gånger: buske eller träd, vecka 52', (r) => r.sit52, pct);
      row('Rätt svar', (r) => r.correct, pct);
      lines.push('');
    }
    writeFileSync(join(OUT, 'raknestig.md'), lines.join('\n'));
    console.log(lines.join('\n'));
  });
});
