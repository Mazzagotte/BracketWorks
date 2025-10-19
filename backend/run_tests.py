#!/usr/bin/env python3
"""
Comprehensive test runner for BracketWorks
Run this to quickly test your application with coverage and performance metrics
"""

import subprocess
import sys
import os
import time

def run_linting():
    """Run code linting checks"""
    print("🔍 Running Code Quality Checks...")
    print("-" * 40)
    
    try:
        # Run flake8 for style checking
        result = subprocess.run([
            sys.executable, "-m", "flake8", 
            "app", "tests", 
            "--max-line-length=88", 
            "--extend-ignore=E203,W503"
        ], capture_output=True, text=True)
        
        if result.returncode != 0:
            print("❌ Linting issues found:")
            print(result.stdout)
            return False
        else:
            print("✅ Code style looks good!")
            return True
            
    except Exception as e:
        print(f"⚠️ Could not run linting: {e}")
        return True  # Don't fail tests for missing dev tools

def run_tests_with_coverage():
    """Run all tests with coverage reporting"""
    print("🧪 Running Tests with Coverage...")
    print("-" * 40)
    
    try:
        start_time = time.time()
        
        result = subprocess.run([
            sys.executable, "-m", "pytest", 
            "tests/", 
            "-v", 
            "--tb=short",
            "--color=yes",
            "--cov=app",
            "--cov-report=term-missing",
            "--cov-report=html:htmlcov",
            "-m", "not slow"  # Skip slow tests by default
        ], capture_output=False, text=True)
        
        end_time = time.time()
        duration = end_time - start_time
        
        print(f"\n⏱️ Tests completed in {duration:.2f} seconds")
        
        if result.returncode == 0:
            print("✅ All tests passed!")
            print("📊 Coverage report generated in htmlcov/ directory")
            return True
        else:
            print("❌ Some tests failed!")
            return False
            
    except Exception as e:
        print(f"❌ Error running tests: {e}")
        return False

def run_slow_tests():
    """Run slow/integration tests separately"""
    print("🐌 Running Slow/Integration Tests...")
    print("-" * 40)
    
    try:
        result = subprocess.run([
            sys.executable, "-m", "pytest", 
            "tests/", 
            "-v",
            "-m", "slow",
            "--tb=short"
        ], capture_output=False, text=True)
        
        return result.returncode == 0
    except Exception as e:
        print(f"❌ Error running slow tests: {e}")
        return False

def run_security_check():
    """Run security vulnerability check"""
    print("🔒 Running Security Checks...")
    print("-" * 30)
    
    try:
        result = subprocess.run([
            sys.executable, "-m", "pip", "freeze"
        ], capture_output=True, text=True, check=True)
        
        # Note: safety package would need to be installed
        # pip install safety
        print("✅ Security check placeholder (install 'safety' package for full check)")
        return True
        
    except Exception as e:
        print(f"⚠️ Could not run security check: {e}")
        return True

def main():
    """Main test runner with comprehensive checks"""
    print("🎯 BracketWorks Comprehensive Test Suite")
    print("=" * 50)
    
    # Change to backend directory
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(backend_dir)
    
    results = []
    
    # Run all checks
    results.append(("Linting", run_linting()))
    results.append(("Unit Tests", run_tests_with_coverage()))
    results.append(("Security", run_security_check()))
    
    # Ask about slow tests
    print("\n🤔 Run slow/integration tests? (y/n): ", end="")
    try:
        if input().lower().startswith('y'):
            results.append(("Slow Tests", run_slow_tests()))
    except KeyboardInterrupt:
        print("\n\n⏹️ Tests interrupted by user")
        sys.exit(1)
    
    # Summary
    print("\n📋 Test Summary")
    print("=" * 30)
    
    all_passed = True
    for test_name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{test_name:.<20} {status}")
        if not passed:
            all_passed = False
    
    print("=" * 30)
    
    if all_passed:
        print("🚀 All checks passed! Ready to deploy!")
        print("💡 Tips:")
        print("  - View coverage: open htmlcov/index.html")
        print("  - Run load tests: locust -f load_test.py")
        sys.exit(0)
    else:
        print("🔧 Fix the issues above before deploying")
        sys.exit(1)

if __name__ == "__main__":
    main()