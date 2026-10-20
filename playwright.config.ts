import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173/',
    locale: 'sv-SE',
  },
  projects: [
    { name: 'tablet', use: { ...devices['iPad (gen 7) landscape'], browserName: 'chromium' } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // The real app at /, and the test version in /test/, as on GitHub Pages (docs/PLAN-TESTVERSION.md).
    command: 'npx vite build && npx vite build --mode staging --outDir dist/test && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
  },
});
