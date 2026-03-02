# Reducing story load time (~15s)

**If you see `db=10s` and `format=0.00s`** (e.g. 64 nodes, 105 links), the bottleneck is the **Neo4j query**. Run the index script and, if your data nodes use one label, set `NEO4J_GRAPH_NODE_LABEL` (see below).

When you load a story (click a card → first section graph), the backend logs show where time is spent:

- **`[perf] get_graph_data: db=X.XXs format=X.XXs nodes=N links=L`** — Neo4j query time (`db`) and Python formatting time (`format`).
- **`[perf] get_graph_by_substory_id total=X.XXs`** — Full request (graph + description in parallel).

Use these to see if the bottleneck is **Neo4j** (db), **Python** (format), or **description/network**.

---

## Best options (by impact vs effort)

### 1. **Neo4j indexes** (highest impact, low effort)

If `db=` is large (e.g. 8–12s) and `format=` is small, the graph query is doing full scans. Add indexes:

**From the project (recommended):**

```bash
cd backend
python scripts/create_neo4j_indexes.py
```

That creates indexes on `:gr_id` for section lookup. To also speed the **scope** node match (the part that finds nodes by `gr_id`/`g_id`), set the label of your *data* nodes (the 64 nodes per section, not the section node itself):

```bash
# If your data nodes use label "Entity" (check in Neo4j: MATCH (n) WHERE NOT n:gr_id RETURN DISTINCT labels(n))
set NEO4J_GRAPH_NODE_LABEL=Entity
python scripts/create_neo4j_indexes.py
```

Then re-run a slow story load and check `db=` in the logs.

---

### 2. **Smaller initial payload** (high impact, medium effort)

Current caps in `backend/queries.py`: **2500 nodes**, **6000 links**. Reducing (e.g. 1500 / 4000) cuts serialization, network, and frontend work.

- In `queries.py`, change `all_nodes[0..2500]` and `all_rels[0..6000]` to lower values.
- Optionally add a query param like `?limit=1000` and cap even lower for “quick preview” with a “Load full graph” button.

---

### 3. **Don’t block graph on description** (medium impact, low effort)

Description is fetched in parallel already; if the description DB is slow, you can return the graph first and load description via a separate request:

- Endpoint returns graph only (no `description`).
- Frontend calls `GET /api/graph/{id}/description` (new small endpoint) and shows description when it arrives.

This doesn’t reduce total work but makes the graph appear sooner.

---

### 4. **Two-phase load (skeleton first)** (high impact, higher effort)

- **Phase 1:** Return a minimal graph (e.g. id, label, node_type only, cap 500 nodes) so the UI can render something in 2–3s.
- **Phase 2:** Fetch full node/edge properties in the background and merge, or stream them.

Requires a new query/endpoint and frontend changes.

---

### 5. **Backend graph cache (warm on startup)** (medium impact, low effort)

You already have a 5‑minute in-memory cache. To avoid a cold first request:

- On startup (or on first `GET /api/stories`), fire a background task that requests the first story’s first section graph so the cache is warm before the user clicks.

---

### 6. **Python formatting** (only if `format=` is large)

If logs show `format=` at 2s+, consider:

- Formatting in batches or using a faster path for common property shapes.
- Capping nodes/links (see option 2) so there are fewer items to format.

---

### 7. **Frontend**

- **Prefetch:** You already prefetch on story card hover; ensure that request hits the same `GET /api/graph/{substory_id}` so the backend cache is used when the user clicks.
- **Worker:** Move `formatGraphData` to a Web Worker so the main thread stays responsive (doesn’t shorten total time but improves perceived speed).

---

## Quick checks

1. **Backend:** Load a slow section and look at logs: note `db=` and `format=` from `get_graph_data` and `get_graph_by_substory_id total=`.
2. **Neo4j:** In Neo4j Browser, run `EXPLAIN` or `PROFILE` of the graph query (from `get_graph_data_by_section_query`) to see if indexes are used.
3. **Network:** In browser DevTools → Network, check the size and time of `GET /api/graph/...` (after GZip). If the response is very large, reducing caps or doing two-phase load will help.

Starting with **Neo4j indexes** and **smaller caps** usually gives the biggest improvement for the least change.
