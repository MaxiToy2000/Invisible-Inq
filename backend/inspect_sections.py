from database import Neo4jDatabase

def inspect_sections():
    db = Neo4jDatabase()

    try:
        print("=" * 80)
        print("SECTION NODES INSPECTION")
        print("=" * 80)

        sections_query = """
        MATCH (sec:Section)
        RETURN sec, labels(sec) as labels, keys(sec) as properties
        ORDER BY sec.gid
        LIMIT 10

        MATCH (e:Entity)
        WHERE e.section IS NOT NULL
        RETURN DISTINCT e.section as section_value, count(*) as entity_count
        ORDER BY entity_count DESC
        LIMIT 20

        MATCH (sec:Section)
        RETURN sec
        LIMIT 1

                    MATCH (e:Entity)
                    WHERE e.section = $value OR e.section CONTAINS $value
                    RETURN count(e) as count

        MATCH (c:Chapter)-[:Chapter_Section]->(sec:Section)
        OPTIONAL MATCH (e:Entity)
        WHERE e.section IS NOT NULL
        WITH c, sec, e,
             CASE
               WHEN e.section = toString(sec.gid) THEN 1
               WHEN e.section CONTAINS sec.`Section Title` THEN 1
               WHEN sec.`Section Title` IS NOT NULL AND e.section CONTAINS sec.`Section Title` THEN 1
               ELSE 0
             END as matches
        WHERE matches = 1 OR e.section IS NULL
        RETURN c.`Chapter Title` as chapter,
               sec.gid as section_gid,
               keys(sec) as section_props,
               count(DISTINCT e) as entity_count
        ORDER BY chapter, section_gid
        LIMIT 10
        """
        paths = db.execute_query(path_query)

        if paths:
            print("\nChapter-Section-Entity connections:")
            for path in paths:
                print(f"  Chapter: {path.get('chapter')}")
                print(f"    Section gid: {path.get('section_gid')}")
                print(f"    Section properties: {path.get('section_props')}")
                print(f"    Matching entities: {path.get('entity_count')}")
                print()

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    inspect_sections()
