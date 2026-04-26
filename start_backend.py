#!/usr/bin/env python3
"""
Launcher script for BracketWorks backend
This script is placed in the project root and launches the backend from the backend/ directory
"""

import os
import sys
import subprocess

def main():
    # Get the directory where this script is located (project root)
    project_root = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(project_root, 'backend')
    
    # Change to backend directory
    os.chdir(backend_dir)
    
    # Start the FastAPI app using uvicorn with the full app structure
    try:
        cmd = [
            sys.executable, '-m', 'uvicorn', 
            'app.main:app', 
            '--host', '0.0.0.0', 
            '--port', str(os.environ.get('PORT', 8000))
        ]
        print(f"Starting uvicorn with command: {' '.join(cmd)}")
        result = subprocess.run(cmd, check=True)
        sys.exit(result.returncode)
    except subprocess.CalledProcessError as e:
        print(f"ERROR: Backend failed to start: {e}")
        sys.exit(e.returncode)
    except Exception as e:
        print(f"ERROR: Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()