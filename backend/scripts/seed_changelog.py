#!/usr/bin/env python
"""Seed changelog entries to the database"""

import os
import sys
from datetime import datetime, timezone

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.core.database import SessionLocal, engine
from app.core import models

def seed_changelog():
    """Seed initial changelog entries"""
    db = SessionLocal()
    
    try:
        # Check if any changelog exists
        existing = db.query(models.Changelog).first()
        if existing:
            print("✓ Changelog already seeded, skipping...")
            return
        
        # Create initial changelog entry
        changelog_entry = models.Changelog(
            version="1.0",
            date="2026-07-23",
            changes=[
                "Initial release of BracketWorks",
                "Tournament bracket management system",
                "Score tracking and payouts",
                "Development preview - verify all data before publishing"
            ],
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        
        db.add(changelog_entry)
        db.commit()
        print("✓ Changelog seeded successfully")
        
    except Exception as e:
        db.rollback()
        print(f"✗ Error seeding changelog: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_changelog()
