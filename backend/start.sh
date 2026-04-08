#!/bin/bash
# Production startup script for BracketWorks backend

set -e

echo "Starting BracketWorks Backend..."

# Wait for the database to be reachable before attempting migrations
wait_for_db() {
    echo "Checking database connectivity..."
    local retries=10
    local wait=3

    for i in $(seq 1 $retries); do
        if python -c "
import os, sys
try:
    import psycopg2
    conn = psycopg2.connect(os.environ['DATABASE_URL'], connect_timeout=5)
    conn.close()
    sys.exit(0)
except Exception as e:
    print(f'DB not ready: {e}')
    sys.exit(1)
"; then
            echo "Database is ready."
            return 0
        fi
        echo "  Attempt $i/$retries failed, retrying in ${wait}s..."
        sleep $wait
    done

    echo "Database not reachable after $retries attempts."
    return 1
}

# Run Alembic migration — no auto-recovery to avoid silently skipping migrations
run_migration() {
    echo "Running database migrations..."
    if alembic upgrade head; then
        echo "Migrations applied successfully."
        return 0
    fi

    echo "Migration failed. Check Alembic output above for details."
    echo "If the schema is already current, ensure alembic_version is correct."
    return 1
}

if ! wait_for_db; then
    echo "Cannot connect to database. Aborting."
    exit 1
fi

if ! run_migration; then
    echo "Database migration failed. Aborting."
    exit 1
fi

PORT="${PORT:-8000}"
echo "Starting FastAPI server on port $PORT..."
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
