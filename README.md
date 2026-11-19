# Code Clash Leaderboard

![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-F69220?logo=pnpm&logoColor=white)
![ESLint](https://img.shields.io/badge/ESLint-4B32C3?logo=eslint&logoColor=white)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Next.js starter for the shared Code Clash 2026 leaderboard.

## Architecture

```mermaid
flowchart TD
    subgraph LabAdmins["Lab Administrators"]
        L1["Lab 1 Admin"]
        L2["Lab 2 Admin"]
        LN["Lab N Admin"]
    end

    subgraph App["Next.js Application"]
        UI["Public Leaderboard UI"]
        ADMIN["Competition Admin Dashboard"]
        LABUI["Lab Admin Dashboard"]
        API["REST API Route Handlers"]
        SVC["Validation and Ranking Services"]
    end

    subgraph DB["PostgreSQL via Prisma"]
        UPLOADS[(Uploads)]
        RESULTS[(Results)]
        SNAP[(Leaderboard Snapshots)]
    end

    CA["Competition Administrator"] --> ADMIN
    L1 & L2 & LN --> LABUI
    LABUI --> API
    ADMIN --> API
    API --> SVC
    SVC --> UPLOADS
    SVC --> RESULTS
    SVC --> SNAP
    SNAP --> UI
    UI --> PUB["Shared Projector / Web View"]
```

## Requirements

- Node.js 24 LTS (development baseline).
- pnpm 11.10.0, as pinned in `package.json`.

## Development

```sh
pnpm install --frozen-lockfile
pnpm run dev
```

Open [localhost:3000](http://localhost:3000).

## Checks and production

```sh
pnpm lint
pnpm typecheck
pnpm build
pnpm start
```

Run `pnpm build` before `pnpm start`.

## Structure

```text
src/
├── app/               # Page routes & API endpoints (App Router)
│   ├── layout.tsx
│   ├── page.tsx       # / (Landing page)
│   ├── login/         # /login
│   ├── admin/         # /admin (Competition Admin portal)
│   ├── lab-admin/     # /lab-admin (Lab Admin portal)
│   └── api/           # /api/... (REST API endpoints)
├── components/        # Reusable UI (LeaderboardTable, UploadModal, Badges)
├── lib/               # Prisma client, database helpers, auth session
├── services/          # File parser, validation engine, ranking algorithm
└── types/             # Shared TypeScript interfaces and models
```

- `src/app/`: App Router pages, root layout, and global Tailwind styles.
- `src/components/`: Reusable presentation and interactive components.
- `src/lib/`: Database client (Prisma), utility functions, and authentication session helpers.
- `src/services/`: Core business logic (file parser, validation engine, ranking calculations).
- `src/types/`: Shared TypeScript data structures and interfaces.
- `public/`: Static assets.
- `docs/`: Comprehensive requirements, data model, architecture, and operational workflows.
- `pnpm-lock.yaml`: Resolved dependency versions; commit this file.

The starter uses TypeScript, Tailwind CSS and ESLint. It includes a basic project landing page with system fonts, so builds do not need to fetch fonts.

Development and production builds use Next.js's supported Webpack mode with Tailwind's PostCSS plugin because the default Turbopack CSS worker crashed on this Windows environment. Next.js, React and Tailwind use the latest stable releases fetched during setup. ESLint 9 and TypeScript 6 use the newest compatible versions supported by the Next.js lint plugins; Node type definitions match Node.js 24.

The database, organizer authentication, leaderboard features and HackerRank synchronization are planned work. Start with the [documentation index](./docs/README.md).

## License

This project is licensed under the [MIT License](LICENSE).
