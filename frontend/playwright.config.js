import { defineConfig, devices } from '@playwright/test'

/**
 * Tests de bout en bout (SCRUM-89 / F34) : parcours 1 (porteur) et 2 (fournisseur) dans un vrai navigateur.
 * L'API est simulée dans le navigateur (e2e/support/api.js) : les tests ne dépendent ni de Laravel ni d'une base.
 * Lancer : npm run test:e2e (la première fois : npx playwright install chromium).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:5174',
    locale: 'fr-FR',
    timezoneId: 'Africa/Tunis',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'ordinateur', use: { ...devices['Desktop Chrome'] } },
    // Largeur minimale visée par la plateforme : 360 px (SCRUM-88).
    { name: 'mobile-360', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 740 }, hasTouch: true } },
  ],
  webServer: {
    command: 'npx vite --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    env: { VITE_API_URL: 'http://api.test/api' },
    timeout: 120_000,
  },
})
