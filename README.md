# Code Clash Leaderboard

![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-F69220?logo=pnpm&logoColor=white)
![ESLint](https://img.shields.io/badge/ESLint-4B32C3?logo=eslint&logoColor=white)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Code Clash Leaderboard is a centralized platform for managing multi-lab, multi-round coding competitions. It features live HackerRank API leaderboard syncing every **5 seconds**, automated data validation, per-round contest set management, unified cross-set ranking, and Top-K participant selection. Competition administrators configure contests with multiple rounds and contest sets; Lab Admins fetch live results directly from HackerRank or upload spreadsheets; results are consolidated into a single authoritative, real-time leaderboard.

## Screenshots

Visual preview of the administrator sign-in portal and the competition overview dashboard:

| Administrator Sign-in | Competition Dashboard |
| :---: | :---: |
| ![Sign-in Page](docs/assets/Loginpage.png) | ![Competition Dashboard](docs/assets/Dashboard.png) |

## Competition workflow

| Role | Primary Route | Core Capabilities |
| --- | --- | --- |
| **Super Admin** | `/admin` | Provision competitions, create multi-round contest sets, review submissions, approve/reject uploads, configure tie-breaking rules, trigger unified rankings, and publish leaderboards. |
| **Master Lab Admin** | `/upload` | Access contest sets per round, ingest results via live HackerRank API auto-sync (5 s) or spreadsheet upload (CSV/Excel), validate participant entries, and submit for Super Admin approval. |
| **HOD / Principal** | `/monitor` | Real-time institutional monitoring dashboard to oversee event progress, participation metrics, and approved leaderboards without editing permissions. |
| **Public / Participants** | `/leaderboard` | View real-time published leaderboards with per-round tabs, contest-specific rankings, and Top-K qualifiers with tie-breaking breakdowns. |

The centralized Version 2 architecture uses one **Master Lab Admin** to ingest independent contest-set results per round, while the **Super Admin** oversees approval, ranking configuration, and publication. Submissions are securely stored in Supabase with row-level security. Participant records are validated and scores are merged across sets and rounds into a unified leaderboard.

> [!NOTE]
> Each competition round is **independent** — scores are not cumulated across rounds. Each round produces its own leaderboard snapshot. See the [delivery plan](docs/decisions-and-delivery.md) for the full lifecycle.

## Architecture

![System Architecture](docs/assets/System-Architecture.png)

The system uses the Next.js App Router with React Server Components and Server Actions, Supabase (PostgreSQL + Auth + Row-Level Security), and Tailwind CSS. The request proxy middleware refreshes Supabase sessions on every request. Protected pages load data exclusively through the server-side Supabase client. All database schema changes are versioned as PostgreSQL migrations in `supabase/migrations/`. Papa Parse handles CSV ingestion; `read-excel-file` processes Excel workbooks.

## Multi-Round Contest Sets

Each contest set (e.g., Set A, Set B) can span **multiple rounds**. When adding a contest set, the Super Admin selects the number of rounds using the pill selector (1–4) and provides a distinct HackerRank slug for each round. The database enforces uniqueness per `(competition_id, round_number, set_code)`.

The Lab Admin page and the public leaderboard both auto-sync against the HackerRank API every **5 seconds** when Auto-Sync is active. Round tabs on the leaderboard show completed rounds as greyed-out and the active round with a live pulse indicator.

## Local development

### Prerequisites

> [!IMPORTANT]
> **Always use `pnpm`** as the package manager for this project (e.g. `pnpm install`, `pnpm run dev`). Do not use `npm` or `yarn` directly to prevent lockfile and dependency mismatches.

* **Node.js**: v24.x or later
* **pnpm**: v11.10.0 or later (`npm install -g pnpm`)
* **Docker Desktop / Docker Engine**: Must be installed and running. The local Supabase environment (PostgreSQL, Auth, Storage) runs entirely inside Docker containers.
* **Supabase CLI**: Can be run on demand via `npx supabase` (no manual installation required), or installed globally with `pnpm add -g supabase` or `brew install supabase/tap/supabase`.

---

### Step-by-Step Setup

1. **Install project dependencies:**
   Always use `pnpm`:
   ```sh
   pnpm install --frozen-lockfile
   ```

2. **Start the local Supabase stack:**
   Ensure Docker Desktop is open and running, then spin up the local Supabase stack. On initial startup, this automatically downloads the required Docker images and executes all migrations in `supabase/migrations/`:
   ```sh
   npx supabase start
   ```
   To inspect the local endpoints, dashboard URL, anon keys, and service keys at any time:
   ```sh
   npx supabase status
   ```

3. **Configure environment variables:**
   Copy the environment template:
   ```sh
   cp .env.example .env.local
   ```
   Populate `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` using the values printed by `npx supabase status`. Also set `COMPETITION_ADMIN_EMAIL` and `COMPETITION_ADMIN_PASSWORD` for the local super admin account.

4. **Seed the administrator account and start the app:**
   Sync the admin credentials with the local Supabase database and run the development server with `pnpm`:
   ```sh
   pnpm admin:sync
   pnpm run dev
   ```

5. **Open the application:**
   Navigate to [http://localhost:3000](http://localhost:3000) and sign in using the administrator credentials configured in `.env.local`.

### Rotate the main admin password

Keep `COMPETITION_ADMIN_EMAIL` set to the existing administrator's email. Change `COMPETITION_ADMIN_PASSWORD` in the git-ignored `.env.local` and run `pnpm admin:sync` from the repository root. The command applies the password to the same Supabase account. You can then sign in with the new password. The email selects the account to manage, so setting an unused email provisions a separate administrator.

### Supabase Auth settings

Competition administrators provision lab accounts. Public sign-up is disabled in the local Supabase configuration. Before deployment, disable public sign-up in the hosted Auth settings and verify the sign-in rate limit for the event. The local limit is 30 sign-in and sign-up requests per five minutes per IP. Labs that share a public IP share that allowance.

## Project structure

```text
src/
├── app/
│   ├── layout.tsx & globals.css       Root layout and theme styling
│   ├── page.tsx                       Landing page and role-based redirect
│   ├── login/                         Unified role-based authentication portal
│   ├── admin/                         Super Admin console
│   │   ├── page.tsx                   Competition dashboard & status overview
│   │   ├── actions.ts                 Server actions for competitions, sets, and approvals
│   │   ├── competitions/              Competition creation, multi-round contest set management, upload reviews
│   │   │   ├── [id]/sets/new/         Add contest set form with per-round slug inputs
│   │   │   └── [id]/rules/            Configurable tie-breaking rules engine
│   │   └── users/                     Account provisioning (Super Admin, Master Lab Admin, HOD, Principal)
│   ├── upload/                        Master Lab Admin ingestion console
│   │   ├── page.tsx                   Contest set selection overview (grouped by round)
│   │   ├── [setId]/                   Live HackerRank auto-sync (5 s) & spreadsheet upload client
│   │   └── actions.ts                 Server actions for file ingestion and HackerRank fetch
│   ├── leaderboard/                   Public unified competition leaderboard
│   ├── competitions/[slug]/leaderboard/  Per-competition leaderboard with round tabs & auto-refresh (5 s)
│   ├── monitor/                       Read-only institutional monitoring dashboard
│   └── api/competitions/[id]/export/  CSV export endpoint for competition rankings
├── components/                        Shared layout, navigation, and footer components
│   ├── AdminNav.tsx                   Super Admin navigation bar
│   ├── FatFooter.tsx                  Comprehensive platform footer
│   └── ThemeToggle.tsx                Dark / light theme toggle
├── lib/
│   ├── auth/                          Role-based access guards (requireSuperAdmin, requireMasterLabAdmin, etc.)
│   ├── hackerrank/                    HackerRank REST API client, SSRF protection, and entry validation
│   ├── leaderboard/                   Cache, publish, and round-aware snapshot helpers
│   ├── ranking/                       Consolidated ranking engine, Top-K calculation, and tie-breakers
│   └── supabase/                      Browser, server, session, and service-role Supabase clients
├── proxy.ts                           Edge-compatible Next.js request proxy / middleware
└── types/database.ts                  TypeScript definitions for database schema, roles, and round support

supabase/
├── migrations/                        Versioned PostgreSQL schema migrations and RLS policies
│   ├── 20261121000000_v2_centralized_schema.sql   Core v2 schema
│   └── 20261128000000_multi_round_support.sql     round_number column, updated uniqueness constraints
├── tests/                             Database integration & RLS permission tests (68 tests)
└── config.toml                        Local Supabase stack configuration
```

## Checks and production build

| Command | Purpose |
| --- | --- |
| `pnpm lint` | Run ESLint across the repository. |
| `pnpm typecheck` | Generate Next.js route types and run the TypeScript compiler. |
| `pnpm build` | Create the production build using Webpack. |
| `pnpm start` | Serve the production build after `pnpm build`. |
| `pnpm test:signin` | Start the production build on port 3100 and verify the competition admin sign-in flow in Chromium. |
| `pnpm test:permissions` | Check role and account-status enforcement in admin server actions (68 cases). |
| `supabase test db` | Exercise upload row-level security against a migrated local Supabase database. |

To run the sign-in test locally, use the local Supabase setup above, run `pnpm build`, and install Chromium with `pnpm exec playwright install chromium`. The test reads the admin credentials from the environment or `.env.local`.

GitHub Actions checks pull requests into `main` and pushes to `main`. CI starts a disposable Supabase stack and seeds a test account on the runner. It runs lint, type checking, the production build, the browser test, a high-severity dependency audit, and a Semgrep source scan.

For the full event workflow and acceptance criteria, see the [documentation index](docs/README.md).

## License

This project is licensed under the [MIT License](LICENSE).
