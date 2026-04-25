# Render Database Reset Runbook

This runbook wipes the production database and rebuilds it from the single baseline migration.

Use this only after confirming you want to destroy all existing production data.

## Target Services

- Backend service: `bracketworks-backend-final`
- Render Postgres connection source: `DATABASE_URL`
- Backend working directory in Render shell: `/opt/render/project/src/backend`

## Preconditions

1. Confirm the code currently deployed includes the cleaned single-head Alembic baseline.
2. Confirm you are resetting the correct Render environment.
3. Create a manual database backup in Render before running any destructive command.
4. Make sure no one is actively using the app during the reset window.

## Render Click Path

1. Open the Render dashboard.
2. Open the web service `bracketworks-backend-final`.
3. Open `Shell` for that service.
4. In a separate browser tab, open the linked Postgres instance and create a manual backup.

## Exact Commands

Run these commands in the Render backend shell exactly in this order:

```bash
cd /opt/render/project/src/backend
echo "$DATABASE_URL"
psql "$DATABASE_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
alembic upgrade head
psql "$DATABASE_URL" -c '\dt'
psql "$DATABASE_URL" -c 'SELECT version_num FROM alembic_version;'
```

## Expected Results

- `DROP SCHEMA ... CREATE SCHEMA ...` completes without error.
- `alembic upgrade head` reports upgrade to `0001_clean_schema_baseline`.
- `\dt` lists the new tables, including:
  - `alembic_version`
  - `users`
  - `tournaments`
  - `tournament_squads`
  - `tournament_players`
  - `tournament_bracket_settings`
  - `player_scores`
  - `bracket_snapshots`
  - `bracket_winners`
  - `bracket_payouts`
  - `tournament_payout_summaries`
  - `first_round_matchup_history`
- `SELECT version_num FROM alembic_version;` returns `0001_clean_schema_baseline`.

## Immediate Post-Reset Checks

1. Restart the backend service from Render after the migration finishes.
2. Open the backend health or docs endpoint and confirm the service boots cleanly.
3. Sign in to the app and create a test tournament.
4. Save bracket settings.
5. Add a test player.
6. Enter test scores.
7. Generate brackets and confirm data persists.

## If Something Fails

- If the schema drop fails: stop and inspect whether you are connected to the correct database.
- If `alembic upgrade head` fails: do not rerun random migrations. Fix the failing migration in code first, redeploy, and rerun from an empty schema.
- If the app boots but API calls fail: inspect Render logs for missing environment variables or mismatched payload assumptions.

## Rollback Position

There is no in-place rollback after the schema drop.

Recovery path:

1. Restore the manual Render backup you created before starting.
2. Repoint the app to the restored database if Render creates a new instance or connection string.
3. Restart the backend service.

## Operator Notes

- This repo now uses a safe local default in `backend/alembic.ini`; production migration targeting depends on `DATABASE_URL` in Render.
- This reset is destructive by design. Do not run it from a local shell unless you have intentionally set `DATABASE_URL` to the production database.