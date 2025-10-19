#!/usr/bin/env python3
"""
Render launcher script for BracketWorks backend
This script is placed in the project root and launches the backend from the backend/ directory
"""

import os
import sys
import subprocess

def main():
    # Get the directory where this script is located (project root)
    project_root = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(project_root, 'backend')
    app_main_path = os.path.join(backend_dir, 'app', 'main.py')
    
    # Verify the app main exists
    if not os.path.exists(app_main_path):
        print(f"ERROR: App main not found at {app_main_path}")
        sys.exit(1)
    
    # Change to backend directory and run the full app via uvicorn
    os.chdir(backend_dir)
    
    # Get port from environment or default to 8000
    port = os.environ.get('PORT', '8000')
    
    # Execute the full app using uvicorn
    try:
        result = subprocess.run([
            sys.executable, '-m', 'uvicorn', 
            'app.main:app', 
            '--host', '0.0.0.0', 
            '--port', port
        ], check=True)
        sys.exit(result.returncode)
    except subprocess.CalledProcessError as e:
        print(f"ERROR: Backend failed to start: {e}")
        sys.exit(e.returncode)
    except Exception as e:
        print(f"ERROR: Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()