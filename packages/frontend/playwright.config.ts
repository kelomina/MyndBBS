import { defineConfig, devices } from '@playwright/test';

// E2E 测试通过 page.route mock 全部后端 API，但 Next.js middleware 的安装守卫
// 仍需一个真实后端响应 /api/public/install-status，否则所有页面 500。
const backendEnv = {
  DATABASE_URL:
    process.env.E2E_DATABASE_URL ||
    'postgresql://myndbbs:myndbbs_test@localhost:5432/myndbbs_test?schema=public',
  JWT_SECRET: process.env.JWT_SECRET || 'e2e-only-jwt-secret-0123456789abcdef0123456789abcdef',
  JWT_REFRESH_SECRET:
    process.env.JWT_REFRESH_SECRET || 'e2e-only-refresh-secret-0123456789abcdef0123456789',
  INSTALL_LOCKED: 'true',
};

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  retries: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: './reports/playwright-html' }],
  ],
  outputDir: './reports/playwright-artifacts',
  use: {
    baseURL: 'http://127.0.0.1:3101',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter backend start',
      url: 'http://127.0.0.1:3001/api/health',
      reuseExistingServer: true,
      timeout: 120_000,
      env: backendEnv,
    },
    {
      command: 'pnpm exec next dev --hostname 127.0.0.1 --port 3101',
      url: 'http://127.0.0.1:3101/login',
      reuseExistingServer: true,
      timeout: 180_000,
      env: { API_URL: 'http://127.0.0.1:3001' },
    },
  ],
});
