# BracketWorks CSS Map

## Edit this file first

- `main.css`

This is the active theme entrypoint loaded by the app layout. Start here when changing:

- brand colors
- shared typography scale
- spacing and radius defaults
- shared gradients and shadows
- app-wide theme overrides

## Global layers

- `auth.css`
  Single entrypoint for auth page-level CSS. This imports the login, signup,
  validation, and reset-password global styles.

- `auth-pages.css`
  Consolidated auth page layouts and page-specific visuals.

- `auth-validation.css`
  Consolidated auth validation, connection, and password-strength states.

- `colors.global.css`
  Base token catalog and compatibility variables.

- `globals.css`
  Reset, typography, shared layout primitives, buttons, inputs, and common global classes.

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

- `toolbars.module.css`
  Shared page-level search, filter, and action rows with mobile stacking.

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

- Change `main.css` for theme decisions.
- Change `globals.css` for cross-app shared primitives.
- Change shared design modules for repeated card, button, form, table, and page-shell patterns.
- Change `auth.css` only if you need to add or remove auth-related global files.
- Change `auth-pages.css` and `auth-validation.css` when working specifically on auth flows.
- Change page CSS files only for full-page flows.
- Change `*.module.css` for component-specific layout and behavior.

## Responsive conventions

- `900px`: compact desktop/tablet layout changes.
- `640px`: mobile stacking and full-width controls.
- `480px`: narrow-phone gutter and density adjustments only.
- Use `--bw-page-gutter`, `--bw-page-gutter-mobile`, `--bw-stack-gap`, and
  `--bw-control-gap` instead of repeating page-level spacing values.
