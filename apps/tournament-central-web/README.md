# Tournament Central

Tournament Central is a lightweight Next.js starter for BracketWorks tournament discovery, creation, and registration flows.

## Development

- Install dependencies from the repository root with `pnpm install`.
- Start the app with `pnpm dev:tournament-central` (port 3001).
- Validate with `pnpm quality:tournament-central`.
- Run backend tests with `pnpm test:api`.

## Dates and registration deadlines

Use [the shared calendar-date utilities](./lib/tournamentDates.ts) for tournament
dates on public and organizer surfaces. Date-only database values are parsed as
local calendar dates, not UTC instants. Same-calendar-day ranges collapse to one
date. Legacy display strings are normalized for display without rewriting data.

The client and API validate registration windows on both draft saves and
publication. Opening must be on or before closing, and closing must be on or
before the final tournament day. The current schedule model has no tournament
end-time field, so a deadline through 23:59 on the final day is valid, in the
tournament's configured timezone. Incomplete drafts are still supported, but
provided dates and times must be valid.

No schema migration or automatic data cleanup is required. Existing invalid
windows remain visible as inline organizer errors and block saving/publishing.
Organizers should review and correct the intended deadline in Tournament Details;
do not truncate deadlines automatically or change tournament dates to hide errors.
For older published tournaments, review both the editable draft and the last
published snapshot, then publish the corrected configuration.

Featured cards show the published registration deadline from the directory API;
they do not manufacture a closing date or infer that registration is open merely
because a registration URL exists.

## Public information and accessibility

Public tournament details use the published setup snapshot for events, scoring
format, divisions, prices, contact information, and registration deadlines.
Squad availability counts bowlers in pending/confirmed relational entries, excluding
cancelled and waitlisted entries. Rules, flyers, oil patterns, entry forms, and
notices are downloadable only while the tournament is public and published.
Unclassified `other` documents are not exposed publicly.

Public and organizer navigation share session-change notifications, restore
cookie-backed sessions on fresh-tab navigation, and revoke the backend session
on sign-out. Access tokens remain in session storage, not local storage.

Discovery filters wrap with 44px touch targets. Public and organizer dialogs
share focus trapping, Escape handling, and trigger-focus restoration. Organizer
tables expose keyboard-focusable horizontal-scroll regions on narrow screens.

Regression tests cover date ranges in six U.S. time zones, deadline rejection
before client requests and by the API, session navigation states, filter keyboard
operation, public information/downloads, and tournament-dialog keyboard behavior.
