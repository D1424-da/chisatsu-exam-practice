// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const CHROMIUM_EXEC = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// 外部CDN ドメイン (Firebase, Google Fonts) をモックしてタイムアウトを防ぐ
const EXTERNAL_DOMAINS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'www.gstatic.com',
  'accounts.google.com',
  'firestore.googleapis.com',
  'firebase.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
];

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 2,
  timeout: 30000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // 外部リクエストを全てモック（タイムアウト防止）
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { executablePath: CHROMIUM_EXEC },
      },
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        launchOptions: { executablePath: CHROMIUM_EXEC },
      },
    },
    {
      name: 'tablet',
      use: {
        viewport: { width: 768, height: 1024 },
        launchOptions: { executablePath: CHROMIUM_EXEC },
      },
    },
  ],
  webServer: {
    command: 'npx http-server . -p 8080 --silent',
    url: 'http://localhost:8080',
    reuseExistingServer: true,
    timeout: 10000,
  },
});
