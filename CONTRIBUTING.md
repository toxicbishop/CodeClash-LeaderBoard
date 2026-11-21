# Contributing to Code Clash Leaderboard

Thank you for your interest in contributing to **Code Clash Leaderboard**! We welcome contributions, bug fixes, feature proposals, and architectural improvements.

Please take a few moments to review these guidelines before getting started.

---

## Code of Conduct

All contributors and maintainers are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it to understand our community expectations and reporting procedures for unacceptable behavior.

---

## Core Maintainers & Team

This project is actively developed and maintained by:

* **Pranav Arun** ([@toxicbishop](https://github.com/toxicbishop)) — Project Lead
* **Mohammed** ([@Mohammed0572](https://github.com/Mohammed0572)) — Core Contributor & Security
* **Rithika** ([@Rithika-git-netizen](https://github.com/Rithika-git-netizen)) — Core Contributor
* **Apeksh Shekar** ([@apekshshekar](https://github.com/apekshshekar)) — Core Contributor

Feel free to mention or reach out to any team member for questions or review feedback on PRs.

---

## Getting Started

### Prerequisites

* **Node.js**: `v24.x`
* **Package Manager**: `pnpm` (version `11.10.0` or later recommended)
* **Supabase CLI**: For local PostgreSQL and database migrations
* **Docker Engine**: Required by local Supabase

### Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/toxicbishop/CodeClash-LeaderBoard.git
   cd CodeClash-LeaderBoard
   ```

2. **Install dependencies:**
   ```bash
   pnpm install --frozen-lockfile
   ```

3. **Start local Supabase services:**
   ```bash
   supabase start
   ```

4. **Environment configuration:**
   Copy `.env.example` to `.env.local` and configure your local Supabase credentials and secret keys:
   ```bash
   cp .env.example .env.local
   ```

5. **Seed local administrator:**
   ```bash
   pnpm admin:sync
   ```

6. **Start development server:**
   ```bash
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Development Workflow

1. **Create a topic branch:**
   Always create a new branch from `master` (or `main`) with a descriptive name:
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/your-bugfix-name
   ```

2. **Keep commits atomic and descriptive:**
   Follow standard [Conventional Commits](https://www.conventionalcommits.org/) conventions:
   * `feat: add live leaderboard WebSocket updates`
   * `fix(security): sanitize contest slug inputs against SSRF`
   * `test: add unit tests for ranking tie-breaker engine`
   * `docs: update deployment and setup instructions`

3. **Write tests:**
   If you add a new feature or fix a bug, please accompany it with relevant unit tests in `tests/unit/` using Vitest or database tests in `supabase/tests/`.

---

## Verification & Quality Checks

Before submitting a Pull Request, run the full verification suite to ensure all tests, types, and linters pass:

```bash
# 1. ESLint check
pnpm lint

# 2. TypeScript compilation check
pnpm typecheck

# 3. Unit tests (Vitest)
pnpm test:permissions

# 4. Production build verification
pnpm build
```

If you modify the database schema or SQL policies, test migrations against the local database:
```bash
supabase test db
```

---

## Submitting a Pull Request

1. Push your branch to GitHub.
2. Open a Pull Request targeting `master`.
3. Provide a clear summary:
   * **What does this PR do?**
   * **Why is it needed?**
   * **How was it tested?**
   * Include screenshots or terminal logs for UI or CLI changes.
4. Ensure all GitHub Actions CI checks (CodeQL analysis, build, tests) succeed.
5. Address any review comments from the maintainers. Once approved, your PR will be merged!
