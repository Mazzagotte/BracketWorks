# BracketWorks UI Standards

**Status: APPROVED 2026-11-05.** Applies to BracketWorks (BW), Tournament Central (TC), and
`packages/ui`, including marketing, login, and signup pages. Every new or changed screen must
follow this document.

It was built from the code and from a review of the live sites (bracketworks.app logged in with
a loaded tournament, tournamentcentral.app organizer pages, public pages, dialogs, and phone width).

Principle: **one product, one look, nothing extra.** If an element, style, or effect does not
help someone read, decide, or act, leave it out.

All values below are tokens from `packages/ui/styles/tokens.css` and `app-theme.css`. Never
write a raw color, size, or font value; `npm run lint` rejects them.

Visual reference: the "BracketWorks UI Standard" canvas (Foundations, BW dashboard, BW entries,
TC organizer overview, TC find a tournament, shared login, BW brackets, Live View on desktop,
Live View standings and bracket on a phone, and the bracket match component). When this document and a mockup
disagree, this document wins.

## 0. Design direction
- **Look:** a calm, dark, data-first tool. Neutral near-black surfaces, one orange accent, white
  and gray text. It should feel like a precise instrument, not a marketing site.
- **Hierarchy comes from type and space, not color.** Big numbers and titles are white and bold.
  Everything supporting them is gray and smaller. Orange appears only where you can act.
- **Fewer boxes.** One level of cards on the page. Inside a card, rows and dividers do the work.
  Related numbers share one card split by dividers instead of each getting its own tile.
- **Same shell, same anatomy, both products.** A user moving from Tournament Central to
  BracketWorks should only notice the product name and the nav items change.

### App shell (both apps)
Top bar (§8a) → optional page-level `Notice` → page header → `StatGroup` → content → nothing else.
No footers inside the app; public and auth pages get one `body-small` footer line.

### Page anatomy
1. **Header:** `page-title` with an optional status badge beside it; a `body` line of key facts
   (date · place · count); actions on the right (secondary actions, then one primary).
2. **Key numbers:** one `StatGroup` card (3–5 values).
3. **Work area:** a 2/3 + 1/3 grid on desktop. The main column holds the primary task (table,
   form, progress). The side column holds the next step, details, and a "Manage" list.
4. **History:** an `ActivityList` card at the bottom, when the page has one.
At ≤1023px the side column moves under the main column.

### Brand marks
- The product mark (24px) and product name (14px, 700) sit in the top bar only. Large logo
  lockups and taglines do not appear inside the app.
- Login and signup show the 28px mark above one centered card, max width `--size-md` (448). No
  feature lists, side-by-side marketing panels, or illustrations.
- Login and signup are one shared design; only the product name, tagline, and cross-link differ.

---

## 1. Hard rules

1. **No cards inside cards.** Inside a card, group content with spacing or a 1px divider.
   Modals and drawers count as cards: no cards inside them either.
2. **No gradients.** This covers backgrounds, text, borders, progress bars, and charts.
3. **No decorative effects.** That means no shadows on cards, buttons, or badges; no glows,
   `backdrop-filter`, `filter: drop-shadow/blur`, or `text-shadow`; no hover lifts (`translateY`)
   or scaling. The one exception is the overlay shadow in §8.
4. **No hardcoded values.** Use tokens for colors, sizes, spacing, radii, font sizes, z-index,
   and icon sizes.
5. **Use one of the defined styles.** Every piece of text is one of the roles in §2, every
   surface one of §5, every control one of §6. If nothing fits, propose a new role rather than
   inventing a one-off.
6. **Shared components first.** Use the shared primitives (§10). If a pattern repeats in two
   places, it becomes a shared component.
7. **Accent orange is for action and state only:** primary and accent-outline buttons, links,
   the active or selected item, focus rings, and eyebrows. Never use it for decoration, titles,
   headline words, icon backgrounds, borders around cards, or large fills.
8. **No decorative icons.** Do not put icons in tiles, circles, or boxes, and do not add icons
   to section titles. Use icons only where they carry meaning: buttons, inputs, navigation,
   status, and empty states (§11).
