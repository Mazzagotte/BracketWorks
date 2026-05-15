import subprocess
import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parent


def main() -> int:
    command = [
        sys.executable,
        "-m",
        "pytest",
        str(BACKEND_ROOT / "tests" / "test_auth_security.py"),
        str(BACKEND_ROOT / "tests" / "test_auth_sessions.py"),
        "-q",
    ]
    return subprocess.call(command, cwd=BACKEND_ROOT)


if __name__ == "__main__":
    raise SystemExit(main())
