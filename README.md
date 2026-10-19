
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
- Squad capacity is measured in bowler spots, not registrations. Organizer squad summaries show both registrations and bowlers; pending and confirmed entries occupy spots, while waitlisted entries are counted separately. A doubles registration with two bowlers uses two spots.
- In Tournament Central Setup, Rules & Documents supports pasted plain-text rules and uploaded PDF, DOC, DOCX, PNG, or JPG files (up to 20 MB each). Text follows Save Draft/Publish; documents are saved immediately after upload and can be downloaded or removed. Save a new tournament draft before uploading. Public tournament details and registration show the published rules and document links.
- Public registration follows Details, Review, and Confirmation, with cash-at-check-in guidance before entry. Signed-in users can optionally fill Bowler 1's empty name/email fields from their account. Additional bowlers can copy Bowler 1's available contact/address fields once and then edit independently; identity and bowling details are never copied. Successful submissions retain the server's confirmation number instead of resetting the form.
- Public account-menu controls have explicit accessible names. Public bowler/squad counts use complete text strings so assistive technology does not encounter detached plural suffixes; decorative registration icons are hidden from the accessibility tree.
- Public tournament details have permanent links such as `/?tournament=tc-58`. Opening details updates the address bar; Copy link shares the selected tournament, and direct visits/reloads reopen its modal. Browser Back/Forward follows the selected tournament. Registration keeps the detail URL and returns to details when closed. Exact public-directory lookup supports older tournaments outside the homepage list; private or missing tournaments show an explicit unavailable message.
- Organizer Payments lets staff click the payment-status badge to toggle between Paid and Unpaid, with confirmation before each change. Mark paid only after receiving the full payment; mark unpaid to correct the record. Both actions update the payment status and totals without charging the bowler or issuing a refund. Cancelled and refunded registrations cannot be toggled from Payments.
- Organizer confirmations share an app-themed dialog instead of browser popups, including payment changes, tournament/entry/team deletion, document removal, and Setup deletions. Dialogs provide explicit action labels, keyboard focus containment/restoration, Escape and Cancel dismissal, and consistent destructive-action styling, including when opened over a Setup drawer.
- Organizer pages share a 1440px maximum workspace width, responsive page gutters, readable table typography, and visible keyboard-focus outlines. Dashboard, tournament operations, Setup, and account settings retain their existing workflows with consistent spacing; wide data tables scroll inside their cards on small screens.
- The organizer dashboard is operations-first: compact tournament rows expose registration/squad counts, recorded payment totals, management links, and protected deletion actions. Search by name/location and filter by publication status. The side rail prioritizes Needs Attention (with an explicit all-clear state), followed by linked upcoming tournament dates; team invitations remain above the workspace.
- BracketWorks runs tournaments, brackets, scoring, results, and payouts.
- Both applications will eventually use the same backend and account system.
- Tournament Central-to-BracketWorks importing is planned but is not part of this reorganization.

## Support

For issues or questions, open a repository issue or reach out through [bracketworks.app](https://bracketworks.app).

## License

MIT