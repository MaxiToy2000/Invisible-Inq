"""
Script to create an admin user in PostgreSQL (Neon)
Run this once to create your first admin user
"""
from admin_user_service import create_admin_user, get_admin_user_by_email
from models import UserCreate
import sys

# Default admin credentials (hardcoded as requested)
DEFAULT_ADMIN_EMAIL = "admin@example.com"
DEFAULT_ADMIN_PASSWORD = "adminadmin"
DEFAULT_ADMIN_NAME = "admin"

def ensure_default_admin():
    """
    Ensure the default admin user exists in PostgreSQL. Creates it if it doesn't exist.
    Returns the user if successful, None otherwise.
    """
    try:
        # Check if default admin already exists
        existing_user = get_admin_user_by_email(DEFAULT_ADMIN_EMAIL)
        
        if existing_user:
            print(f"Default admin user already exists: {DEFAULT_ADMIN_EMAIL}")
            return existing_user
        
        # Create default admin user
        admin_data = UserCreate(
            email=DEFAULT_ADMIN_EMAIL,
            password=DEFAULT_ADMIN_PASSWORD,
            full_name=DEFAULT_ADMIN_NAME
        )
        
        user = create_admin_user(admin_data, auth_provider="local", is_admin=True)
        return user
    except Exception as e:
        print(f"Error ensuring default admin: {e}")
        return None

def create_admin():
    """Create an admin user"""
    print("=" * 60)
    print("CREATE ADMIN USER")
    print("=" * 60)
    print("\nOptions:")
    print("1. Create default admin (admin@example.com / adminadmin)")
    print("2. Create custom admin")
    print()
    
    choice = input("Choose an option (1 or 2, default: 1): ").strip()
    
    if choice == "2":
        # Custom admin creation
        email = input("Enter admin email: ").strip()
        if not email:
            print("Error: Email is required")
            sys.exit(1)
        
        password = input("Enter admin password (min 6 characters, max 72 bytes): ").strip()
        if len(password) < 6:
            print("Error: Password must be at least 6 characters")
            sys.exit(1)
        
        # Check password byte length (bcrypt limit is 72 bytes)
        password_bytes = password.encode('utf-8')
        if len(password_bytes) > 72:
            print(f"Error: Password is too long ({len(password_bytes)} bytes). Maximum is 72 bytes.")
            print("Please use a shorter password.")
            sys.exit(1)
        
        full_name = input("Enter admin full name: ").strip()
        if not full_name:
            full_name = "Administrator"
    else:
        # Default admin creation
        email = DEFAULT_ADMIN_EMAIL
        password = DEFAULT_ADMIN_PASSWORD
        full_name = DEFAULT_ADMIN_NAME
        print(f"\nUsing default credentials:")
        print(f"  Email: {email}")
        print(f"  Name: {full_name}")
        print(f"  Password: {'*' * len(password)}")
    
    # Check if user already exists
    existing_user = get_admin_user_by_email(email)
    if existing_user:
        print(f"\n⚠️  WARNING: User with email '{email}' already exists!")
        overwrite = input("Do you want to update the existing user to be an admin? (y/n): ").strip().lower()
        if overwrite != 'y':
            print("Cancelled.")
            sys.exit(0)
        # Note: We would need an update function here, but for now, just inform the user
        print("Note: To update existing user, please delete and recreate or use database tools.")
        sys.exit(0)
    
    # Create admin user
    print(f"\nCreating admin user in PostgreSQL: {email}...")
    
    admin_data = UserCreate(
        email=email,
        password=password,
        full_name=full_name
    )
    
    try:
        user = create_admin_user(admin_data, auth_provider="local", is_admin=True)
        
        if user:
            print("\n" + "=" * 60)
            print("✅ SUCCESS! Admin user created:")
            print("=" * 60)
            print(f"Email: {user.email}")
            print(f"Name: {user.full_name}")
            print(f"Admin: {user.is_admin}")
            print(f"ID: {user.id}")
            print("=" * 60)
            print("\nYou can now log in to the admin dashboard at:")
            print("http://localhost:3001")
            if email == DEFAULT_ADMIN_EMAIL:
                print(f"\nDefault credentials:")
                print(f"  Email: {DEFAULT_ADMIN_EMAIL}")
                print(f"  Password: {DEFAULT_ADMIN_PASSWORD}")
            print("=" * 60)
        else:
            print("\n❌ ERROR: Failed to create admin user")
            print("The user might already exist or there was a database error")
            sys.exit(1)
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    create_admin()
