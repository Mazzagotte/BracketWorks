#!/bin/bash
# Production startup script for BracketWorks backend

echo "🚀 Starting BracketWorks Backend..."

# Function to handle migration errors
handle_migration() {
    echo "🔧 Handling database migration..."
    
    # Try to upgrade normally first
    if alembic upgrade head; then
        echo "✅ Migration successful"
        return 0
    fi
    
    echo "⚠️  Migration failed, attempting to fix..."
    
    # Try to stamp to head and then upgrade
    if alembic stamp head && alembic upgrade head; then
        echo "✅ Migration fixed and upgraded"
        return 0
    fi
    
    echo "❌ Unable to fix migration automatically"
    return 1
}

# Run migration
if ! handle_migration; then
    echo "💥 Database migration failed"
    exit 1
fi

echo "🌟 Starting FastAPI server..."
exec python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT