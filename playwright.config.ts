import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

if (existsSync('.env.local')) loadEnvFile('.env.local');
const baseURL = 'http://127.0.0.1:3100';

export default defineConfig({
  testDir: './tests',
  use: { baseURL },
  webServer: {
    command: 'pnpm exec next start --hostname 127.0.0.1 --port 3100',
    url: baseURL,
    reuseExistingServer: false,
  },
});
