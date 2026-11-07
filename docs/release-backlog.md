# Release backlog

Things to build or decide before release. Check items off (or delete them) as they're done.
Last updated 2026-11-07.

---

## 1. Emails and templates

Every email the platform sends or should send. "Template" means a designed email in Resend.
Emails marked **plain** are sent today with a simple built-in layout and need a designed template.

### Sent today

| Email | Sent when | To | Template |
|---|---|---|---|
| Reset password | Someone asks to reset their password | Account holder | `reset-password` |
| Verify email | Account created or email changed | Account holder | `verify-email` |
| Welcome | Email verified | Account holder | `welcome-email` |
| Password changed | Password changed | Account holder | `password-change` |
| Email changed | Account email changed (sent to the old address) | Account holder | `email-change` |
| Tournament staff invite | Organizer invites a co-organizer or staff | Invitee | `tournament-staff-invite` |
| Registration confirmation | Bowler registers on the public page, staff enter a manual registration, or organizer picks "Resend confirmation" | Registration contact and bowlers | **plain** (setting `TC_REGISTRATION_CONFIRMATION_TEMPLATE_ID`) |
| Moved off the waitlist | Organizer picks "Move off waitlist" with "Notify by email" on | Registration contact and bowlers | **plain** (setting `TC_WAITLIST_PROMOTION_TEMPLATE_ID`) |
| Message from the organizer | Organizer uses "Email bowlers" (everyone, a squad, unpaid, or waitlisted) | Each person, one email each | **plain** (organizer writes the text; needs a branded wrapper) |

Variables the confirmation and waitlist templates receive: tournament_name, tournament_dates,
tournament_location, organizer_name, organizer_email, first_name, confirmation_code, status, total, entries.

### Not built yet

- [ ] **Added to the waitlist**: bowler registers for a full squad. To the bowler.
- [ ] **Registration cancelled**: organizer cancels or deletes an entry. To the bowler.
- [ ] **Entry changed**: organizer moves a bowler to another squad, event, or division. To the bowler, with the new squad time.
- [ ] **Payment received**: organizer marks a registration paid (a receipt). To the registration contact.
- [ ] **Payment reminder**: unpaid registrations, a set number of days before the event. To the registration contact. (Organizer can already do this by hand with "Email bowlers" > Unpaid.)
- [ ] **Event reminder**: 1 to 2 days before, with squad time, check-in time, location, and what to bring. To each bowler.
- [ ] **New registration**: someone registers (or a daily digest). To the organizer, opt-in.
- [ ] **Registration closing soon**: a few days before the deadline. To the organizer.
- [ ] **Results are posted**: after the event, with a link to standings and brackets in BracketWorks. To each bowler.
- [ ] **Refund recorded**: once online payments exist. To the registration contact.

---

## 2. Decisions needed

