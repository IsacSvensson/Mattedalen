import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import { AVERAGE, STRONG, WEAK, type LearnerProfile } from './learner';
import { simulateValley, type ValleyOptions } from './valley';

/**
 * The valley simulated with many seeds, each kind of child on its own
 * (docs/PLAN-GRANSKNING.md, R2). Not part of the normal test run: it takes
 * minutes. One profile per process, then a summary:
 *
 *   VALLEY_REPORT=svag npx vitest run tests/simulation/valleyReport.test.ts   (and genomsnittlig, stark)
 *   VALLEY_REPORT=summary npx vitest run tests/simulation/valleyReport.test.ts
 *
 * Results go to VALLEY_OUT (default `tests/simulation/out`, not committed).
 */
const MODE = process.env.VALLEY_REPORT;
const OUT = process.env.VALLEY_OUT ?? join(__dirname, 'out');
const SEEDS = Number(process.env.VALLEY_SEEDS ?? 10);
const WEEKS = 52;

const PROFILES: LearnerProfile[] = [WEAK, AVERAGE, STRONG];
const VARIANTS: { id: string; title: string; options: Partial<ValleyOptions> }[] = [
  { id: 'without', title: 'Utan Stigen', options: { path: false } },
  { id: 'none', title: 'Med Stigen, ingen väntan', options: { path: true, waits: 'none' } },
  { id: 'app', title: 'Med Stigen, som i appen', options: { path: true } },
  { id: 'hard', title: 'Med Stigen, väntan utan tak', options: { path: true, waits: 'hard' } },
];
const TABLES = ['u2', 'u10', 'u5', 'u1', 'u4', 'u3', 'usq', 'u9', 'u6', 'u78'];
const PATH_PARTS = ['tiotal', 'tiental', 'ental', 'tilltio', 'hopptio', 'dubbla', 'overtio', 'tvasiffr', 'tvasiffrminus'];
const BROOK_PARTS = ['dubblor', 'overtio'];

interface Run {
  seed: number;
  gardenOpens: number | null;
  pathOpens: number | null;
  times26: number;
  times52: number;
  correct: number;
  tables: Record<string, number | null>;
  pathFirst: Record<string, number | null>;
  pathSits: Record<string, number | null>;
  brookSits: Record<string, number | null>;
  byCap: string[];
}

const week = (day: number | null | undefined) => (day === null || day === undefined ? null : Math.floor(day / 7));

function run(profile: LearnerProfile, variant: (typeof VARIANTS)[number], seed: number): Run {
  const r = simulateValley({ profile, seed, weeks: WEEKS, path: false, ...variant.options });
  const by = (prefix: string, ids: string[], from: Record<string, number>) => Object.fromEntries(ids.map((id) => [id, week(from[`${prefix}:${id}`])]));
  return {
    seed,
    gardenOpens: week(r.openDay.multiplication),
    pathOpens: week(r.openDay.hundred),
    times26: r.timesSit(26),
    times52: r.timesSit(52),
    correct: r.correct / r.answered,
    tables: by('multiplication', TABLES, r.firstDay),
    pathFirst: by('hundred', PATH_PARTS, r.firstDay),
    pathSits: by('hundred', PATH_PARTS, r.sitDay),
    brookSits: by('addition', BROOK_PARTS, r.sitDay),
    byCap: r.byCap,
  };
}

/** "12 (10–15)": the median and the range over the seeds; "–" for runs where it never happened. */
function spread(values: (number | null)[], format = (n: number) => String(n)): string {
  const got = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (!got.length) return '–';
  const median = got[Math.floor((got.length - 1) / 2)]!;
  const range = got[0] === got.at(-1) ? '' : ` (${format(got[0]!)}–${format(got.at(-1)!)})`;
  const missing = got.length < values.length ? ` [${values.length - got.length} aldrig]` : '';
  return `${format(median)}${range}${missing}`;
}
const pct = (n: number) => `${Math.round(100 * n)} %`;

describe.skipIf(!MODE)('the valley report', () => {
  it('runs or sums up', { timeout: 3_600_000 }, () => {
    mkdirSync(OUT, { recursive: true });
    if (MODE !== 'summary') {
      const profile = PROFILES.find((p) => p.name === MODE);
      if (!profile) throw new Error(`Unknown profile ${MODE}`);
      const results = Object.fromEntries(VARIANTS.map((v) => [v.id, Array.from({ length: SEEDS }, (_, i) => run(profile, v, i + 1))]));
      writeFileSync(join(OUT, `${profile.name}.json`), JSON.stringify(results));
      return;
    }
    const lines: string[] = [`# Dalen simulerad: ${SEEDS} slumpfrön per elev, ${WEEKS} veckor`, ''];
    for (const profile of PROFILES) {
      const all: Record<string, Run[]> = JSON.parse(readFileSync(join(OUT, `${profile.name}.json`), 'utf8'));
      lines.push(`## ${profile.name}`, '', 'Median (lägst–högst). Veckor räknas från första dagen.', '');
      lines.push('| | ' + VARIANTS.map((v) => v.title).join(' | ') + ' |', '|---|' + VARIANTS.map(() => '---').join('|') + '|');
      const row = (title: string, f: (r: Run) => number | null, format?: (n: number) => string) =>
        lines.push(`| ${title} | ${VARIANTS.map((v) => spread(all[v.id]!.map(f), format)).join(' | ')} |`);
      row('Trädgården öppnar, vecka', (r) => r.gardenOpens);
      row('Stigen öppnar, vecka', (r) => r.pathOpens);
      row('Gångerfakta som sitter, vecka 26', (r) => r.times26, pct);
      row('Gångerfakta som sitter, vecka 52', (r) => r.times52, pct);
      row('Rätt svar', (r) => r.correct, pct);
      for (const t of TABLES) row(`${t} börjar, vecka`, (r) => r.tables[t] ?? null);
      lines.push('');
      const app = all.app!;
      lines.push('Som i appen:', '');
      lines.push('| Del på Stigen | Börjar, vecka | Sitter, vecka |', '|---|---|---|');
      for (const part of PATH_PARTS) lines.push(`| ${part} | ${spread(app.map((r) => r.pathFirst[part] ?? null))} | ${spread(app.map((r) => r.pathSits[part] ?? null))} |`);
      lines.push('');
      for (const part of BROOK_PARTS) lines.push(`- Bäckens ${part} sitter vecka ${spread(app.map((r) => r.brookSits[part] ?? null))}.`);
      const capped = app.flatMap((r) => r.byCap);
      const started = app.reduce((n, r) => n + TABLES.filter((t) => r.tables[t] !== null && !['u2', 'u1', 'u5'].includes(t)).length, 0);
      const counts = [...new Set(capped)].map((t) => `${t} ${capped.filter((x) => x === t).length}`).join(', ');
      lines.push(`- Tabeller som taket släppte (delen satt inte på Stigen): ${capped.length} av ${started} som började${counts ? ` (${counts})` : ''}.`, '');
    }
    writeFileSync(join(OUT, 'report.md'), lines.join('\n'));
    console.log(lines.join('\n'));
  });
});
