# UI Primitives

These components provide shared card/anatomy/state patterns for the BracketWorks UI modernization effort.

## Components
- Card
- CardHeader
- CardBody
- CardFooter
- DataTableToolbar
- SectionHeader
- EmptyState
- StatusPill
- QuickActions

## Usage
Import from:

```ts
import { Card, CardHeader, CardBody, DataTableToolbar, EmptyState, QuickActions, SectionHeader, StatusPill } from '@/app/components/primitives';
```

## Notes
- Variants are token-driven (`primary`, `secondary`, `utility`).
- Focus, motion, and contrast behavior are controlled by global tokens and media queries.
