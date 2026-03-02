"""
Create Neo4j indexes to speed up graph-by-section queries (reduces story load time).

Run from backend directory:
  python scripts/create_neo4j_indexes.py

Or from project root:
  python backend/scripts/create_neo4j_indexes.py

Requires NEO4J_* env and that database is reachable.

Optional: set NEO4J_GRAPH_NODE_LABEL to the label of your data nodes (the 64 nodes
returned per section, e.g. Entity or Node). If set, creates indexes on that label
so the "scope" node match can use an index instead of a full scan.
"""

import sys
import os

# Allow importing from backend
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db

# Section node (:gr_id) indexes — used to find the section quickly
SECTION_INDEXES = [
    "CREATE INDEX gr_id_id IF NOT EXISTS FOR (n:gr_id) ON (n.id)",
    "CREATE INDEX gr_id_gid IF NOT EXISTS FOR (n:gr_id) ON (n.gid)",
    "CREATE INDEX gr_id_g_id IF NOT EXISTS FOR (n:gr_id) ON (n.g_id)",
    "CREATE INDEX gr_id_category_id IF NOT EXISTS FOR (n:gr_id) ON (n.category, n.id)",
]

# Scope node indexes — only help if your *data* nodes (not section) have this label.
# Check in Neo4j: MATCH (n) WHERE NOT n:gr_id RETURN labels(n), count(*) — use the main label.
def scope_indexes():
    label = os.environ.get("NEO4J_GRAPH_NODE_LABEL", "").strip()
    if not label:
        return []
    return [
        f"CREATE INDEX {label}_gr_id IF NOT EXISTS FOR (n:{label}) ON (n.gr_id)",
        f"CREATE INDEX {label}_g_id IF NOT EXISTS FOR (n:{label}) ON (n.g_id)",
        f"CREATE INDEX {label}_gid IF NOT EXISTS FOR (n:{label}) ON (n.gid)",
        f"CREATE INDEX {label}_id IF NOT EXISTS FOR (n:{label}) ON (n.id)",
    ]


def main():
    statements = SECTION_INDEXES + scope_indexes()
    if not scope_indexes():
        print("Tip: set NEO4J_GRAPH_NODE_LABEL to your data node label (e.g. Entity) to add scope indexes.")
    print("Creating Neo4j indexes for graph query speed...")

    for stmt in statements:
        try:
            db.execute_write_query(stmt)
            print(f"  OK: {stmt[:60]}...")
        except Exception as e:
            print(f"  SKIP: {stmt[:60]}... -> {e}")
    print("Done. In the app: click a story card to load its graph, then check backend logs for [perf] get_graph_data db= (should be lower now).")
    db.close()

if __name__ == "__main__":
    main()
