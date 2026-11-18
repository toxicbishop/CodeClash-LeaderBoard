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

## Requirements

- Node.js 24 LTS (development baseline).
- pnpm 11.10.0, as pinned in `package.json`.

## Development

```sh
pnpm install --frozen-lockfile
pnpm dev
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

- `src/app/`: App Router pages, root layout and global Tailwind styles.
- `public/`: Static assets.
- `docs/`: Requirements, architecture, workflows and planning decisions.
- `pnpm-lock.yaml`: Resolved dependency versions; commit this file.

The starter uses TypeScript, Tailwind CSS and ESLint. It includes a basic project landing page with system fonts, so builds do not need to fetch fonts.

Development and production builds use Next.js's supported Webpack mode with Tailwind's PostCSS plugin because the default Turbopack CSS worker crashed on this Windows environment. Next.js, React and Tailwind use the latest stable releases fetched during setup. ESLint 9 and TypeScript 6 use the newest compatible versions supported by the Next.js lint plugins; Node type definitions match Node.js 24.

The database, organizer authentication, leaderboard features and HackerRank synchronization are planned work. Start with the [documentation index](./docs/README.md).

## License

This project is licensed under the [MIT License](LICENSE).
