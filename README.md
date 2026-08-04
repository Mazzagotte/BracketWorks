
# BracketWorks

BracketWorks is tournament software for running bowling bracket events. It handles bracket setup, live scoring, and payout review in one place, so you can spend less time managing spreadsheets and more time running the event.

Live app: [https://bracketworks.app](https://bracketworks.app)

---

## What it does

### Brackets
Set up and manage scratch and handicap brackets for your tournament. Brackets advance round by round as scores are entered, and you can run multiple bracket programs in the same event.

## Local development

- Backend: `cd backend && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- Frontend: `cd frontend && npm run dev`
- Or use the launcher: `./start_bracketworks.ps1`

The local stack uses Docker Compose for PostgreSQL and Redis, while the frontend and backend can also be run directly for local development.

### Score Tracking
Enter scores live while the tournament is in progress. Bracket state updates as results come in, and your work is saved so you can pick up where you left off.

### Payouts
BracketWorks calculates payouts from your event settings, including entry fees and prize splits. Review who won what, then export or print results when everything is finalized.

### Player Management
Keep a reusable player history across tournaments. Track entries, results, and payouts over time so you always have a clean event record.

### Public View
Share a read-only tournament link so bowlers and spectators can follow standings and results without creating an account.

### Admin Controls
Directors and admins can manage tournaments, entries, settings, users, and archives from one central admin experience.

---

## Works on any device

BracketWorks is a Progressive Web App. It runs in modern browsers and can be installed on phones and tablets like an app. The UI is built to work at the desk or out at the lanes.

---

## Questions or feedback?

Visit [bracketworks.app](https://bracketworks.app) or contact us through the app.

## Support

For issues or questions, open a repository issue or reach out through [bracketworks.app](https://bracketworks.app).

## License

MIT

---

BracketWorks helps tournament teams run cleaner events from setup to final payout.