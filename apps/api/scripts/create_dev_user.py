"""
create_dev_user.py — create a local development/demo user directly in the database.

Usage:
    python scripts/create_dev_user.py \
        --email demo@bracketworks.app \
        --username demo \
        --first-name Demo \
        --last-name User \
        [--admin]

The script will prompt for a password securely (not echoed, not logged).
Email verification is pre-confirmed so the account is ready to log in immediately.

Run from the backend/ directory with the venv active:
    cd backend
    python scripts/create_dev_user.py --email you@example.com --username yourname --first-name Your --last-name Name
"""

import argparse
import getpass
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Allow running from backend/ or project root
# ---------------------------------------------------------------------------
_backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_backend_dir))

# Load .env from project root so DATABASE_URL is available without the server
_env_file = _backend_dir.parent / ".env"
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a dev/demo user in the local database.")
    parser.add_argument("--email",      required=True,  help="User email address")
    parser.add_argument("--username",   required=True,  help="Login username")
    parser.add_argument("--first-name", required=True,  help="First name")
    parser.add_argument("--last-name",  required=True,  help="Last name")
    parser.add_argument("--org",        default=None,   help="Organization (optional)")
    parser.add_argument("--admin",      action="store_true", help="Grant admin privileges")
    args = parser.parse_args()

    # Prompt for password — never echoed, never stored in history
    password = getpass.getpass("Password for new account: ")
    if not password:
        print("ERROR: Password cannot be empty.", file=sys.stderr)
        sys.exit(1)
    confirm = getpass.getpass("Confirm password: ")
    if password != confirm:
        print("ERROR: Passwords do not match.", file=sys.stderr)
        sys.exit(1)
    if len(password) < 8:
        print("ERROR: Password must be at least 8 characters.", file=sys.stderr)
        sys.exit(1)

    # Import after env is set up so settings can read DATABASE_URL
    from passlib.context import CryptContext
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.core import models
    from app.core.config import settings

    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__default_rounds=12)

    engine = create_engine(settings.DATABASE_URL, echo=False, pool_pre_ping=True)
    Session = sessionmaker(bind=engine)

    with Session() as db:
        # Guard against duplicates
        if db.query(models.User).filter(models.User.username == args.username).first():
            print(f"ERROR: Username '{args.username}' already exists.", file=sys.stderr)
            sys.exit(1)
        if db.query(models.User).filter(models.User.email == args.email).first():
            print(f"ERROR: Email '{args.email}' already exists.", file=sys.stderr)
            sys.exit(1)

        user = models.User(
            username=args.username,
            email=args.email,
            first_name=args.first_name,
            last_name=args.last_name,
            organization=args.org,
            password=pwd_context.hash(password),
            is_admin=args.admin,
            created_at=datetime.now(tz=timezone.utc),
            email_verified_at=datetime.now(tz=timezone.utc),  # pre-verified for dev
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    print()
    print("Account created successfully.")
    print(f"  User ID  : {user.id}")
    print(f"  Username : {user.username}")
    print(f"  Email    : {user.email}")
    print(f"  Name     : {user.first_name} {user.last_name}")
    print(f"  Admin    : {user.is_admin}")
    print(f"  Verified : yes (pre-confirmed for dev)")
    print()
    print(f"Log in at http://localhost:3000/login")


if __name__ == "__main__":
    main()
