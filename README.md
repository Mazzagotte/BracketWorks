
# BracketWorks

BracketWorks is a monorepo for tournament software that runs bowling bracket events. BracketWorks manages bracket setup, live scoring, payouts, and results, while Tournament Central will eventually handle tournament discovery, creation, and registration.

Live app: [https://bracketworks.app](https://bracketworks.app)

## Repository structure

- apps/bracketworks — the existing BracketWorks Next.js application.
- apps/tournament-central — a new Next.js starter for tournament discovery and registration.
- backend — the FastAPI backend service.
- packages/api-client — shared API request helpers.
- packages/shared-types — shared TypeScript interfaces and API types.
- packages/design-tokens — shared design constants.
- scripts — startup helpers for the apps and backend.

## Local development

- Backend: `powershell -File scripts/start-backend.ps1`
- BracketWorks app: `powershell -File scripts/start-bracketworks.ps1`
- Tournament Central app: `powershell -File scripts/start-tournament-central.ps1`
- Or run the apps directly from the workspace root with `npm run dev:bracketworks` and `npm run dev:tournament-central`

### Environment files

- apps/bracketworks/.env.example
- apps/tournament-central/.env.example
- backend/.env.example

### Build, lint, and test

- `npm install`
- `npm run build:bracketworks`
- `npm run lint:bracketworks`
- `npm run test:frontend`
- `npm run build:tournament-central`
- `npm run lint:tournament-central`

## Deployment roots

- BracketWorks deployment root: apps/bracketworks
- Tournament Central deployment root: apps/tournament-central
- Backend deployment root: backend

## Notes

- Tournament Central manages tournament discovery, creation, and registration.
- BracketWorks runs tournaments, brackets, scoring, results, and payouts.
- Both applications will eventually use the same backend and account system.
- Tournament Central-to-BracketWorks importing is planned but is not part of this reorganization.

## Support

For issues or questions, open a repository issue or reach out through [bracketworks.app](https://bracketworks.app).

## License

MIT