# BracketWorks legal documents

## Current source package

- `BracketWorks_Legal_Documents_v2.4.docx`
- Draft version: 2.4
- Source SHA-256: `A1D47E5B4735F2EB95F3CF52155242DCAFA4EEA667AEE5901865A929DCF1B6CB`
- Repository copy added: August 2, 2026

This DOCX is the source draft for the BracketWorks Terms of Service, Privacy Policy,
Tournament Operator Terms, app-facing disclaimers, and implementation checklist.

## Intended routes

| Document | Intended route | Publication status |
| --- | --- | --- |
| Terms of Service | `/terms` | Awaiting business details and approval |
| Privacy Policy | `/privacy` | Awaiting business details and approval |
| Tournament Operator Terms | `/operator-terms` | Awaiting business details and approval |
| Acceptable Use | `/acceptable-use` | Covered by section 7 of the Terms; decide whether to publish a separate page |

## Required decisions before publication

The source document intentionally contains placeholders and an “Open Business Decisions
Before Publication” section. Do not present the draft as effective legal terms until at least
the following are confirmed:

1. Exact legal entity name, entity type, mailing address, and legal-notice contact.
2. Effective date and public document version.
3. Subscription renewal, cancellation, refund, trial, and failed-payment rules.
4. Post-cancellation export period and deletion/backup-retention periods.
5. Actual infrastructure, authentication, email, monitoring, support, analytics, and payment vendors.
6. Organization ownership and staff-transition behavior that exists in the product.
7. Public treatment of USBC numbers, payouts, and junior-bowler information.
8. Idaho venue and dispute-resolution details.
9. Privacy-request, public-view removal, and junior-bowler removal workflows.
10. Final legal review and approval.

## Product accuracy notes

Before publication, remove or revise clauses describing functionality that is not currently
available in BracketWorks. Examples in the draft include subscriptions and checkout,
organization invitations and staff roles, self-service billing cancellation, payment
processing, configurable junior-bowler privacy controls, and some data-removal workflows.

Published legal pages should be generated from an approved, versioned copy rather than edited
independently in multiple frontend files. Material updates should also update the recurring
legal-disclosure version and content hash.