9. **Marketing, login, and signup pages follow the same rules.** That means no display-size
   headlines (the largest text is `page-title`), no two-color headlines, no glowing or orange-bordered
   panels, and no feature tiles with icon boxes.

---

## 2. Typography

Font: `--font-family-primary` (Inter stack). Monospace only for codes and IDs: `--font-family-code`.

Each role is a token: write `font: var(--type-<role>)` (for example `var(--type-section-title)`).
Overline also needs `letter-spacing: var(--type-overline-tracking)` and `text-transform: uppercase`.

Weights: **400 regular, 600 semibold, 700 bold. Nothing else** (no 500/650/750/800/850/900).

| Role | Use for | Size | Weight | Line height | Case and tracking | Color |
|---|---|---|---|---|---|---|
| `page-title` | One per page (h1) | `--font-size-4xl` (24) | 700 | 1.2 | Sentence, 0 | text-primary |
| `section-title` | Card and modal titles (h2) | `--font-size-xl` (16) | 700 | 1.3 | Sentence, 0 | text-primary |
| `subsection-title` | Groups inside a card (h3) | `--font-size-md` (14) | 600 | 1.4 | Sentence, 0 | text-primary |
| `body` | Paragraphs and descriptions | `--font-size-base` (13) | 400 | 1.5 | Sentence, 0 | text-secondary |
| `body-small` | Helper text, meta, timestamps | `--font-size-sm` (12) | 400 | 1.45 | Sentence, 0 | text-secondary |
| `label` | Form labels, field names | `--font-size-sm` (12) | 600 | 1.3 | Sentence, 0 | text-primary |
| `overline` | Eyebrows, stat labels, table headers | `--font-size-xs` (11) | 600 | 1.2 | UPPERCASE, 0.08em | text-secondary (eyebrow: accent) |
| `stat` | Key numbers | `--font-size-5xl` (28) | 700 | 1.1 | 0, tabular-nums | text-primary |
| `table` | Table cell text | `--font-size-base` (13) | 400 | 1.4 | 0 | text-primary; secondary columns text-secondary |
| `button` | Button and tab text | `--font-size-base` (13) | 600 | 1 | Sentence, 0 | per variant |
| `badge` | Status pills | `--font-size-xs` (11) | 600 | 1 | Sentence, 0 | status color |

Rules:
- Exactly one `page-title` per page. Titles never use the accent color.
- No negative letter-spacing, no all-caps titles. Uppercase is only for `overline`.
- Numbers in tables and stats use `font-variant-numeric: tabular-nums` and are right-aligned in tables.
- Use `...` and icons in UI text, not `…`, `→`, or `✓` (lint rule `no-symbol-ui-text`).

## 3. Color

| Purpose | Token | Use |
|---|---|---|
| Page background | `--bw-page` | The app background only |
| Card / modal surface | `--bw-surface-card` | Every card, modal, drawer, menu |
| Inset / hover surface | `--bw-surface-panel` | Hovered rows, selected rows, input backgrounds |
| Default border | `--bw-border-subtle` | Cards, dividers, table rows |
| Control border | `--bw-border-card` | Inputs, secondary buttons |
| Primary text | `--bw-text-title` | Headings, values, table text |
| Secondary text | `--bw-text-body` | Body, helper, labels of lesser weight |
| Disabled text | `--color-text-disabled` | Disabled controls only, never meaningful text |
| Accent | `--color-accent-primary` / `-hover` | See rule 1.7 |
| Status | `--color-success`, `--color-warning`, `--color-danger`, `--color-info` | Conveying state only |

- **Two text colors only:** primary and secondary. Do not use a third, fainter gray for real
  content, because it fails contrast.
- Status color always comes with words or an icon. Never use color alone.
- Tints use `color-mix(in srgb, var(--color-*) 12%, transparent)`. That is the only translucency allowed.
- The extended TC palette (`--color-status-*`, `--color-accent-bright`, and so on) is legacy.
  New work uses the four status tokens above.

## 4. Spacing

All spacing uses `--space-*` (N × 4px). The standard gaps:

