
# BracketWorks

BracketWorks is a monorepo for tournament software that runs bowling bracket events. BracketWorks manages bracket setup, live scoring, payouts, and results, while Tournament Central will eventually handle tournament discovery, creation, and registration.

Live app: [https://bracketworks.app](https://bracketworks.app)

## Repository structure

- apps/bracketworks-web — the BracketWorks Next.js application.
- apps/tournament-central-web — the Tournament Central Next.js application.
- apps/api — the FastAPI backend service.
- packages/config — shared API request helpers.
- packages/types — shared TypeScript interfaces and API types.
- packages/ui — shared design constants and styles.
- packages/auth — shared auth package scaffold.
- scripts — startup helpers for the apps and backend.

## Local development

- Backend: `powershell -File scripts/start-backend.ps1`
- BracketWorks app: `powershell -File scripts/start-bracketworks.ps1`
- Tournament Central app: `powershell -File scripts/start-tournament-central.ps1`
- Or run the apps directly from the workspace root with `pnpm run dev:bracketworks` and `pnpm run dev:tournament-central`

### Environment files

- apps/bracketworks-web/.env.example
- apps/tournament-central-web/.env.example
- apps/api/.env.example

### Build, lint, and test

- `pnpm install`
- `pnpm run build:bracketworks`
- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm run test`
- `pnpm run build:tournament-central`

## Deployment roots

- BracketWorks deployment root: apps/bracketworks-web
- Tournament Central deployment root: apps/tournament-central-web
- Backend deployment root: apps/api

## Railway frontend deployment (Railpack)

- Use Railway Railpack (no frontend Dockerfile required).
- Keep workspace files at the repository root: `pnpm-lock.yaml` and `pnpm-workspace.yaml`.

BracketWorks build:
`pnpm --filter @bracketworks/bracketworks-web build`

BracketWorks start:
`pnpm --filter @bracketworks/bracketworks-web start -- --port $PORT`

Tournament Central build:
`pnpm --filter @bracketworks/tournament-central-web build`

Tournament Central start:
`pnpm --filter @bracketworks/tournament-central-web start -- --port $PORT`

## Notes

- Tournament Central manages tournament discovery, creation, and registration.
- BracketWorks runs tournaments, brackets, scoring, results, and payouts.
- Both applications will eventually use the same backend and account system.
- Tournament Central-to-BracketWorks importing is planned but is not part of this reorganization.

## Support

For issues or questions, open a repository issue or reach out through [bracketworks.app](https://bracketworks.app).

## License

MIT