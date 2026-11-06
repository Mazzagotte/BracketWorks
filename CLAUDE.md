# BracketWorks platform

Monorepo: `apps/bracketworks-web` (BracketWorks, BW), `apps/tournament-central-web`
(Tournament Central, TC), `apps/api` (FastAPI), and shared packages in `packages/`.

## UI work: follow the approved standard

Any page, component, or style change in either app must follow the UI standard below
exactly. Run its build checklist before calling UI work done, and run `npm run lint`
in the app you changed (it includes `scripts/enforce-ui-css-rules.mjs`).

- Shared tokens and global styles live in `packages/ui/styles` (loaded first by both apps).
- Shared components belong in `packages/ui`. Do not build a local copy of a shared pattern.
- Never hardcode colors, sizes, spacing, radii, font values, z-index, or icon sizes.

@docs/ui-standards.md
