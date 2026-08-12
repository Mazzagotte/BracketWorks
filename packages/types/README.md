# @bracketworks/types

Shared TypeScript contracts for data crossing app/package boundaries in BracketWorks.

## What belongs here

- API DTO contracts shared across apps (for example, public directory and auth responses).
- Shared domain contracts used by multiple apps (for example, tournament and squad baseline shapes).
- Integration payload/response contracts between systems (for example, Tournament Central -> BracketWorks import boundaries).

## What does not belong here

- Component-local UI state types.
- Feature-internal view models used by only one app.
- Types that intentionally differ by app context and never cross boundaries.

## Naming guidance

- Use snake_case field names when mirroring backend DTOs.
- Use explicit "Contract" or descriptive boundary names when the type represents a cross-app schema.
- Keep fields optional only when runtime payloads can legitimately omit them.

## DTO vs domain model

- DTO contracts should match backend wire format exactly.
- App-specific domain models may differ, but map explicitly at the app boundary.
- Avoid mutating shared contracts to fit a single app's internal UI convenience type.
