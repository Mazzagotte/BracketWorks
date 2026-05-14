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

- `animations.css`
  Shared animation keyframes and animation helper classes.

- `bowling-animations.css`
  Decorative bowling-themed effects.

## Page-scoped global CSS

Auth flow page-level CSS now lives in:

- `auth-pages.css`
- `auth-validation.css`

Other full-page global styling should stay in separate files only when it truly applies to an entire page flow rather than a reusable component.

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
- Change `auth.css` only if you need to add or remove auth-related global files.
- Change `auth-pages.css` and `auth-validation.css` when working specifically on auth flows.
- Change page CSS files only for full-page flows.
- Change `*.module.css` for component-specific layout and behavior.
