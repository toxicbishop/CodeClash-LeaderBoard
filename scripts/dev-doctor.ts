/**
 * scripts/dev-doctor.ts
 *
 * Pre-flight check run before `pnpm dev`.
 * Verifies the local Supabase stack is responding and env vars are present.
 * Aborts immediately with a helpful message instead of letting Next.js hang
 * for 25-30 seconds with cryptic AuthRetryableFetchError messages.
 *
 * Usage: automatically called by `pnpm dev` via the predev hook.
 */

import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

if (process.env.SKIP_DOCTOR === '1' || process.env.SKIP_DOCTOR === 'true') {
  process.exit(0);
}

const RESET  = '\x1b[0m';
const RED    = '\x1b[31m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BOLD   = '\x1b[1m';

const ok   = (msg: string) => console.log(`${GREEN}✓${RESET} ${msg}`);
const fail = (msg: string) => console.error(`${RED}✗${RESET} ${msg}`);
const warn = (msg: string) => console.warn(`${YELLOW}⚠${RESET}  ${msg}`);
const info = (msg: string) => console.log(`  ${msg}`);

for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) loadEnvFile(file);
}

let hasErrors = false;

function checkEnv() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];
  const optional = ['COMPETITION_ADMIN_EMAIL', 'COMPETITION_ADMIN_PASSWORD'];
  let allPresent = true;

  for (const key of required) {
    if (!process.env[key]?.trim()) {
      fail(`Missing required env var: ${BOLD}${key}${RESET}`);
      info(`  → Copy .env.example to .env.local and fill in the value`);
      allPresent = false;
      hasErrors = true;
    }
  }
  if (allPresent) ok('All required environment variables are set');

  for (const key of optional) {
    if (!process.env[key]?.trim()) {
      warn(`Optional env var not set: ${key} (needed for pnpm admin:sync)`);
    }
  }
}

async function checkSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return; // already reported by checkEnv

  const healthUrl = `${url}/auth/v1/health`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      ok(`Supabase local stack is healthy (${url})`);
    } else {
      fail(`Supabase returned HTTP ${res.status} from ${healthUrl}`);
      info('  → Run: supabase start');
      hasErrors = true;
    }
  } catch {
    fail(`Supabase local stack is not responding at ${url}`);
    info('');
    info(`  ${BOLD}To fix:${RESET}`);
    info('    1. Make sure Docker Desktop is running');
    info('    2. Run: supabase start');
    info('    3. Then: pnpm dev');
    info('');
    hasErrors = true;
  }
}

async function checkPendingMigrations() {
  // Just warn if there are unapplied migrations — don't fail dev startup
  try {
    const { execSync } = await import('node:child_process');
    const output = execSync('supabase migration list 2>&1', { encoding: 'utf8', timeout: 5000 });
    if (output.includes('"remote":""')) {
      warn('There are unapplied local migrations');
      info('  → Run: supabase migration up');
    } else {
      ok('All migrations are applied');
    }
  } catch {
    // supabase CLI not available or stack not started — skip
  }
}

async function main() {
  console.log(`\n${BOLD}Code Clash Leaderboard — Dev Pre-flight Check${RESET}\n`);

  checkEnv();
  await checkSupabase();
  await checkPendingMigrations();

  console.log('');

  if (hasErrors) {
    console.error(`${RED}${BOLD}Pre-flight failed. Fix the issues above, then run pnpm dev again.${RESET}\n`);
    process.exit(1);
  } else {
    ok(`All checks passed — starting dev server\n`);
  }
}

main();