| Relationship | Token |
|---|---|
| Icon to text | `--space-2` (8); in badges `--space-1-5` (6) |
| Title to its subtitle / description | `--space-1` (4) |
| Label to its input | `--space-1-5` (6) |
| Field to field, row to row inside a card | `--space-4` (16) |
| Buttons in a group | `--space-2` (8) |
| Card header to card body | `--space-4` (16) |
| Card to card, section to section | `--bw-stack-gap` (16 desktop / 12 mobile) |
| Page header to first content | `--space-6` (24) |
| Page edge (gutter) | `--bw-page-gutter` (responsive: 12 / 20 / 24 / 28) |

## 5. Surfaces

### Card (the only container style)
- Background `--bw-surface-card`, border `1px solid var(--bw-border-subtle)`, radius `--radius-xl` (16).
- Padding `--space-5` (20). Dense data card: `--space-4` (16). Mobile (≤767px): `--space-4`.
- No shadow, no gradient, no accent border, no colored left rail.
- Structure: optional header (`section-title`, optional `body-small` description, actions on the
  right) → body. Separate groups inside a card with spacing, or with a
  `1px solid var(--bw-border-subtle)` divider and `--space-4` above and below.
- Interactive card (whole card is a link): hover changes the border to `--bw-border-card` only.

### Page
- Content max width `--size-10xl` (1440), centered, with `--bw-page-gutter` sides.
- Forms and reading pages: max width `--size-4xl` (768).
- Page header: `page-title`, optional `body` description below (`--space-1`), and page actions on
  the right (wrap below on mobile). `--space-6` before the content.
  - An optional `overline` above the title names the parent area (for example
    "Tournament registrations"). Use it only when it adds context, never as decoration.
  - The header sits directly on the page background: no card around it and no divider line under it.
  - "Back" links go in the header actions as a secondary button with an arrow icon.
- Layout is cards on the page background in a grid or stack with `--bw-stack-gap`.
- Key numbers for the page appear once, directly under the header, as one `StatGroup` card.
  Do not repeat the same numbers elsewhere on the page.

### Notice (callout)
- For page-level messages (for example "Development preview") and inline attention items
  ("Registration closes in 3 days").
- Tinted background `color-mix(in srgb, var(--color-<status>) 12%, transparent)`, no border,
  radius `--radius-lg`, padding `var(--space-3) var(--space-4)`.
- Layout: status icon (`ICON_SIZE.md`, status color), message in `body` (text-primary), and an
  optional ghost or link action on the right.
- A notice is not a card, so it may sit inside a card. Do not stack more than three; if there are
  more, use a list.

## 6. Controls

| Control | Height | Padding | Radius | Text |
|---|---|---|---|---|
| Button (default) | `--control-height` (38) | `0 var(--space-4)` | `--radius-md` (8) | `button` role |
| Button small | `--control-height-sm` (32) | `0 var(--space-3)` | `--radius-md` | `button` role |
| Input / select | `--control-height` (38) | `0 var(--space-3)` | `--radius-md` | 13px (`--font-size-base`, same as body); 16px at ≤767px |
| Textarea | min 96px (`--space-24`) | `var(--space-2-5) var(--space-3)` | `--radius-md` | 13px (`--font-size-base`) |
| Badge | `--space-6` (24) | `0 var(--space-2-5)` | `--radius-full` | `badge` role |


Button variants (use exactly these):
- **Primary:** solid `--color-accent-primary` with `--color-on-accent` text (near-black). White
  text on this orange is about 2.6:1 contrast and fails WCAG AA; near-black is about 8:1.
  One per card or modal, at most one or two per page.
- **Accent outline:** transparent, `1px solid var(--color-accent-primary)`, accent text. The
  important alternative to the primary action, such as "Register" beside "View details" or
  "Create a free account" under "Log in". At most one per card or modal, and never on its own
  without a primary nearby. Exception: in a list of results, each row's main action (for example
  "Register") is accent outline and the row's other action is secondary, so that a list never
  shows a stack of solid orange buttons.
- **Secondary:** transparent, `1px solid var(--bw-border-card)`, primary text.
- **Ghost:** no border or background, secondary text; for low-priority and icon-only actions.
- **Danger:** solid `--color-danger-strong`, white text (about 5:1), used only for the destructive confirmation itself.
- Hover changes color or background only. Disabled: `opacity: 0.5`, `cursor: not-allowed`.
- Icons in buttons are `ICON_SIZE.md` (16), placed before the label. Exception: "Next" and "Continue"
  put an arrow icon after the label.
