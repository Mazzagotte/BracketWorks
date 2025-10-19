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
    backend_script = os.path.join(backend_dir, 'main_standalone.py')
    
    # Verify the backend script exists
    if not os.path.exists(backend_script):
        print(f"ERROR: Backend script not found at {backend_script}")
        sys.exit(1)
    
    # Change to backend directory and run the standalone script
    os.chdir(backend_dir)
    
    # Execute the backend script
    try:
        result = subprocess.run([sys.executable, 'main_standalone.py'], check=True)
        sys.exit(result.returncode)
    except subprocess.CalledProcessError as e:
        print(f"ERROR: Backend failed to start: {e}")
        sys.exit(e.returncode)
    except Exception as e:
        print(f"ERROR: Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()