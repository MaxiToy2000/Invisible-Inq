#!/usr/bin/env python3
"""
Verification script for admin dashboard setup
Checks all components and reports any issues
"""
import os
import sys
import subprocess
from pathlib import Path

def print_header(text):
    print("\n" + "=" * 60)
    print(f"  {text}")
    print("=" * 60)

def print_success(text):
    print(f"✓ {text}")

def print_error(text):
    print(f"✗ {text}")

def print_warning(text):
    print(f"⚠ {text}")

def check_file_exists(filepath, description):
    """Check if a file exists"""
    if os.path.exists(filepath):
        print_success(f"{description}: {filepath}")
        return True
    else:
        print_error(f"{description} not found: {filepath}")
        return False

def check_backend_files():
    """Check if all backend files exist"""
    print_header("Backend Files")
    
    files = [
        ("backend/activity_service.py", "Activity Service"),
        ("backend/user_service.py", "User Service"),
        ("backend/auth.py", "Auth Module"),
        ("backend/models.py", "Models"),
        ("backend/main.py", "Main API"),
        ("backend/create_admin.py", "Admin Creation Script"),
        ("backend/requirements.txt", "Requirements"),
    ]
    
    all_exist = True
    for filepath, desc in files:
        if not check_file_exists(filepath, desc):
            all_exist = False
    
    return all_exist

def check_admin_files():
    """Check if all admin frontend files exist"""
    print_header("Admin Frontend Files")
    
    files = [
        ("admin/package.json", "Package Config"),
        ("admin/vite.config.js", "Vite Config"),
        ("admin/src/App.jsx", "App Component"),
        ("admin/src/main.jsx", "Main Entry"),
        ("admin/src/contexts/AuthContext.jsx", "Auth Context"),
        ("admin/src/pages/LoginPage.jsx", "Login Page"),
        ("admin/src/pages/DashboardPage.jsx", "Dashboard Page"),
        ("admin/src/pages/ActivitiesPage.jsx", "Activities Page"),
        ("admin/src/components/Layout.jsx", "Layout Component"),
        ("admin/src/components/ProtectedRoute.jsx", "Protected Route"),
    ]
    
    all_exist = True
    for filepath, desc in files:
        if not check_file_exists(filepath, desc):
            all_exist = False
    
    return all_exist

def check_main_app_files():
    """Check if activity tracking is integrated"""
    print_header("Main App Integration")
    
    files = [
        ("src/hooks/useActivityTracking.js", "Activity Tracking Hook"),
    ]
    
    all_exist = True
    for filepath, desc in files:
        if not check_file_exists(filepath, desc):
            all_exist = False
    
    return all_exist

def check_documentation():
    """Check if documentation exists"""
    print_header("Documentation")
    
    files = [
        ("ADMIN_SETUP.md", "Setup Guide"),
        ("ADMIN_QUICK_START.md", "Quick Start Guide"),
        ("IMPLEMENTATION_SUMMARY.md", "Implementation Summary"),
        ("admin/README.md", "Admin README"),
    ]
    
    all_exist = True
    for filepath, desc in files:
        if not check_file_exists(filepath, desc):
            all_exist = False
    
    return all_exist

def check_env_files():
    """Check environment files"""
    print_header("Environment Configuration")
    
    # Check backend .env
    if os.path.exists("backend/.env"):
        print_success("Backend .env exists")
        backend_env = True
    else:
        print_warning("Backend .env not found (copy from backend/env.example)")
        backend_env = False
    
    # Check admin .env
    if os.path.exists("admin/.env"):
        print_success("Admin .env exists")
        admin_env = True
    else:
        print_warning("Admin .env not found (will be created)")
        admin_env = False
    
    return backend_env and admin_env

def check_dependencies():
    """Check if dependencies are installed"""
    print_header("Dependencies")
    
    # Check admin node_modules
    if os.path.exists("admin/node_modules"):
        print_success("Admin dependencies installed")
        admin_deps = True
    else:
        print_warning("Admin dependencies not installed (run: cd admin && npm install)")
        admin_deps = False
    
    # Check backend venv
    if os.path.exists("backend/venv") or os.path.exists("backend/.venv"):
        print_success("Backend virtual environment exists")
        backend_venv = True
    else:
        print_warning("Backend virtual environment not found")
        backend_venv = False
    
    return admin_deps and backend_venv

def main():
    print_header("Admin Dashboard Setup Verification")
    print("Checking all components...")
    
    # Change to project root
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    results = {
        "Backend Files": check_backend_files(),
        "Admin Frontend": check_admin_files(),
        "Main App Integration": check_main_app_files(),
        "Documentation": check_documentation(),
        "Environment Files": check_env_files(),
        "Dependencies": check_dependencies(),
    }
    
    print_header("Summary")
    
    all_passed = True
    for component, passed in results.items():
        if passed:
            print_success(f"{component}: OK")
        else:
            print_error(f"{component}: Issues found")
            all_passed = False
    
    print("\n" + "=" * 60)
    
    if all_passed:
        print("\n✓ All checks passed!")
        print("\nNext steps:")
        print("1. Ensure backend is running: cd backend && python main.py")
        print("2. Create admin user: cd backend && python create_admin.py")
        print("3. Start admin dashboard: cd admin && npm run dev")
        print("4. Access at: http://localhost:3001")
    else:
        print("\n⚠ Some issues found. Please review the errors above.")
        print("\nQuick fixes:")
        print("- Backend .env: Copy from backend/env.example")
        print("- Admin .env: Run ./setup_admin.sh")
        print("- Admin deps: cd admin && npm install")
        print("- Backend deps: cd backend && pip install -r requirements.txt")
    
    print("=" * 60 + "\n")
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())