- Action rows (Quick Actions and toolbars): one primary for the most likely next step; every
  other action is secondary. A row of several orange buttons is not allowed.
- Admin or destructive actions in a list or menu are ghost buttons with `--color-danger` text
  and icon. The solid danger button appears only in the confirmation dialog. No "!" markers.

### Segmented control
- For 2–5 mutually exclusive options (filters such as "Upcoming / This weekend / Past", and
  choices such as "Email / Phone / Either" or "Search / Enter manually").
- Container `--bw-surface-panel`, radius `--radius-md`, padding `--space-0-5`. Options use the
  `button` role in text-secondary. The selected option gets `--bw-surface-card` and text-primary.
  No orange fill, no borders between options.
- Counts inside options (for example "Handicap 20") use text-secondary after the label.

### Progress bar
- Native `<progress>`: height `--space-1-5` (6), radius `--radius-full`, track `--bw-surface-panel`,
  fill solid `--color-accent-primary` (or `--color-success` at 100%). No gradient.
- Always paired with a text value ("21 of 32 scored").

Inputs: label above (`label` role), helper or error text below (`body-small`; errors in
`--color-danger` with an icon). Focus shows `border-color: var(--color-accent-primary)` plus
`box-shadow: var(--focus-ring)`. Placeholder text is never the only label.

Forms:
- Labels always go above the field, in sentence case. Never use left-side labels or uppercase labels.
- Mark only optional fields, with "(optional)" after the label in text-secondary. No asterisks
  and no "Required" tags.
- Fields use a 2-column grid on desktop (`--space-4` gap) and 1 column at ≤767px. Short related
  fields (first and last name, start and end date) share a row.
- A long form is one card per step or topic. Groups inside it get a `subsection-title`, separated by
  a divider. Never use sub-cards.
- Form actions sit at the bottom right: Cancel (secondary), then Save (primary). Autosave status
  is `body-small` text, not a badge.
- Number steppers use secondary small buttons, not orange.

Badges: tinted background (`color-mix` 12%) plus status text color, no border, no uppercase.
Neutral badge: `--bw-surface-panel` background with secondary text.

## 7. Tables and lists
- A table sits directly in a card with no inner card. Header cells use the `overline` role and
  the secondary color. Body cells use the `table` role.
- Cell padding `var(--space-3) var(--space-4)`. Rows are separated by a 1px `--bw-border-subtle`
  divider. No zebra stripes, no vertical borders.
- Row hover and selected row: `--bw-surface-panel` background. Selection is also shown by a
  checked checkbox or a status, never by a colored accent bar.
- Numeric columns are right-aligned with tabular numbers. Row actions are ghost icon buttons in
  the last column.
- Lists inside cards follow the same row pattern (divider rows, no boxed items).
- Each row shows at most one visible action (for example "Manage" as accent outline). Every other
  row action, including destructive ones, goes in a "More actions for <name>" `Menu` (a "⋯"
  ghost icon button). A disabled menu item explains why with a `MenuNote`. Never a column of red
  Delete buttons.
- Table toolbar, above the table inside the same card: search input (fills the row), then
  filter selects, then a secondary action (Export). Gap `--space-2`. Primary actions such as
  "Manual registration" go in the card header, not the toolbar.
- Editable tables (scores, entries): cell inputs use the compact height `--control-height-sm` (32)
  and are right-aligned for numbers. Do not highlight whole columns. Emphasize a totals column
  with weight 700 only.
- Pagination, bottom of the card: "Showing 1–25 of 140" in `body-small` on the left, and
  page buttons on the right as ghost small buttons. The current page gets `--bw-surface-panel` and
  text-primary, not solid orange. "Rows per page" select goes on the far right.
- Activity and history lists: divider rows with the title in `subsection-title`, details in
  `body-small`, and the timestamp right-aligned in `body-small`. A reason or note is a
  `body-small` line ("Reason: corrected score"), not a boxed panel with a colored rail.
