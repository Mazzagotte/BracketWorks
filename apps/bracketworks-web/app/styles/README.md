# BracketWorks CSS Map

## Shared stylesheet (both apps)

BracketWorks and Tournament Central load one shared stylesheet first, from
`app/layout.tsx`: `@bracketworks/ui/styles/globals.css`. It imports, in order:

- `packages/ui/styles/tokens.css`: type, spacing, radius, sizing, motion, and elevation scales.
- `packages/ui/styles/reset.css` and `components.css`: element reset and shared primitives.
- `packages/ui/styles/theme.css`: base color token catalog and compatibility aliases.
- `packages/ui/styles/base.css`: shared global layout, typography, buttons, inputs, and common classes.
- `packages/ui/styles/app-theme.css`: canonical palette, extended status palette, z-index scale,
  and native-control color behavior. **Change brand and status colors here.**

Color literals are only allowed in those token files. Everything else must use
`var(--token)`; use `color-mix(in srgb, var(--token) N%, transparent)` for translucency.
`node ../../scripts/enforce-ui-css-rules.mjs` (run by `npm run lint`) enforces this.

## Standard sizes (both apps)

No hardcoded `px`/`rem` sizes outside the token files. Pick from these scales in
`packages/ui/styles/tokens.css`:

| Use | Tokens | Values |
| --- | --- | --- |
| Padding, margin, gap, offsets, widths/heights up to 384px | `--space-px`, `--space-0-5` … `--space-96` (`--space-N` = N × 4px) | 1, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32 … 384 |
| Containers and layout widths above 384px | `--size-md` … `--size-12xl` | 448, 512, 576, 640, 720, 768, 896, 960, 1024, 1152, 1280, 1440, 1600, 1760 |
| Font size | `--font-size-3xs` … `--font-size-10xl` | 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 24, 28, 34, 40, 48, 56, 64 |
| Corner radius | `--radius-sm` … `--radius-3xl`, `--radius-full` | 4, 8, 12, 16, 20, 24, pill |
| Control height | `--control-height`, `--btn-height-*`, `--input-height-*` | 38 (default) |
| Icons (TSX) | `ICON_SIZE` from `@bracketworks/ui` | xs 12, sm 14, md 16, lg 18, xl 20, 2xl 24, 3xl 28 |

Negative values use `calc(var(--space-N) * -1)`. Exempt: border and outline widths,
shadows, transforms, blur, letter-spacing, SVG stroke widths, and `@media`
breakpoints (CSS cannot use custom properties in media queries; use the tiers below).

## App layer

- `main.css`
  BracketWorks-only overrides: Tailwind directives and the fixed-height app shell.
  Keep this file small; anything both apps need belongs in `packages/ui/styles`.

- `auth.css`
  Single entrypoint for auth page-level CSS. This imports the login, signup,
  validation, and reset-password global styles.

- `auth-pages.css`
  Consolidated auth page layouts and page-specific visuals.

- `auth-validation.css`
  Consolidated auth validation, connection, and password-strength states.

## Shared design modules

Use these CSS modules for repeated page patterns before adding another local
copy of the same visual treatment:

- `page-shell.module.css`
  Page width, content wrappers, section stacks, and shared page text rhythm.

- `cards.module.css`
  Standard dark card surfaces, card headers, panels, stat tiles, and primary
  orange accent rails. Use `cardHeaderDense` for compact operational card
  headers, and `statTileCompact`, `statValue`, `statLabel`, and `statDetail`
  for repeated dashboard-style stat tiles. Use `emptyStateCard` for plain
  empty/no-data cards, and combine `statePanel` with `dangerPanel`,
  `warningPanel`, or `successPanel` for repeated status surfaces. Use
  `quickActionsCard`, `quickActionsTitle`, `quickActionsBody`,
  `quickActionsRow`, `quickActionsGroupLeft`, `quickActionsGroupRight`, and
  `quickActionControl` for the repeated Quick Actions card pattern. Shared
  card headings use `cardTitle`, `cardTitleCompact`, and `cardHeaderRow`.

- `badges.module.css`
  Shared status pills, payment states, accent/muted tones, and payout
  placement badges.

- `buttons.module.css`
  Shared button base, primary, secondary, and danger treatments. Use
  `quickAction` for the uniform orange command buttons inside Quick Actions
  cards.

- `forms.module.css`
  Shared input, select, search, label, compact control, field-group, helper,
  and search-bar treatments.

- `tables.module.css`
  Shared table shell, cells, numeric/status/action columns, row actions,
  sortable headers, and hover treatments.

- `modals.module.css`
  Shared guide-modal overlay, frame, header, close-control placement, and
  scrollable body structure. Confirmation dialogs use the compact modal
  variant from this module.

- `icon-buttons.module.css`
  Shared square icon controls and destructive icon-button hover treatment.

- `animations.css`
  Shared animation keyframes and animation helper classes.

- `bowling-animations.css`
  Decorative bowling-themed effects.

## Page-scoped global CSS

Auth flow page-level CSS now lives in:

- `auth-pages.css`
- `auth-validation.css`

Other full-page global styling should stay in separate files only when it truly applies to an entire page flow rather than a reusable component.

Dashboard route-only settings shell styles live in
`app/dashboard/settings/dashboard-settings-page.module.css`; reusable settings
cards and Dashboard modal internals remain in `dashboard.module.css`.

## Component and page layout CSS

Most remaining styles should stay in `*.module.css` files near the page or component that owns them.

Examples:

- `app/components/*.module.css`
- `app/brackets/**/*.module.css`
- `app/payouts/payouts.module.css`
- `components/*.module.css`

## Rule of thumb

- Change shared foundational tokens in `packages/ui/styles/tokens.css`.
- Change colors and z-index layers in `packages/ui/styles/app-theme.css`.
- Change cross-app global rules in `packages/ui/styles/base.css`.
- Change `main.css` only for BracketWorks-specific overrides.
- Change shared design modules for repeated card, button, form, table, and page-shell patterns.
- Change `auth.css` only if you need to add or remove auth-related global files.
- Change `auth-pages.css` and `auth-validation.css` when working specifically on auth flows.
- Change page CSS files only for full-page flows.
- Change `*.module.css` for component-specific layout and behavior.

## Responsive conventions

- `<= 767px`: phone presentation; `768px-1023px`: tablet; `>= 1024px`: desktop.
- `900px`: named compact-content threshold for tables, dense forms, and controls
  that cannot comfortably retain their wide layout across the full tablet tier.
- `640px`: narrow mobile stacking and full-width controls.
- `480px`: narrow-phone gutter and density adjustments only.
- Use the constants and queries from `app/lib/responsive.ts` in JavaScript.
- Component-fit thresholds such as `820px` or `980px` are acceptable when the
  component has a documented intrinsic width requirement; they are not viewport tiers.
- Use `--bw-page-gutter`, `--bw-page-gutter-mobile`, `--bw-stack-gap`, and
  `--bw-control-gap` instead of repeating page-level spacing values.