- [ ] **Online payments.** Who receives the money: each organizer's own Stripe account (Stripe Connect) or one BracketWorks account? Who pays processing fees: the bowler, as a fee on top, or the organizer?
- [ ] **Email sending setup.** `RESEND_API_KEY` must be set and `FROM_EMAIL` must be on a domain verified in Resend. Confirm the Resend plan allows batch sends of up to 500.
- [ ] **Staff-entered registrations.** Today a manual registration emails the bowler a confirmation, the same as a public one. Keep that, or make it a checkbox?
- [ ] **Bulk email limits.** Add a cooldown or a daily cap per tournament? Keep a history of sent messages in the app (today it's only in the server log)?
- [ ] **Moving bowlers after sending to BracketWorks.** Today the bowler is added to the new BracketWorks squad and the old row is listed for the organizer to remove, so scores never move. Should moves carry over automatically when no scores exist yet?
- [ ] **Which registrations go to BracketWorks.** Confirmed only by default, with pending as an option. Is that right?
- [ ] **Division mapping to BracketWorks.** Only names that clearly mean Men, Women, Senior, or Junior carry over. Others (for example "Handicap A") don't. Decide how custom divisions map.
- [ ] **Links in emails.** Emails can't link to a tournament page yet because the public tournament URL (slugs) is unfinished.
- [ ] **"Open in BracketWorks"** opens the BracketWorks home page, not the tournament. Add a direct tournament link in BracketWorks?
- [ ] **Check-in default squad** uses the organizer's device time, not the tournament's timezone. Fine for in-person use; confirm.
- [ ] **Required fees now charge every registration.** Fees marked required are added to every registration in their scope. Fees saved before side events existed count as one charge per registration. Check any published tournament with required fees before release.
- [ ] **Changing side events after registering.** Organizers can't add or change a bowler's side events on an existing registration yet (bowlers would re-register or pay the difference at the desk). Build an editor?
- [ ] **Assigned average for bowlers without one.** A blank average passes the check when an assigned average is set, but the assigned value isn't saved on the bowler. Save it, or show it only on BracketWorks handoff?
- [ ] **Bowlers with no brackets in BracketWorks.** When a tournament sells brackets, bowlers who bought none are sent with 0 bracket entries. Confirm that's what organizers expect.
- [ ] **History in Tournament Central.** There's no audit log for Tournament Central (check-ins, payment changes, bulk emails). Add one?

## 3. Housekeeping before release

- [ ] **Migrations.** Committed migrations go 0045 > 0048 > 0049. The unfinished SSO work has 0046 and 0047 locally. When SSO lands, add a merge migration (or move 0046 to follow 0049).
- [ ] **Unfinished SSO files** are still untracked and break the Tournament Central typecheck (`components/auth/loginRedirect.ts`). Finish or remove them.
- [ ] **Registration field labels are title case** ("First Name", "USBC Number") in saved setups. Change the defaults to sentence case and update existing setups.
- [ ] **Logged-in pages after the color and CSS cleanup.** BracketWorks admin and the logged-in BracketWorks pages haven't been checked in a browser since the global CSS cleanup.

---

## 4. Tournament types: what to build

Steps 1 to 4 are built (2026-11-07). Step 5 is open.

Goal: an organizer can set up any common tournament type. Tournament Central handles sign-up
(who, what, when, how much, eligibility). BracketWorks runs the day (scores, brackets, finals,
payouts). See the plan below; each step is usable on its own.

### Step 1: Start from a tournament type
- [x] First setup question: "What kind of tournament?" with the common types (handicap singles,
      scratch singles, doubles, scotch doubles, team, Baker team, 9-pin no-tap, sweeper, association
      city/state, senior, youth, pro-am, fundraiser). Picking one fills in events, divisions, fees,
      and questions with typical defaults. Everything stays editable, and "Start blank" is always there.
- [x] Combine types: an association tournament is team + doubles + singles + All Events.

### Step 2: Event rules the organizer can set
Add to each event (today an event has a name, handicap/scratch/no-tap, players per entry, re-entries, and fee):
- [x] **Format**: singles, doubles, scotch doubles, team, Baker team (Baker and scotch change how a game is bowled, not just entry size).
- [x] **Games**: number of games, and blocks for multi-day events.
- [x] **Handicap**: percentage, basis score, maximum handicap, and whether it's per bowler or per pair (scotch).
- [x] **Entering average**: which average counts (highest of current or last season), minimum games, and what to do with no average.
- [x] **Team rules**: mixed doubles (one man and one woman), combined average cap (for example 400 and under), team size.
- [x] **Re-entries**: how many, and whether the best set or every set counts (sweeper).
- [x] **Finals**: none, cut to top N or a percentage, stepladder, match play (single or double elimination), round robin with bonus or Petersen points, or survivor. Shown to bowlers on the tournament page now; run in BracketWorks later.
- [x] **Payout ratio**: 1 in 4 to 1 in 6, shown to bowlers.
- [x] **Age groups**: senior (50+), super senior (65+), youth (under 21) with a "scholarship, not cash" note.

### Step 3: Side events bowlers buy when they register
Today fees are add-ons, but what a bowler picked isn't saved with the registration.
- [x] **Brackets** with a count (for example 5 brackets at $5), scratch or handicap, and the payout
      (for example $30 / $10, or $35 with $5 to the house). The counts carry to BracketWorks
      with "Send to BracketWorks", so the organizer stops copying bracket sheets.
- [x] **Pots**: high game, high series, optional scratch, strike pot, mystery doubles.
- [x] Save each bowler's picks and amounts with the registration, show them on Registrations and Check-in, and include them in totals and payments.

### Step 4: Check eligibility at sign-up
- [x] Average and age limits per division, combined average caps, mixed-doubles makeup, and USBC membership required, all checked on the registration form with a clear message.
- [x] Partners and teams: enter all bowlers on one registration (works today) or "I'll add my partner later".

### Found while setting up the Ada County flyers
- [ ] **Finals notes without a finals format.** Notes such as "Division winners receive paid entry into the Idaho State Senior Tournament" only show on the public page when a finals type is chosen. Show them (as prize notes) even with no finals.
- [ ] **One prize per bowler** across multiple entries ("each bowler may receive only one cash prize") has no setting yet.

### Step 5: Running each format in BracketWorks (separate project)
- [ ] Scoring for Baker and scotch, no-tap scoring, team totals with absent-bowler rules (average minus 10).
- [ ] Cuts, stepladder finals, match play, round robin (bonus pins, Petersen points), survivor.
- [ ] All Events totals, tie and roll-off handling, late arrivals.