- Bracket matches are the one boxed data element allowed inside a card: `1px solid
  var(--bw-border-subtle)`, radius `--radius-md`, no fill or tint. Each player is a row. The
  winner is text-primary 700 with a success check icon; the other player is text-secondary. Round
  titles use `overline`. Connector lines are `--bw-border-subtle`.

## 7a. Brackets and Live View
These are the product's showcase pages. They use the same shell and components as every other
page, plus the bracket pieces below.

**Bracket match** (one shared component, used by the organizer Brackets page and Live View):
- Box: `1px solid var(--bw-border-subtle)`, radius `--radius-md`, `--bw-surface-card`, no tint or rail.
- Header row: match name in `overline` ("Match 1", "Semifinal 1", "Final"), winning margin
  ("+35") in `body-small` on the right, then a divider.
- Player rows: name, then score right-aligned in tabular numbers. Winner: text-primary, weight 700,
  with a success check icon (`ICON_SIZE.sm`, labelled "Winner"). Other player: text-secondary,
  weight 400. No "vs" label.
- Highlighted bowler: the row background is `--bw-surface-panel`. Never orange.

**Bracket tree** (desktop): columns for Quarterfinals, Semifinals, Final, and Champion, each titled
in `overline`. Connector lines are 1px `--bw-border-subtle`. The champion column shows a success
trophy icon, the name in `section-title`, and "Won the final 214 to 191" and the runner-up in
`body-small`. No winner banner.

**Organizer Brackets page:**
- Header badge shows bracket status. When entries changed after generation: a warning `Badge`
  ("Out of date"), a warning `Notice` explaining it, and "Regenerate brackets" as the page's
  primary action.
- `StatGroup`: brackets, bowlers, completion, payout split.
- One card: program `SegmentedControl` with counts (All, Handicap, Scratch, ...), a bracket picker
  (previous / select / next), "Highlight a bowler" search, then the tree.
- Destructive admin actions (Delete all brackets) are a danger link at the bottom of the page.

**Live View (public):**
- Top bar nav items are the views: **Standings**, **Brackets**, **Side pots**. Share is a
  secondary button with an icon. No large logo lockup or "Public tournament view" eyebrow.
- Header: tournament name, status badge, and a `body` line (date · center · bowlers). "Updated
  8:08 AM · auto-refresh on" in `body-small` and a ghost Refresh button sit on the right.
- `StatGroup`: bowlers, brackets, high game.
- Standings: one table card. Columns "#", "Bowler", "After game 1", "After game 2", "1st or 2nd"
  (phone: "G1", "G2", "Top 2"). All numbers text-primary, zeros text-secondary, last column
  weight 700. Never orange numbers. "Find a bowler" filters the rows.
- Side pots: one card, one subsection per pot: place badge (neutral), bowler, score, then
  "10 entries · $40 pool" in `body-small`.
- Footer: one `body-small` line, "Powered by BracketWorks".

**Live View on a phone (≤767px):**
- Compact top bar (56px): mark, product name, and an icon-only Share button (44px target).
- The three views become a full-width segmented control, 40px tall.
- Search and selects are 44px tall with 16px text.
- Brackets: "Program" and "Bracket" selects with previous and next buttons, then one card with the
  champion first, a divider, and the rounds stacked **Final, Semifinals, Quarterfinals**.

## 8. Overlays (modal, drawer, menu, toast)
- Same surface as a card (`--bw-surface-card`, `--bw-border-subtle`), radius `--radius-2xl` (20) for
  modals and `--radius-lg` (12) for menus and toasts.
- Widths: small `--size-md` (448), default `--size-xl` (576), large `--size-4xl` (768).
- Padding `--space-6` (24). Header (`section-title` plus a close ghost icon button), body, and a
  footer with actions right-aligned (secondary, then primary).
- Backdrop: `color-mix(in srgb, var(--color-bg-primary) 80%, transparent)`. **No blur.**
- Shadow: `--elevation-modal` for modals and `--elevation-2` for menus and toasts. These are the
  only shadows in the product.
- Layering uses the `--z-*` tokens only.

## 8a. Navigation
- **Top bar:** product name or logo on the left, then the current tournament (name in `label`,
  date in `body-small` text-secondary), with nav items centered or after them and account controls
  on the right. Background `--bw-page`, 1px `--bw-border-subtle` bottom border, height `--space-16` (64).
