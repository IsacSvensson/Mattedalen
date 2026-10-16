import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import type { StatusConfig } from '../../src/engine';
import { AVERAGE, SLOW, STRONG, VERY_SLOW, WEAK, type LearnerProfile } from './learner';
import { simulateValley } from './valley';

/**
 * Time and slow children (docs/PLAN-GRANSKNING.md, S2): the whole valley with
 * the steps' rules as now, with more time for a bush, and with no time for a
 * bush (time only for a tree), and after the child's own speed. Not part of the normal test run. One profile
 * per process, then a summary:
 *
 *   TIME_REPORT=svag npx vitest run tests/simulation/timeReport.test.ts   (and genomsnittlig, stark, långsam, "mycket långsam")
 *   TIME_REPORT=summary npx vitest run tests/simulation/timeReport.test.ts
 *
 * Results go to VALLEY_OUT (default `tests/simulation/out`, not committed).
 */
const MODE = process.env.TIME_REPORT;
const OUT = process.env.VALLEY_OUT ?? join(__dirname, 'out');
const SEEDS = Number(process.env.VALLEY_SEEDS ?? 10);
const WEEKS = 52;

const PROFILES: LearnerProfile[] = [WEAK, AVERAGE, STRONG, SLOW, VERY_SLOW];
/**
 * `own`: the limits follow the child's own speed on what it already knows
 * (`knownRtMs`, the first two weeks), never below today's: a bush under twice
 * that (or 1.6 times), a tree under 1.3 times it.
 */
function own(factor: number) {
  return (known: number): Partial<StatusConfig> => ({
    fluentRtMs: Math.max(5000, Math.round(factor * known)),
    automaticRtMs: Math.max(3000, Math.round(1.3 * known)),
  });
}

const RULES: { id: string; title: string; status?: (knownRtMs: number) => Partial<StatusConfig> }[] = [
  { id: 'now', title: 'Som nu (buske under 5 s)' },
  { id: 'ten', title: 'Buske under 10 s', status: () => ({ fluentRtMs: 10_000 }) },
  { id: 'free', title: 'Buske utan tid', status: () => ({ fluentRtMs: Number.MAX_SAFE_INTEGER }) },
  { id: 'own', title: 'Egen fart × 2', status: own(2) },
  { id: 'own16', title: 'Egen fart × 1,6', status: own(1.6) },
];
const CHECKPOINTS = [8, 13, 26, 52];

interface Run {
  gardenOpens: number | null;
  pathOpens: number | null;
  correct: number;
  weekly: ReturnType<typeof simulateValley>['weekly'];
  overtio: number | null;
  knownRtMs: number | null;
}

const week = (day: number | null | undefined) => (day === null || day === undefined ? null : Math.floor(day / 7));

function run(profile: LearnerProfile, rules: (typeof RULES)[number], seed: number): Run {
  // The child's own speed comes from its first two weeks, which today's rules do not change.
  const known = simulateValley({ profile, seed, weeks: 2, path: true }).knownRtMs ?? 0;
  const r = simulateValley({ profile, seed, weeks: WEEKS, path: true, status: rules.status?.(known) });
  return {
    gardenOpens: week(r.openDay.multiplication),
    pathOpens: week(r.openDay.hundred),
    correct: r.correct / r.answered,
    weekly: r.weekly,
    overtio: week(r.sitDay['addition:overtio']),
    knownRtMs: known,
  };
}

/** "12 (10–15)": the median and the range over the seeds; "–" for runs where it never happened. */
function spread(values: (number | null)[], format = (n: number) => String(n)): string {
  const got = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (!got.length) return '–';
  const median = got[Math.floor((got.length - 1) / 2)]!;
  const range = format(got[0]!) === format(got.at(-1)!) ? '' : ` (${format(got[0]!)}–${format(got.at(-1)!)})`;
  const missing = got.length < values.length ? ` [${values.length - got.length} aldrig]` : '';
  return `${format(median)}${range}${missing}`;
}
const pct = (n: number) => `${Math.round(100 * n)} %`;
const sec = (n: number) => `${(n / 1000).toFixed(1)} s`;
const fileOf = (profile: LearnerProfile) => join(OUT, `tid-${profile.name.replace(/ /g, '-')}.json`);

describe.skipIf(!MODE)('the time report', () => {
  it('runs or sums up', { timeout: 3_600_000 }, () => {
    mkdirSync(OUT, { recursive: true });
    if (MODE !== 'summary') {
      const profile = PROFILES.find((p) => p.name === MODE);
      if (!profile) throw new Error(`Unknown profile ${MODE}`);
      const results = Object.fromEntries(RULES.map((v) => [v.id, Array.from({ length: SEEDS }, (_, i) => run(profile, v, i + 1))]));
      writeFileSync(fileOf(profile), JSON.stringify(results));
      return;
    }
    const lines: string[] = [`# Tid och långsamma barn: ${SEEDS} slumpfrön per elev, ${WEEKS} veckor`, ''];
    for (const profile of PROFILES) {
      const all: Record<string, Run[]> = JSON.parse(readFileSync(fileOf(profile), 'utf8'));
      lines.push(`## ${profile.name}`, '', 'Median (lägst–högst). Veckor räknas från första dagen.', '');
      lines.push('| | ' + RULES.map((v) => v.title).join(' | ') + ' |', '|---|' + RULES.map(() => '---').join('|') + '|');
      const row = (title: string, f: (r: Run) => number | null, format?: (n: number) => string) =>
        lines.push(`| ${title} | ${RULES.map((v) => spread(all[v.id]!.map(f), format)).join(' | ')} |`);
      const at = (w: number) => (r: Run) => r.weekly[w - 1] ?? null;
      row('Egen fart (det barnet redan kan)', (r) => r.knownRtMs, sec);
      row('Svar i trädgården, vecka 13', (r) => at(13)(r)?.rtMs ?? null, sec);
      row('Trädgården öppnar, vecka', (r) => r.gardenOpens);
      row('Stigen öppnar, vecka', (r) => r.pathOpens);
      row('Bäckens över tiotalet sitter, vecka', (r) => r.overtio);
      for (const w of CHECKPOINTS) row(`Gånger: buske eller träd, vecka ${w}`, (r) => at(w)(r)?.sit ?? null, pct);
      for (const w of [26, 52]) row(`Gånger: träd, vecka ${w}`, (r) => at(w)(r)?.automatic ?? null, pct);
      for (const w of [26, 52]) row(`Buskar barnet inte minns, vecka ${w}`, (r) => at(w)(r)?.notRecalled ?? null, pct);
      for (const w of [13, 26]) row(`Grodd i 4 veckor eller mer, vecka ${w}`, (r) => at(w)(r)?.stuck ?? null, pct);
      row('Rätt svar', (r) => r.correct, pct);
      lines.push('');
    }
    writeFileSync(join(OUT, 'tid.md'), lines.join('\n'));
    console.log(lines.join('\n'));
  });
});
