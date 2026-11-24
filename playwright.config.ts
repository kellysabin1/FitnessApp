import { defineConfig, devices } from '@playwright/test';

// End-to-end tests: the exported web app, on an iPhone-sized screen, against an in-memory
// stand-in for Supabase and the coach server (e2e/support/mock-server.mjs). No real data is touched.
const MOCK = 'http://127.0.0.1:5998';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // the mock backend is shared state
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    ...devices['iPhone 14 Pro'],
    browserName: 'chromium',
    baseURL: 'http://localhost:8090',
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node e2e/support/mock-server.mjs 5998',
      url: `${MOCK}/__reset`,
      reuseExistingServer: !process.env.CI,
    },
    {
      // build once with the mock addresses baked in, then serve the static files
      command: 'npx expo export --platform web --output-dir dist-e2e && node e2e/support/serve.mjs dist-e2e 8090',
      url: 'http://localhost:8090',
      timeout: 600_000,
      reuseExistingServer: !process.env.CI,
      env: {
        EXPO_PUBLIC_SUPABASE_URL: MOCK,
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
        EXPO_PUBLIC_PUSH_SERVER_URL: MOCK,
        EXPO_NO_TELEMETRY: '1',
      },
    },
  ],
});