- **Nav items:** `button` role, text-secondary. Hover: text-primary. Active: text-primary on
  `--bw-surface-panel`, radius `--radius-md`. No orange outline pill.
- Below 1024px the nav items collapse into a "Menu" disclosure (44px target) so the top bar
  never scrolls sideways.
- **Side navigation** (setup steps, settings sections): a plain vertical list on the page, not in
  a card. Items are `button` role in text-secondary, the active item is text-primary on
  `--bw-surface-panel`, and step status ("Optional", "Ready") is `body-small` under the label.
  No colored rail.
- **Avatar:** 32px (`--space-8`) circle, `--bw-surface-panel` background, initials in `badge` role
  text-primary. No colored border.

## 9. Motion
- Transitions are only for `color`, `background-color`, `border-color`, and `opacity`, using
  `--motion-duration-fast` (120ms) or `-base` (180ms) and `--motion-ease-standard`.
- Animations are only for loading indicators (spinner, skeleton) and an overlay fade-in (opacity).
- Never animate position or size on hover. Never use `transition: all`.
- Wrap any animation in `@media (prefers-reduced-motion: no-preference)`.

## 10. Shared components
Import everything from `@bracketworks/ui`. Source: `packages/ui/src/components`. Tests:
`apps/tournament-central-web/components/sharedUi.test.tsx`. BW's `app/components/primitives`
is replaced by these during the migration.

| Component | Use |
|---|---|
| `Page` (`width="narrow"` for forms), `PageColumns` (`main`, `side`) | Page width, gutters, card spacing, and the 2/3 + 1/3 layout |
| `PageHeader` (`title`, `overline`, `badge`, `description`, `actions`) | The page's single h1 and its actions |
| `StatGroup` (`items`, `label`) | A page's key numbers: one card split by dividers |
| `Card` (`padding="default"`, `"dense"`, or `"flush"`, `interactive`), `CardHeader`, `CardDivider` | The only container; `flush` lets a table run edge to edge |
| `Button` (`primary` / `accent-outline` / `secondary` / `ghost` / `ghost-danger` / `danger`, `size="sm"`, `icon`, `iconPosition`) | All buttons |
| `ButtonLink`, `buttonClassName()` | A link that looks like a button; use `buttonClassName()` on Next.js `<Link>` |
| `TextField`, `SelectField`, `TextAreaField` (`label`, `optional`, `helper`, `error`, `fullRow`, `hideLabel`), `FormGrid` | Form fields and their 2-column layout; `hideLabel` only in table toolbars |
| `CheckboxField` (`label`, `helper`) | A checkbox with its label on the right, for agreements and on/off options |
| `PasswordField` (same props as `TextField`) | A password input with a Show/Hide toggle inside it |
| `SearchField` | Search input with icon (label is screen-reader-only by default) |
| `SegmentedControl` | Filters and exclusive choices |
| `Badge` (`neutral` / `success` / `warning` / `danger` / `info` / `accent`) | All status pills |
| `Notice` (`info` / `success` / `warning` / `danger`, `action`) | Page and inline messages |
| `ProgressBar` (`value`, `max`, `label`, `valueText`) | Completion with a text value |
| `DataTable`, `TableToolbar`, `Pagination`, `SortableHeader` | Tables in cards: cells take `data-align="right"`, `data-tone="secondary"`, `data-emphasis="true"` |
| `Modal` (`size`, `footer`, `role="alertdialog"`, `dismissible`), `ConfirmDialog` (`tone="danger"`, `busy`, `error`) | All overlays |
| `Menu`, `MenuItem`, `MenuDivider`, `MenuStatus`, `menuItemClassName()` | Account and overflow menus |
| `useModalFocus` | Focus, Escape, and scroll lock for any custom modal surface (drawers); one shared stack |
| `EmptyState` | No-data states: icon `ICON_SIZE['2xl']`, `section-title`, `body`, one action |
| `ActivityList` | History and audit rows |
| `TopNav`, `TopNavBrand`, `topNavBrandClassName()`, `NavItem`, `navItemClassName()`, `SideNav`, `sideNavItemClassName()` | App navigation |
| `Avatar` | User initials |
| `BracketMatch`, `BracketTree` (`layout="tree"` or `"stacked"`, `champion`, `onPlayerClick`) | Bracket boxes and tree for the Brackets page and Live View (§7a) |
| `ICON_SIZE` | Every icon size |

