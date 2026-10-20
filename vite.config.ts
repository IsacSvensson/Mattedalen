import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/** All files below `dir`, as paths relative to it. */
function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full).map((f) => relative(dir, join(full, f))) : [name];
  });
}

/**
 * Emits sw.js with the list of every built file to precache. Its version is a
 * hash of the precached files, so any change to the app installs a new worker.
 */
function swPlugin(staging: boolean): Plugin {
  let outDir = 'dist';
  return {
    name: 'mattedalen-sw',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    // After everything (including index.html) is written.
    writeBundle() {
      const files = listFiles(outDir).filter((f) => f !== 'sw.js' && !f.endsWith('.map')).sort();
      const hash = createHash('sha256');
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)));
      const version = hash.digest('hex').slice(0, 12);
      const precache = ['./', ...files.map((f) => `./${f}`)];
      const source = readFileSync('src/sw/sw-template.js', 'utf8')
        .replace('const PRECACHE = __PRECACHE__;', `const PRECACHE = ${JSON.stringify(precache)};`)
        .replace('const VERSION = __VERSION__;', `const VERSION = ${JSON.stringify(version)};`)
        .replace('const CACHE_PREFIX = __CACHE_PREFIX__;', `const CACHE_PREFIX = ${JSON.stringify(staging ? STAGING_CACHE_PREFIX : 'mattedalen-')};`);
      writeFileSync(join(outDir, 'sw.js'), source);
    },
  };
}

/**
 * The test version's caches. The real app's worker deletes every cache named
 * `mattedalen-*` but its own, so this prefix must not start with that.
 */
const STAGING_CACHE_PREFIX = 'staging-mattedalen-';

/** The test version is named apart from the real app on the home screen and in the tab (docs/PLAN-TESTVERSION.md). */
function stagingPlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'mattedalen-staging',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    transformIndexHtml: (html) =>
      html.replace('<title>Mattedalen</title>', '<title>Mattedalen test</title>').replace('content="Mattedalen" />', 'content="Mattedalen test" />'),
    // Before swPlugin's writeBundle, so the precached manifest is this one.
    writeBundle: {
      order: 'pre',
      handler() {
        const file = join(outDir, 'manifest.webmanifest');
        const manifest = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
        writeFileSync(file, `${JSON.stringify({ ...manifest, name: 'Mattedalen test', short_name: 'Mattedalen test' }, null, 2)}\n`);
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const staging = mode === 'staging';
  /** Shown in the parent view, so a grown-up can see which version is running. APP_SHA names the commit when another one is built (the deploy builds both). */
  const sha = (process.env.APP_SHA || process.env.GITHUB_SHA)?.slice(0, 7);
  const build = [staging ? 'Testversion' : '', new Date().toISOString().slice(0, 10), sha].filter(Boolean).join(' · ');
  return {
    define: { __APP_BUILD__: JSON.stringify(build), __STAGING__: JSON.stringify(staging) },
    // Relative base so the static build works under any path (e.g. GitHub Pages /Mattedalen/, and the test version in /Mattedalen/test/).
    base: './',
    plugins: staging ? [stagingPlugin(), swPlugin(true)] : [swPlugin(false)],
    build: {
      target: 'es2022',
      outDir: 'dist',
    },
    test: {
      include: ['tests/**/*.test.ts'],
      environment: 'node',
    },
  };
});
