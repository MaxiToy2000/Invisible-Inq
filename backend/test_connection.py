import sys
from config import Config
from database import Neo4jDatabase

def test_connection():
    print("=" * 60)
    print("Neo4j Connection Test")
    print("=" * 60)
    print(f"URI: {Config.NEO4J_URI}")
    print(f"User: {Config.NEO4J_USER}")
    print(f"Password: {'*' * len(Config.NEO4J_PASSWORD) if Config.NEO4J_PASSWORD else 'NOT SET'}")
    print()

    try:
        Config.validate()
        print("✓ Configuration validation passed")
    except ValueError as e:
        print(f"✗ Configuration error: {e}")
        return False

    print("\nAttempting to connect to Neo4j...")
    try:
        db = Neo4jDatabase()
        print("✓ Successfully connected to Neo4j!")

        print("\nTesting database query...")
        result = db.execute_query("RETURN 1 as test")
        if result:
            print("✓ Database query successful")
            print(f"  Query result: {result}")

        print("\nFetching Neo4j version...")
        version_result = db.execute_query("CALL dbms.components() YIELD name, versions, edition UNWIND versions AS version RETURN name, version, edition")
        if version_result:
            print("✓ Neo4j version information:")
            for component in version_result:
                print(f"  {component.get('name', 'Unknown')}: {component.get('version', 'Unknown')} ({component.get('edition', 'Unknown')})")

        print("\nCounting nodes in database...")
        node_count = db.execute_query("MATCH (n) RETURN count(n) as count")
        if node_count:
            count = node_count[0].get('count', 0)
            print(f"✓ Total nodes in database: {count}")

        print("\nCounting relationships in database...")
        rel_count = db.execute_query("MATCH ()-[r]->() RETURN count(r) as count")
        if rel_count:
            count = rel_count[0].get('count', 0)
            print(f"✓ Total relationships in database: {count}")

        print("\nChecking for Story nodes...")
        story_count = db.execute_query("MATCH (n:Story) RETURN count(n) as count")
        if story_count:
            count = story_count[0].get('count', 0)
            print(f"  Story nodes: {count}")

        chapter_count = db.execute_query("MATCH (n:Chapter) RETURN count(n) as count")
        if chapter_count:
            count = chapter_count[0].get('count', 0)
            print(f"  Chapter nodes: {count}")

        substory_count = db.execute_query("MATCH (n:Substory) RETURN count(n) as count")
        if substory_count:
            count = substory_count[0].get('count', 0)
            print(f"  Substory nodes: {count}")

        db.close()
        print("\n" + "=" * 60)
        print("✓ Connection test completed successfully!")
        print("=" * 60)
        return True

    except Exception as e:
        print(f"\n✗ Connection failed!")
        print(f"  Error: {str(e)}")
        print(f"  Error type: {type(e).__name__}")
        print("\nTroubleshooting tips:")
        print("  1. Verify Neo4j is running: neo4j status")
        print("  2. Check URI format (bolt://localhost:7687 or neo4j://localhost:7687)")
        print("  3. Verify username and password are correct")
        print("  4. Check if Neo4j is accessible at the specified URI")
        print("  5. For remote connections, ensure firewall allows the port")
        print("\n" + "=" * 60)
        return False

if __name__ == "__main__":
    success = test_connection()
    sys.exit(0 if success else 1)