If a screen needs something this list does not cover, add it to `packages/ui` first, with a test,
and then use it. Do not build a one-off in an app.

## 11. Icons
- Lucide only. Size is always from `ICON_SIZE`: `md` (16) default, `sm` (14) in badges and dense
  rows, `'2xl'` (24) in empty states.
- Never place an icon on a tile, circle, or tinted box. Section titles and stat labels get no icons.
- Icons are not colored by category (no orange, blue, green, and purple icons in a row).
  They inherit the text color, except status icons, which use the status color.
- Icon color inherits the text color. Decorative icons get `aria-hidden="true"`; icon-only buttons
  get an `aria-label`.

## 12. Responsive and accessibility
- Tiers: phone ≤767px, tablet 768–1023px, desktop ≥1024px; 640px for stacking controls full width.
- On phones: card padding `--space-4`, page actions and button groups stack full width, inputs use
  16px text, and touch targets are at least `--touch-target-comfortable` (44).
- Every interactive element shows `:focus-visible` (global focus ring). Do not remove outlines.
- Text contrast is at least 4.5:1. Only the two text colors in §3 qualify.

---

## Build checklist (run before calling any UI work done)
1. Every text element maps to a §2 role, and the page has exactly one `page-title`.
2. No card inside a card or modal.
3. No gradient, shadow (outside §8), blur, glow, lift, or scale.
4. Only tokens for colors, sizes, spacing, radii, z-index, and icons (`npm run lint` passes).
5. Uses the shared components from §10, with no local copy of a shared pattern.
6. At most one primary button per card or modal, and accent orange only per rule 1.7.
7. No icon tiles, no icons in titles, and no category-colored icons (rule 1.8).
8. Checked at 375px, 768px, and 1280px widths.

## What this changes today (measured, for the migration after approval)
| Item | Count now |
|---|---|
| Gradients | 93 |
| Decorative box-shadows | ~485 |
| `backdrop-filter` blur | 55 |
| Glow / drop-shadow filters, text-shadow | ~66 |
| Hover lifts and scales | ~80 |
| Nested-card selectors | ~67 |
| Off-standard font weights (500/650/750/760/800/850/900) | ~342 |
| Card titles in use | 6+ sizes, 5 weights → 1 style |
| Card radii in use | 4 → 1 (`--radius-xl`) |

Seen on the live sites, by page (the migration targets):
| Page | Main fixes |
|---|---|
| BW home, BW and TC login and signup | Display headlines and two-color headlines down to `page-title`; remove glowing orange panel borders and feature icon tiles |
| BW dashboard | Orange uppercase section titles to `section-title`; stat tiles to one `StatGroup`; activity "reason" boxes to text; Archive and Unload to ghost danger; entry breakdown tiles out of the card |
| BW entries | Add Bowler: remove 3 levels of sub-cards and uppercase labels; Quick Actions: one primary, rest secondary; stat tiles to `StatGroup` |
| BW scores | Six orange Quick Actions buttons to one primary plus secondary; no highlighted Final total column; badges in sentence case |
| BW brackets | Match boxes per §7; filter chips to `SegmentedControl` |
| BW payouts (empty) | 48px headline and step cards to `EmptyState` |
| BW settings | Left-side labels to labels above |
| BW tournament directory | Three nested card levels to one card with divider rows; remove stat tile bars |
| Switch Tournament dialog | Bordered list items to divider rows |
| TC home | Featured tournament card out of its panel; filter chips to `SegmentedControl` |
| TC organizer dashboard and payments | Remove colored icon tiles from stat cards; stat cards to `StatGroup` |
| TC overview | Tiles inside the overview card to `StatGroup` and divider rows |
| TC setup | Sub-cards inside the details card to subsections; uppercase labels and asterisks to the §6 form rules; gradient progress bar to solid; side nav per §8a |
| All pages | Nav active pill to the §8a style; heavy button text to 600 |
