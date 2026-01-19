"""
Diagnostic script to test Neo4j database connection.
Run this script to troubleshoot connection issues.
"""
import sys
import traceback
from config import Config
from database import db

def test_connection():
    """Test the Neo4j database connection with detailed diagnostics"""
    print("=" * 60)
    print("Neo4j Database Connection Diagnostic")
    print("=" * 60)
    
    # Print configuration (hide password)
    print(f"\nConfiguration:")
    print(f"  URI: {Config.NEO4J_URI}")
    print(f"  User: {Config.NEO4J_USER}")
    print(f"  Password: {'*' * len(Config.NEO4J_PASSWORD) if Config.NEO4J_PASSWORD else 'NOT SET'}")
    
    # Test 1: Initial connection
    print(f"\n[Test 1] Testing initial connection...")
    try:
        db._connect()
        print("  [OK] Connection established successfully")
    except Exception as e:
        print(f"  [ERROR] Connection failed: {str(e)}")
        print(f"  Details: {traceback.format_exc()}")
        return False
    
    # Test 2: Connectivity verification
    print(f"\n[Test 2] Verifying connectivity...")
    try:
        if db._check_connection():
            print("  [OK] Connectivity verified")
        else:
            print("  [ERROR] Connectivity check failed")
            return False
    except Exception as e:
        print(f"  ✗ Connectivity check error: {str(e)}")
        return False
    
    # Test 3: Simple query
    print(f"\n[Test 3] Executing simple query...")
    try:
        result = db.execute_query("RETURN 1 as test")
        if result and result[0].get("test") == 1:
            print("  [OK] Query executed successfully")
            print(f"  Result: {result}")
        else:
            print(f"  [ERROR] Query returned unexpected result: {result}")
            return False
    except Exception as e:
        print(f"  ✗ Query execution failed: {str(e)}")
        print(f"  Details: {traceback.format_exc()}")
        return False
    
    # Test 4: Database info query
    print(f"\n[Test 4] Getting database information...")
    try:
        # Try to get Neo4j version
        result = db.execute_query("CALL dbms.components() YIELD name, versions, edition UNWIND versions AS version RETURN name, version, edition")
        if result:
            print("  [OK] Database information retrieved")
            for record in result[:3]:  # Show first 3 records
                print(f"    {record}")
        else:
            # Alternative query if above doesn't work
            result = db.execute_query("RETURN 1")
            print("  [OK] Database is accessible")
    except Exception as e:
        print(f"  [WARNING] Database info query failed (non-critical): {str(e)}")
    
    # Test 5: Test reconnection
    print(f"\n[Test 5] Testing reconnection logic...")
    try:
        # Simulate connection loss by resetting
        db._initialized = False
        result = db.execute_query("RETURN 2 as test")
        if result and result[0].get("test") == 2:
            print("  [OK] Reconnection logic working correctly")
        else:
            print(f"  [ERROR] Reconnection test failed: {result}")
            return False
    except Exception as e:
        print(f"  [ERROR] Reconnection test error: {str(e)}")
        return False
    
    # Cleanup
    try:
        db.close()
        print(f"\n[Cleanup] Connection closed")
    except:
        pass
    
    print("\n" + "=" * 60)
    print("All tests passed! Database connection is working correctly.")
    print("=" * 60)
    return True

if __name__ == "__main__":
    success = test_connection()
    sys.exit(0 if success else 1)

