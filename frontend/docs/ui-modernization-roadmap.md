# UI Modernization Roadmap

## Objective
Deliver a cohesive, accessible, and performance-conscious frontend system across dashboard, entries, admin, payouts, scores, settings, and public views.

## Week 1: Foundation and Guardrails

### 1. Token system v2
- [x] Expand semantic tokens for surfaces, text roles, border roles, and focus ring.
- [x] Add spacing, radius, elevation, and motion scales.
- [ ] Replace remaining legacy token names in module CSS with semantic role tokens.

### 2. Reusable UI primitives
- [x] Scaffold primitives: Card, SectionHeader, EmptyState, StatusPill.
- [x] Add DataTableToolbar primitive.
- [x] Add QuickActions primitive.
- [x] Begin replacing one feature module per domain with primitives.

### 3. Accessibility hardening
- [x] Add global focus-visible defaults.
- [x] Add reduced-motion guardrails.
- [x] Add high-contrast and forced-colors guardrails.
- [ ] Add keyboard flow checks for all modal and table workflows.

### 4. Quality gates
- [x] Extend UI lint rules to block transition: all.
- [ ] Add CSS rule check that warns on hover-only interactions without focus-visible counterpart.
- [ ] Add visual regression snapshots for dashboard, entries, payouts, scores, public view.

## Week 2: Migration and UX Modernization

### 5. Card system migration
- [x] Migrate settings pages to primitive cards and empty states.
- [x] Migrate view pages to primitive cards and status pills.
- [x] Migrate public landing feature cards and table wrappers to primitive cards.

### 6. Density and data UX
- [ ] Add compact and comfortable density toggles for table-heavy screens.
- [ ] Standardize empty/loading/error states per domain.
- [ ] Add inline action feedback patterns for high-frequency actions.

### 7. Performance and reliability
- [ ] Add bundle-size trend checks to CI.
- [ ] Add route-level performance budget targets.
- [ ] Virtualize long list/table renderers where needed.

## Acceptance Criteria
- No new hard-coded color literals outside theme source files.
- No transition: all declarations in app/components CSS.
- All key interactive surfaces expose keyboard-visible focus.
- Public and dashboard card systems share one hierarchy model (primary, secondary, utility).
