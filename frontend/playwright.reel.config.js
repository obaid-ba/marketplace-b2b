import { defineConfig, devices } from '@playwright/test'

/**
 * Tests sur la vraie plateforme (API Laravel + base + données de démonstration), à la différence de
 * playwright.config.js qui simule l'API. Démarrer d'abord la plateforme : ./deploy/start.sh
 * Lancer : npm run test:reel
 * Autres adresses : E2E_WEB_URL=http://… E2E_API_URL=http://…/api npm run test:reel
 */
export default defineConfig({
  testDir: './e2e-reel',
  timeout: 240_000,
  // Les pages d'un même compte se suivent ; les comptes tournent en parallèle.
  fullyParallel: false,
  workers: 3,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:5173',
    locale: 'fr-FR',
    timezoneId: 'Africa/Tunis',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'ordinateur', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-360', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 740 }, hasTouch: true } },
  ],
})
