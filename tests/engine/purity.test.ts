import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ENGINE_DIR = join(import.meta.dirname, '../../src/engine');
const files = readdirSync(ENGINE_DIR).filter((f) => f.endsWith('.ts'));
const source = (f: string) => readFileSync(join(ENGINE_DIR, f), 'utf8');
const code = (f: string) => source(f).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

describe('engine purity', () => {
  it.each(files)('%s imports only from the engine', (f) => {
    const imports = [...source(f).matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
    for (const spec of imports) expect(spec).toMatch(/^\.\/[\w-]+$/);
  });

  it.each(files)('%s does not touch the DOM or storage', (f) => {
    expect(code(f)).not.toMatch(/\b(document|window|globalThis|self|localStorage|sessionStorage|indexedDB|navigator|caches)\s*[.[]/);
    expect(code(f)).not.toMatch(/\bfetch\s*\(/);
  });

  it.each(files)('%s knows nothing about multiplication', (f) => {
    expect(source(f)).not.toMatch(/multiplicat|multiplikat|×|gånger/i);
  });

  it('time and randomness are only read through injected Clock/Rng', () => {
    for (const f of files.filter((f) => f !== 'clock.ts')) {
      expect(code(f), f).not.toMatch(/Date\.now|new Date\(|Math\.random/);
    }
  });
});
