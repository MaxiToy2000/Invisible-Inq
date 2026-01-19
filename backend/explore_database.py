import json
from config import Config
from database import Neo4jDatabase

def explore_database():
    print("=" * 80)
    print("NEO4J DATABASE EXPLORATION")
    print("=" * 80)

    db = Neo4jDatabase()

    try:
        print("\n" + "=" * 80)
        print("1. NODE LABELS (Types of nodes in the database)")
        print("=" * 80)
        labels_query = "CALL db.labels()"
        labels = db.execute_query(labels_query)
        print(f"Found {len(labels)} node label(s):")
        for i, label in enumerate(labels, 1):
            label_name = list(label.values())[0] if label else "Unknown"

            escaped_label = f"`{label_name}`" if ' ' in label_name or '-' in label_name else label_name
            count_query = f"MATCH (n:{escaped_label}) RETURN count(n) as count"
            try:
                count_result = db.execute_query(count_query)
                count = count_result[0].get('count', 0) if count_result else 0
                print(f"  {i}. {label_name}: {count} nodes")
            except Exception as e:
                print(f"  {i}. {label_name}: Error counting - {str(e)[:50]}")

        print("\n" + "=" * 80)
        print("2. RELATIONSHIP TYPES")
        print("=" * 80)
        rel_types_query = "CALL db.relationshipTypes()"
        rel_types = db.execute_query(rel_types_query)
        print(f"Found {len(rel_types)} relationship type(s):")
        for i, rel_type in enumerate(rel_types, 1):
            rel_name = list(rel_type.values())[0] if rel_type else "Unknown"

            escaped_rel = f"`{rel_name}`" if ' ' in rel_name or '-' in rel_name else rel_name
            count_query = f"MATCH ()-[r:{escaped_rel}]->() RETURN count(r) as count"
            try:
                count_result = db.execute_query(count_query)
                count = count_result[0].get('count', 0) if count_result else 0
                print(f"  {i}. {rel_name}: {count} relationships")
            except Exception as e:
                print(f"  {i}. {rel_name}: Error counting - {str(e)[:50]}")

        print("\n" + "=" * 80)
        print("3. STORY NODES - Detailed Analysis")
        print("=" * 80)
        story_query = "MATCH (s:Story) RETURN s LIMIT 5"
        stories = db.execute_query(story_query)
        print(f"Found {len(stories)} Story node(s) (showing up to 5):")
        for i, story in enumerate(stories, 1):
            story_data = story.get('s', {})
            print(f"\n  Story {i}:")
            for key, value in story_data.items():
                if isinstance(value, str) and len(value) > 100:
                    print(f"    {key}: {value[:100]}...")
                else:
                    print(f"    {key}: {value}")

        print("\n" + "=" * 80)
        print("4. CHAPTER NODES - Detailed Analysis")
        print("=" * 80)
        chapter_query = "MATCH (c:Chapter) RETURN c LIMIT 5"
        chapters = db.execute_query(chapter_query)
        print(f"Found {len(chapters)} Chapter node(s) (showing up to 5):")
        for i, chapter in enumerate(chapters, 1):
            chapter_data = chapter.get('c', {})
            print(f"\n  Chapter {i}:")
            for key, value in chapter_data.items():
                if isinstance(value, str) and len(value) > 100:
                    print(f"    {key}: {value[:100]}...")
                else:
                    print(f"    {key}: {value}")

        print("\n" + "=" * 80)
        print("5. STORY -> CHAPTER RELATIONSHIPS")
        print("=" * 80)
        story_chapter_query = """
        MATCH (s:Story)-[r]->(c:Chapter)
        RETURN type(r) as rel_type, count(r) as count

            MATCH (s:Story)-[*1..3]-(c:Chapter)
            RETURN DISTINCT type(relationships(path)[0]) as rel_type, count(*) as count
            LIMIT 10

        MATCH (c:Chapter)-[r]-(connected)
        RETURN type(r) as rel_type, labels(connected)[0] as connected_label, count(*) as count
        ORDER BY count DESC
        LIMIT 20

        MATCH (n)
        WHERE NOT 'Story' IN labels(n) AND NOT 'Chapter' IN labels(n) AND NOT 'Substory' IN labels(n)
        RETURN DISTINCT labels(n)[0] as label, count(*) as count
        ORDER BY count DESC
        LIMIT 20

        MATCH (n)
        WHERE NOT 'Story' IN labels(n) AND NOT 'Chapter' IN labels(n) AND NOT 'Substory' IN labels(n)
        RETURN n, labels(n) as node_labels
        LIMIT 3

        MATCH (c:Chapter)-[r]-(entity)
        WHERE NOT 'Story' IN labels(entity) AND NOT 'Chapter' IN labels(entity) AND NOT 'Substory' IN labels(entity)
        RETURN type(r) as rel_type, labels(entity)[0] as entity_label, count(*) as count
        ORDER BY count DESC
        LIMIT 15

            MATCH (c:Chapter)-[*1..3]-(entity)
            WHERE NOT 'Story' IN labels(entity) AND NOT 'Chapter' IN labels(entity) AND NOT 'Substory' IN labels(entity)
            RETURN DISTINCT labels(entity)[0] as entity_label, count(*) as count
            ORDER BY count DESC
            LIMIT 10

        MATCH (e1)-[r]-(e2)
        WHERE NOT 'Story' IN labels(e1) AND NOT 'Chapter' IN labels(e1) AND NOT 'Substory' IN labels(e1)
          AND NOT 'Story' IN labels(e2) AND NOT 'Chapter' IN labels(e2) AND NOT 'Substory' IN labels(e2)
        RETURN type(r) as rel_type, count(*) as count
        ORDER BY count DESC
        LIMIT 20

        MATCH (e1)-[r]-(e2)
        WHERE NOT 'Story' IN labels(e1) AND NOT 'Chapter' IN labels(e1) AND NOT 'Substory' IN labels(e1)
          AND NOT 'Story' IN labels(e2) AND NOT 'Chapter' IN labels(e2) AND NOT 'Substory' IN labels(e2)
        RETURN type(r) as rel_type, properties(r) as props, labels(e1)[0] as from_label, labels(e2)[0] as to_label
        LIMIT 3

        MATCH path = (s:Story)-[*1..5]-(e)
        WHERE NOT 'Story' IN labels(e) AND NOT 'Chapter' IN labels(e) AND NOT 'Substory' IN labels(e)
        WITH s, e, relationships(path) as rels
        RETURN DISTINCT s.id as story_id, labels(e)[0] as entity_label, count(*) as count
        ORDER BY story_id, count DESC
        LIMIT 20

        MATCH (n)
        WHERE n.graphPath IS NOT NULL OR n.graph_path IS NOT NULL OR n.path IS NOT NULL
        RETURN labels(n)[0] as label, keys(n) as keys, count(*) as count
        LIMIT 10

        MATCH (s:Story)
        RETURN keys(s) as properties
        LIMIT 1

        MATCH (c:Chapter)
        RETURN keys(c) as properties
        LIMIT 1
        """
        chapter_props = db.execute_query(chapter_props_query)
        if chapter_props:
            props = chapter_props[0].get('properties', [])
            print(f"Chapter node properties: {props}")

        print("\n" + "=" * 80)
        print("EXPLORATION COMPLETE")
        print("=" * 80)

    except Exception as e:
        print(f"\nError during exploration: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    explore_database()
