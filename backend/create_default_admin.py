"""
Script to create the default admin user with hardcoded credentials in PostgreSQL (Neon)
Email: admin@example.com
Username: admin
Password: adminadmin
"""
from create_admin import DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_NAME
from admin_user_service import create_admin_user, get_admin_user_by_email
from models import UserCreate

def create_default_admin():
    """Create the default admin user with hardcoded credentials"""
    print("=" * 60)
    print("CREATING DEFAULT ADMIN USER")
    print("=" * 60)
    print(f"\nDefault Credentials:")
    print(f"  Email: {DEFAULT_ADMIN_EMAIL}")
    print(f"  Username: {DEFAULT_ADMIN_NAME}")
    print(f"  Password: {DEFAULT_ADMIN_PASSWORD}")
    print("=" * 60)
    
    try:
        # Check if user already exists
        existing_user = get_admin_user_by_email(DEFAULT_ADMIN_EMAIL)
        if existing_user:
            print(f"\n✅ Default admin user already exists: {DEFAULT_ADMIN_EMAIL}")
            print(f"   You can log in with the credentials above.")
            return existing_user
        
        # Create default admin user
        print(f"\nCreating default admin user in PostgreSQL...")
        admin_data = UserCreate(
            email=DEFAULT_ADMIN_EMAIL,
            password=DEFAULT_ADMIN_PASSWORD,
            full_name=DEFAULT_ADMIN_NAME
        )
        
        user = create_admin_user(admin_data, auth_provider="local", is_admin=True)
        
        if user:
            print("\n" + "=" * 60)
            print("✅ SUCCESS! Default admin user created:")
            print("=" * 60)
            print(f"Email: {user.email}")
            print(f"Username: {user.full_name}")
            print(f"Password: {DEFAULT_ADMIN_PASSWORD}")
            print(f"Admin: {user.is_admin}")
            print(f"ID: {user.id}")
            print("=" * 60)
            print("\nYou can now log in to the admin dashboard at:")
            print("http://localhost:3001")
            print("\nLogin Credentials:")
            print(f"  Email: {DEFAULT_ADMIN_EMAIL}")
            print(f"  Password: {DEFAULT_ADMIN_PASSWORD}")
            print("=" * 60)
            return user
        else:
            print("\n❌ ERROR: Failed to create default admin user")
            return None
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        return None

if __name__ == "__main__":
    create_default_admin()
