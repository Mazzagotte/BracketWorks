#!/bin/bash
# Production startup script for BracketWorks backend

echo "🚀 Starting BracketWorks Backend..."

# Function to run database migrations
handle_migration() {
    echo "Running database migrations..."

    if alembic upgrade head; then
        echo "Migrations completed successfully"
        return 0
    fi

    echo "ERROR: Database migration failed. Manual intervention required."
    echo "Do NOT use 'alembic stamp head' to skip this — it can mask schema drift."
    return 1
}

# Run migration
if ! handle_migration; then
    echo "💥 Database migration failed"
    exit 1
fi

echo "🌟 Starting FastAPI server..."
exec python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT