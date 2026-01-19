from database import db
from services import get_graph_data

test_section = "Studies Viruses"

print("Testing graph data query...")
print(f"Section query: {test_section}")

query = """
MATCH (section:Section {section_query: $section_query})
MATCH (entity:Entity)
WHERE entity.section = section.section_query
RETURN count(DISTINCT entity) as entity_count
"""
result = db.execute_query(query, {"section_query": test_section})
print(f"Direct query result: {result[0]['entity_count']} entities")

try:
    gd = get_graph_data(section_query=test_section)
    print(f"Service result: {len(gd.nodes)} nodes, {len(gd.links)} links")
except Exception as e:
    print(f"Service error: {e}")
    import traceback
    traceback.print_exc()

db.close()
