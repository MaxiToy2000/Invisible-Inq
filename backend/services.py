from typing import List, Dict, Any, Optional, Tuple
import logging
import time
from database import db
from queries import (
    get_all_stories_query,
    get_all_stories_query_legacy,
    get_graph_data_by_section_query,
    get_graph_data_by_section_query_legacy,
    get_graph_data_by_section_and_country_query,
    get_story_statistics_query,
    get_story_statistics_query_legacy,
    get_all_node_types_query,
    get_calendar_data_by_section_query,
    get_cluster_data_query
)
from models import Story, Chapter, Section, Node, Link, GraphData, StoryDetail

logger = logging.getLogger(__name__)

def generate_id_from_title(title: str) -> str:
    return title.lower().replace(' ', '_').replace('&', 'and').replace('/', '_').replace("'", '').replace('-', '_')

def format_node(node_data: Dict[str, Any]) -> Dict[str, Any]:
    gid_value = node_data.get("gid")
    element_id = node_data.get("elementId") or node_data.get("element_id")

    raw_id = gid_value
    if raw_id is None:
        raw_id = node_data.get("id")
    if raw_id is None:
        raw_id = element_id

    node_id = str(raw_id) if raw_id is not None else ""

    raw_node_type = node_data.get("node_type") or node_data.get("type")
    if not raw_node_type and isinstance(node_data.get("labels"), list) and node_data.get("labels"):
        raw_node_type = node_data["labels"][0]

    def normalize_label(label: str) -> str:
        # Normalize labels to match frontend filtering/grouping conventions
        # e.g. "USAID Program Region" -> "usaid_program_region"
        return str(label).strip().lower().replace(" ", "_")

    node_type_raw = str(raw_node_type) if raw_node_type is not None else ""
    node_type = normalize_label(node_type_raw) if node_type_raw else ""

    name_val = (
        node_data.get("name")
        or node_data.get("title")
        or node_data.get("entity_name")
        or node_data.get("relationship_name")
        or node_data.get("country_name")
        or node_data.get("summary")
        or node_data.get("Summary")
    )

    node = {
        "id": node_id,
        "gid": gid_value,
        "elementId": element_id,
        # Keep node_type stable for frontend grouping/filtering
        "node_type": node_type,
        "name": str(name_val) if name_val is not None else node_id,
        "section": node_data.get("section"),
        "category": None,
        "color": None,
        "highlight": bool(node_data.get("highlight")) if node_data.get("highlight") is not None else False,
    }

    # Pass through all additional properties (keep original keys/casing from Neo4j)
    for key, value in node_data.items():
        if value is None:
            continue
        if key in node:
            continue
        # Normalize date-like values so frontend always gets a string (Neo4j Date/DateTime are JSON-serializable but normalize for consistency)
        if key in ("date", "Date", "Relationship Date", "Action Date", "Process Date", "Disb Date", "date_start", "date_end"):
            if hasattr(value, "isoformat"):
                value = value.isoformat()
            elif hasattr(value, "strftime"):
                value = value.strftime("%Y-%m-%d")
        node[key] = value

    return node

def format_link(link_data: Dict[str, Any]) -> Dict[str, Any]:
    link = {
        "id": str(link_data.get("gid", "")),
        "sourceId": str(link_data.get("from_gid", "")),
        "targetId": str(link_data.get("to_gid", "")),
        "title": link_data.get("article_title") or link_data.get("Article Title"),
        "label": link_data.get("relationship_summary") or link_data.get("Relationship Summary"),
        "category": link_data.get("type") or "Entity_Relationship",
        "color": None,
    }

    for key, value in link_data.items():
        if key not in ["id", "gid", "sourceId", "targetId", "from_gid", "to_gid", "title", "label", "category", "type"] and value is not None:
            link[key] = value

    return link

def is_cypher_query(query: str) -> bool:
    if not query or not query.strip():
        return False

    query_upper = query.strip().upper()

    cypher_keywords = [
        "MATCH", "CREATE", "MERGE", "SET", "DELETE", "DETACH", "REMOVE",
        "RETURN", "WITH", "WHERE", "UNWIND", "CALL", "USING", "UNION",
        "FOREACH", "OPTIONAL"
    ]

    for keyword in cypher_keywords:
        if query_upper.startswith(keyword):
            return True

    keyword_count = sum(1 for keyword in cypher_keywords if keyword in query_upper)
    if keyword_count >= 2:
        return True

    return False

def extract_graph_data_from_cypher_results(results: List[Dict[str, Any]]) -> GraphData:
    nodes = []
    links = []

    for record in results:
        if "graphData" in record:
            graph_data = record["graphData"]
            if isinstance(graph_data, dict):
                node_list = graph_data.get("nodes", [])
                link_list = graph_data.get("links", [])

                for node_data in node_list:
                    if isinstance(node_data, dict):
                        nodes.append(format_node(node_data))

                for link_data in link_list:
                    if isinstance(link_data, dict):
                        links.append(format_link(link_data))
        elif "nodes" in record and "links" in record:
            node_list = record["nodes"] if isinstance(record["nodes"], list) else []
            link_list = record["links"] if isinstance(record["links"], list) else []

            for node_data in node_list:
                if isinstance(node_data, dict):
                    nodes.append(format_node(node_data))

            for link_data in link_list:
                if isinstance(link_data, dict):
                    links.append(format_link(link_data))
        elif "result" in record:
            result_data = record["result"]
            if isinstance(result_data, dict):
                node_list = result_data.get("nodes", [])
                link_list = result_data.get("links", [])

                for node_data in node_list:
                    if isinstance(node_data, dict):
                        nodes.append(format_node(node_data))

                for link_data in link_list:
                    if isinstance(link_data, dict):
                        links.append(format_link(link_data))
        else:
            for key, value in record.items():
                if isinstance(value, dict):
                    if any(prop in value for prop in ["gid", "entity_name", "Entity Name", "properties"]):
                        nodes.append(format_node(value))

    seen_node_ids = set()
    unique_nodes = []
    for node in nodes:
        node_id = node.get("id")
        if node_id and node_id not in seen_node_ids:
            seen_node_ids.add(node_id)
            unique_nodes.append(node)

    seen_link_ids = set()
    unique_links = []
    for link in links:
        link_id = link.get("id")
        if link_id and link_id not in seen_link_ids:
            seen_link_ids.add(link_id)
            unique_links.append(link)

    return GraphData(nodes=unique_nodes, links=unique_links)

def get_all_stories() -> List[Story]:
    try:
        logger.debug("Fetching all stories from database")
        query = get_all_stories_query()
        results = db.execute_query(query)
        # Fallback to legacy :story/:chapter/:section schema if gr_id returns no rows
        if not results:
            logger.debug("No results from gr_id schema, trying legacy story/chapter/section query")
            query_legacy = get_all_stories_query_legacy()
            results = db.execute_query(query_legacy)
        logger.debug(f"Retrieved {len(results)} story records from database")

        # Collect all chapter and section ids (Neo4j gr_id node id = Postgres gr_id.id)
        all_gr_ids = []
        for record in results:
            story_data = record.get("story", {})
            if not story_data:
                continue
            for chapter_data in story_data.get("chapters", []) or []:
                ch_id = (chapter_data or {}).get("id") or (chapter_data or {}).get("gid")
                if ch_id:
                    all_gr_ids.append(str(ch_id))
                for section_data in (chapter_data or {}).get("sections", []) or []:
                    sec_id = (section_data or {}).get("id") or (section_data or {}).get("gid")
                    if sec_id:
                        all_gr_ids.append(str(sec_id))
        # Get exact section_number and chapter_number from Postgres gr_id (match by id), replace Neo4j values
        order_map = _get_gr_id_order_map(all_gr_ids)

        # Collect story ids and fetch gr_id details from Postgres for each story
        story_ids_for_gr = []
        for record in results:
            story_data = record.get("story", {})
            if not story_data:
                continue
            story_id_raw = story_data.get("story_id")
            story_gid = story_data.get("story_gid")
            story_title = story_data.get("story_title", "")
            sid = (
                str(story_id_raw).strip()
                if story_id_raw
                else (str(story_gid or "").strip() or generate_id_from_title(story_title))
            )
            if sid:
                story_ids_for_gr.append(sid)
        gr_id_details_map = _get_gr_id_details_map(story_ids_for_gr)

        def _chapter_sort_key(cid: str) -> float:
            n = order_map.get(str(cid), {}).get("chapter_number")
            if n is not None:
                try:
                    return float(n)
                except (TypeError, ValueError):
                    pass
            return 999999.0

        def _section_sort_key(sid: str) -> float:
            n = order_map.get(str(sid), {}).get("section_number")
            if n is not None:
                try:
                    return float(n)
                except (TypeError, ValueError):
                    pass
            return 999999.0

        stories = []
        for record in results:
            story_data = record.get("story", {})
            if not story_data:
                continue

            story_title = story_data.get("story_title", "")
            story_id_raw = story_data.get("story_id")
            story_brief = story_data.get("story_brief", "")
            if story_brief is not None:
                story_brief = str(story_brief).strip()
            else:
                story_brief = ""
            logger.debug(f"Processing story: {story_title} (id: {story_id_raw}, brief length: {len(story_brief)})")

            story_id = str(story_id_raw).strip() if story_id_raw else (str(story_data.get("story_gid", "")).strip() or generate_id_from_title(story_title))

            chapters = []
            for chapter_data in story_data.get("chapters", []):
                chapter_id_val = (chapter_data or {}).get("id") or (chapter_data or {}).get("gid")
                if not chapter_data or not chapter_id_val:
                    continue

                chapter_id = str(chapter_id_val)
                chapter_title = chapter_data.get("chapter_title", "")
                chapter_total_nodes = chapter_data.get("total_nodes", 0) or 0
                # Replace with exact chapter_number from Postgres gr_id (match by id)
                pg_ch = order_map.get(chapter_id, {}).get("chapter_number")
                if pg_ch is not None:
                    try:
                        chapter_number = int(pg_ch)
                    except (TypeError, ValueError):
                        chapter_number = chapter_data.get("chapter_number", 0)
                else:
                    chapter_number = chapter_data.get("chapter_number", 0)

                sections = []
                for section_data in chapter_data.get("sections", []):
                    section_id_val = (section_data or {}).get("id") or (section_data or {}).get("gid")
                    if not section_data or not section_id_val:
                        continue

                    section_id = str(section_id_val)
                    section_title = section_data.get("section_title", "")
                    # Replace with exact section_number from Postgres gr_id (match by id)
                    pg_sec = order_map.get(section_id, {}).get("section_number")
                    if pg_sec is not None:
                        try:
                            section_number = int(pg_sec)
                        except (TypeError, ValueError):
                            section_number = section_data.get("section_number") or section_data.get("section_num", 0)
                    else:
                        section_number = section_data.get("section_number") or section_data.get("section_num", 0)

                    pg_cha = order_map.get(section_id, {}).get("chapter_number")
                    if pg_cha is not None:
                        try:
                            chapter_number = int(pg_cha)
                        except (TypeError, ValueError):
                            chapter_number = section_data.get("chapter_number")
                    else:
                        chapter_number = section_data.get("chapter_number")

                    sections.append(Section(
                        id=section_id,
                        title=section_title or f"Section {section_number}",
                        headline=section_title or f"Section {section_number}",
                        brief=section_data.get("brief") or "",
                        graphPath=None,
                        section_query=section_data.get("section_query"),
                        chapter_number=chapter_number,
                        section_number=section_number
                    ))

                sections.sort(key=lambda s: (s.section_number if s.section_number is not None else 999999))

                chapters.append(Chapter(
                    id=chapter_id,
                    title=chapter_title or f"Chapter {chapter_number}",
                    headline=chapter_title or f"Chapter {chapter_number}",
                    brief="",
                    sections=sections,
                    total_nodes=int(chapter_total_nodes) if chapter_total_nodes else 0,
                    chapter_number=chapter_number
                ))

            # Sort by chapter_number ASC (from chapter or first section); fallback to title for tie-break
            def _chapter_sort_num(ch):
                if ch.chapter_number is not None:
                    return ch.chapter_number
                if ch.sections:
                    first = next((s for s in ch.sections if s.chapter_number is not None), None)
                    if first is not None:
                        return first.chapter_number
                return 999999
            chapters.sort(key=lambda c: (_chapter_sort_num(c), (c.title or "").lower()))

            story_img_url = story_data.get("story_img_url")
            if story_img_url is not None and str(story_img_url).strip() == "":
                story_img_url = None
            elif story_img_url is not None:
                story_img_url = str(story_img_url).strip() or None

            detail = gr_id_details_map.get(story_id)
            stories.append(Story(
                id=story_id,
                title=story_title,
                headline=story_title,
                brief=story_brief,  # Already processed above
                path=generate_id_from_title(story_title),
                chapters=chapters,
                img_url=story_img_url,
                detail=detail
            ))
        logger.info(f"Successfully processed {len(stories)} stories")
        return stories
    except Exception as e:
        # Wrap errors with more context
        error_msg = f"Error fetching stories: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise Exception(error_msg) from e

def get_graph_data(section_gid: Optional[str] = None, section_query: Optional[str] = None, section_title: Optional[str] = None, graph_path: Optional[str] = None) -> GraphData:
    try:
        # Resolve which param to use (graph_path is treated as section_query)
        if graph_path:
            logger.debug(f"Fetching graph data by graph_path: {graph_path}")
            use_section_query, use_section_gid, use_section_title = graph_path, None, None
        elif section_gid:
            logger.debug(f"Fetching graph data by section_gid: {section_gid}")
            use_section_query, use_section_gid, use_section_title = None, section_gid, None
        elif section_query:
            logger.debug(f"Fetching graph data by section_query: {section_query}")
            use_section_query, use_section_gid, use_section_title = section_query, None, None
        elif section_title:
            logger.debug(f"Fetching graph data by section_title: {section_title}")
            use_section_query, use_section_gid, use_section_title = None, None, section_title
        else:
            raise ValueError("Either section_gid, section_query, section_title, or graph_path must be provided")

        def run_legacy():
            if use_section_gid:
                return get_graph_data_by_section_query_legacy(section_gid=use_section_gid)
            if use_section_query:
                return get_graph_data_by_section_query_legacy(section_query=use_section_query)
            return get_graph_data_by_section_query_legacy(section_title=use_section_title)

        # Try gr_id schema first
        if use_section_gid:
            query, params = get_graph_data_by_section_query(section_gid=use_section_gid)
        elif use_section_query:
            query, params = get_graph_data_by_section_query(section_query=use_section_query)
        else:
            query, params = get_graph_data_by_section_query(section_title=use_section_title)

        t0 = time.perf_counter()
        results = db.execute_query(query, params)
        logger.debug(f"Retrieved graph data: {len(results)} result(s)")

        # Fallback to legacy :section schema if no results or empty graph
        if not results:
            logger.debug("No results from gr_id graph query, trying legacy section query")
            query, params = run_legacy()
            results = db.execute_query(query, params)
        else:
            gd = results[0].get("graphData") or {}
            if not gd.get("nodes") and not gd.get("links"):
                logger.debug("Empty graphData from gr_id query, trying legacy section query")
                query, params = run_legacy()
                results = db.execute_query(query, params)

        t_db = time.perf_counter() - t0

        if not results:
            return GraphData(nodes=[], links=[])

        graph_data = results[0].get("graphData", {})
        raw_nodes = graph_data.get("nodes", [])
        raw_links = graph_data.get("links", [])

        t_format_start = time.perf_counter()
        nodes = []
        for node_data in raw_nodes:
            nodes.append(format_node(node_data))

        links = []
        for link_data in raw_links:
            links.append(format_link(link_data))

        t_format = time.perf_counter() - t_format_start
        logger.info(
            f"[perf] get_graph_data: db={t_db:.2f}s format={t_format:.2f}s nodes={len(nodes)} links={len(links)}"
        )
        return GraphData(nodes=nodes, links=links)
    except ValueError as e:
        # Re-raise ValueError as-is (these are expected validation errors)
        logger.warning(f"Validation error in get_graph_data: {str(e)}")
        raise
    except Exception as e:
        # Wrap unexpected errors with more context
        error_msg = f"Error fetching graph data: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise Exception(error_msg) from e


def _get_gr_id_order_map(ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """
    Fetch id -> { chapter_number, section_number } from Postgres gr_id table.
    gr_id table and Neo4j gr_id node are matched by id (gr_id.id = node.id).
    Returns exact section_number and chapter_number from Postgres to replace Neo4j values.
    """
    if not ids:
        return {}
    try:
        from neon_database import neon_db
        if not neon_db.is_configured():
            return {}
        id_list = list({str(i).strip() for i in ids if i})
        if not id_list:
            return {}
        results = neon_db.execute_query(
            "SELECT id, chapter_number, section_number FROM gr_id WHERE id = ANY(%s)",
            (id_list,)
        )
        order_map = {}
        for row in (results or []):
            if not row or row.get("id") is None:
                continue
            key = str(row["id"]).strip()
            ch_num, sec_num = row.get("chapter_number"), row.get("section_number")
            if ch_num is not None and hasattr(ch_num, "__float__"):
                try:
                    ch_num = int(ch_num) if float(ch_num) == int(float(ch_num)) else float(ch_num)
                except (TypeError, ValueError):
                    ch_num = None
            if sec_num is not None and hasattr(sec_num, "__float__"):
                try:
                    sec_num = int(sec_num) if float(sec_num) == int(float(sec_num)) else float(sec_num)
                except (TypeError, ValueError):
                    sec_num = None
            order_map[key] = {"chapter_number": ch_num, "section_number": sec_num}
        return order_map
    except Exception as e:
        logger.debug(f"gr_id order from Postgres not available: {e}")
        return {}


def _get_gr_id_details_map(ids: List[str]) -> Dict[str, StoryDetail]:
    """
    Fetch full gr_id row details from Postgres for given ids.
    Returns id -> GrIdDetails. Used to enrich story data with Postgres gr_id fields.
    """
    if not ids:
        return {}
    try:
        from neon_database import neon_db
        if not neon_db.is_configured():
            return {}
        id_list = list({str(i).strip() for i in ids if i})
        if not id_list:
            return {}
        results = neon_db.execute_query(
            "SELECT id, name, description, story, chapter, location, date_start, date_end, "
            "status, created_at, updated_at, chapter_number, db_name, section_number "
            "FROM gr_id WHERE id = ANY(%s)",
            (id_list,)
        )
        details_map = {}
        for row in (results or []):
            if not row or row.get("id") is None:
                continue
            key = str(row["id"]).strip()
            # Serialize datetime to ISO string for JSON
            created_at = row.get("created_at")
            if created_at is not None and hasattr(created_at, "isoformat"):
                created_at = created_at.isoformat()
            elif created_at is not None:
                created_at = str(created_at)
            updated_at = row.get("updated_at")
            if updated_at is not None and hasattr(updated_at, "isoformat"):
                updated_at = updated_at.isoformat()
            elif updated_at is not None:
                updated_at = str(updated_at)
            ch_num, sec_num = row.get("chapter_number"), row.get("section_number")
            if ch_num is not None and hasattr(ch_num, "__float__"):
                try:
                    ch_num = int(ch_num) if float(ch_num) == int(float(ch_num)) else float(ch_num)
                except (TypeError, ValueError):
                    ch_num = None
            if sec_num is not None and hasattr(sec_num, "__float__"):
                try:
                    sec_num = int(sec_num) if float(sec_num) == int(float(sec_num)) else float(sec_num)
                except (TypeError, ValueError):
                    sec_num = None
            def _str_or_none(val):
                if val is None:
                    return None
                s = str(val).strip()
                return s if s else None

            details_map[key] = StoryDetail(
                name=_str_or_none(row.get("name")),
                description=_str_or_none(row.get("description")),
                story=_str_or_none(row.get("story")),
                chapter=_str_or_none(row.get("chapter")),
                location=_str_or_none(row.get("location")),
                date_start=_str_or_none(row.get("date_start")),
                date_end=_str_or_none(row.get("date_end")),
                status=_str_or_none(row.get("status")),
                created_at=created_at,
                updated_at=updated_at,
                chapter_number=int(ch_num) if ch_num is not None else None,
                db_name=_str_or_none(row.get("db_name")),
                section_number=int(sec_num) if sec_num is not None else None,
            )
        return details_map
    except Exception as e:
        logger.debug(f"gr_id details from Postgres not available: {e}")
        return {}


def get_gr_id_description(gr_id_value: str) -> Optional[str]:
    """
    Get description for a section from Neon gr_id table.
    gr_id_value is the id that matches gr_id.id in Postgres (same as gr_id node id in Neo4j).
    """
    if not (gr_id_value or "").strip():
        return None
    try:
        from neon_database import neon_db
        if not neon_db.is_configured():
            return None
        t0 = time.perf_counter()
        key = gr_id_value.strip()
        results = neon_db.execute_query("SELECT description FROM gr_id WHERE id = %s LIMIT 1", (key,))
        elapsed = time.perf_counter() - t0
        if elapsed > 0.5:
            logger.info(f"[perf] get_gr_id_description: {elapsed:.2f}s")
        if results and results[0]:
            desc = (results[0].get("description") or "").strip()
            return desc if desc else None
    except Exception as e:
        logger.warning(f"Could not get gr_id description from Neon: {e}")
    return None


def get_article_details_by_node_id(node_id: str) -> Optional[Dict[str, Any]]:
    """
    Get detailed article data for an article node.
    Uses Postgres: article_chunk.id = node_id -> article_id, then article.id = article_id.
    Returns the article row as a dict, or None if not found.
    """
    if not (node_id or "").strip():
        return None
    try:
        from neon_database import neon_db
        if not neon_db.is_configured():
            return None
        key = str(node_id).strip()
        # article_chunk.id matches the graph node id; article_chunk.article_id -> article.id
        results = neon_db.execute_query(
            "SELECT a.* FROM article a "
            "INNER JOIN article_chunk ac ON ac.article_id = a.id "
            "WHERE ac.id = %s LIMIT 1",
            (key,)
        )
        if not results or not results[0]:
            return None
        row = dict(results[0])
        # Make values JSON-serializable (e.g. date -> iso string)
        for k, v in list(row.items()):
            if hasattr(v, "isoformat"):
                row[k] = v.isoformat()
            elif hasattr(v, "strftime"):
                row[k] = v.strftime("%Y-%m-%d")
        return row
    except Exception as e:
        logger.warning(f"Could not get article details from Neon for node_id '{node_id}': {e}")
        return None


def get_graph_data_by_section_and_country(section_query: str, country_name: str) -> GraphData:
    """Fetch graph data filtered by section and country"""
    try:
        logger.debug(f"Fetching graph data for section '{section_query}' and country '{country_name}'")
        query, params = get_graph_data_by_section_and_country_query(section_query, country_name)
        logger.debug(f"Executing query with params: {params}")

        results = db.execute_query(query, params)
        logger.debug(f"Retrieved country-filtered graph data: {len(results)} result(s)")

        if not results:
            logger.warning(f"No results returned for section '{section_query}' and country '{country_name}'")
            return GraphData(nodes=[], links=[])

        graph_data = results[0].get("graphData", {})
        logger.debug(f"Graph data structure: nodes={len(graph_data.get('nodes', []))}, links={len(graph_data.get('links', []))}")

        nodes = []
        for node_data in graph_data.get("nodes", []):
            nodes.append(format_node(node_data))

        links = []
        for link_data in graph_data.get("links", []):
            links.append(format_link(link_data))

        logger.debug(f"Formatted country-filtered graph data: {len(nodes)} nodes, {len(links)} links")
        return GraphData(nodes=nodes, links=links)
    except ValueError as e:
        logger.warning(f"Validation error in get_graph_data_by_section_and_country: {str(e)}")
        raise
    except Exception as e:
        error_msg = f"Error fetching country-filtered graph data: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise Exception(error_msg) from e

def get_calendar_data(section_gid: Optional[str] = None, section_query: Optional[str] = None, section_title: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetch calendar/timeline data for a section.
    
    Returns:
    - timeline_items: sorted Milestone/Result/Incident/Action nodes (left-to-right sequence)
    - floating_items: Entity/Location/Event/etc nodes (position based on connections)
    - relationships: all connections for dynamic positioning
    """
    try:
        # Handle graph_path parameter - treat it as section_query if provided
        if section_query:
            logger.debug(f"Fetching calendar data by section_query: {section_query}")
            query, params = get_calendar_data_by_section_query(section_query=section_query)
        elif section_gid:
            logger.debug(f"Fetching calendar data by section_gid: {section_gid}")
            query, params = get_calendar_data_by_section_query(section_gid=section_gid)
        elif section_title:
            logger.debug(f"Fetching calendar data by section_title: {section_title}")
            query, params = get_calendar_data_by_section_query(section_title=section_title)
        else:
            raise ValueError("Either section_gid, section_query, or section_title must be provided")

        results = db.execute_query(query, params)
        logger.debug(f"Retrieved calendar data: {len(results)} result(s)")

        if not results:
            logger.warning(f"No results returned for calendar data query")
            return {
                "section_query": section_query or section_title or section_gid,
                "section_title": None,
                "timeline_items": [],
                "floating_items": [],
                "relationships": []
            }

        calendar_data = results[0].get("calendarData", {})
        
        # Handle case where calendarData might be None or empty
        if not calendar_data:
            logger.warning(f"calendarData is empty in results")
            return {
                "section_query": section_query or section_title or section_gid,
                "section_title": None,
                "timeline_items": [],
                "floating_items": [],
                "relationships": []
            }
        
        # Ensure all required keys exist with defaults
        if "timeline_items" not in calendar_data:
            calendar_data["timeline_items"] = []
        if "floating_items" not in calendar_data:
            calendar_data["floating_items"] = []
        if "relationships" not in calendar_data:
            calendar_data["relationships"] = []
        
        logger.info(
            f"Successfully retrieved calendar data: "
            f"{len(calendar_data.get('timeline_items', []))} timeline items, "
            f"{len(calendar_data.get('floating_items', []))} floating items, "
            f"{len(calendar_data.get('relationships', []))} relationships"
        )
        return calendar_data
    except ValueError as e:
        logger.warning(f"Validation error in get_calendar_data: {str(e)}")
        raise
    except Exception as e:
        error_msg = f"Error fetching calendar data: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise Exception(error_msg) from e


def get_cluster_data(
    node_type: str,
    property_key: str,
    section_query: Optional[str] = None,
    cluster_limit: int = 5,
    node_limit: int = 10
) -> Dict[str, Any]:
    """
    Fetch cluster data grouped by a node property for a given node type (label).
    """
    if not node_type or not str(node_type).strip():
        raise ValueError("node_type is required")
    if not property_key or not str(property_key).strip():
        raise ValueError("property_key is required")

    try:
        # Normalize node_type coming from the UI (db.schema.nodeTypeProperties() returns labels with casing/spaces).
        node_type_normalized = str(node_type).strip().lower().replace(" ", "_")

        query, params = get_cluster_data_query(
            node_type=node_type_normalized,
            property_key=str(property_key).strip(),
            section_query=section_query,
            cluster_limit=int(cluster_limit),
            node_limit=int(node_limit),
        )

        results = db.execute_query(query, params)
        if not results:
            return {
                "node_type": node_type_normalized,
                "property_key": property_key,
                "section_query": section_query,
                "clusters": []
            }

        return results[0].get("clusterData", {
            "node_type": node_type_normalized,
            "property_key": property_key,
            "section_query": section_query,
            "clusters": []
        })
    except ValueError:
        raise
    except Exception as e:
        error_msg = f"Error fetching cluster data: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise Exception(error_msg) from e

def search_with_ai(user_query: str) -> Tuple[GraphData, str]:
    from ai_service import generate_cypher_query

    try:
        user_query = user_query.strip()
        logger.info(f"Processing AI search query: {user_query[:100]}...")

        if is_cypher_query(user_query):
            try:
                results = db.execute_query(user_query)
            except Exception as db_error:
                error_msg = str(db_error)
                raise ValueError(f"Cypher query execution failed: {error_msg}")

            if not results:
                return GraphData(nodes=[], links=[]), user_query

            return extract_graph_data_from_cypher_results(results), user_query

        try:
            cypher_query = generate_cypher_query(user_query)
        except ValueError as e:
            error_msg = str(e)
            if "GROK_API_KEY" in error_msg or "not configured" in error_msg.lower():
                raise ValueError("GROK API is not properly configured. Please check your .env file and ensure GROK_API_KEY is set.")
            elif "Network error" in error_msg or "connection" in error_msg.lower():
                raise ValueError("Failed to connect to GROK API. Please check your internet connection and try again.")
            elif "API error" in error_msg or "status_code" in error_msg.lower():
                raise ValueError(f"GROK API error: {error_msg}. Please check your API key and model settings.")
            else:
                raise ValueError(f"Failed to generate query: {error_msg}")

        if not cypher_query:
            raise ValueError("Failed to generate Cypher query from user query. Please try rephrasing your search.")

        try:
            if "$search_term" in cypher_query or "$param" in cypher_query.lower():
                try:
                    results = db.execute_query(cypher_query, {"search_term": user_query})
                except Exception as param_error:
                    results = db.execute_query(cypher_query)
            else:
                results = db.execute_query(cypher_query)
        except Exception as db_error:
            error_msg = str(db_error)
            raise ValueError(f"Query execution failed: {error_msg}")

        if not results:
            logger.info("AI search query returned no results")
            return GraphData(nodes=[], links=[]), cypher_query

        graph_data = extract_graph_data_from_cypher_results(results)
        logger.info(f"AI search successful: {len(graph_data.nodes)} nodes, {len(graph_data.links)} links")
        return graph_data, cypher_query

    except ValueError as e:
        logger.warning(f"Validation error in search_with_ai: {str(e)}")
        raise
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error in search_with_ai: {error_msg}", exc_info=True)
        if "GROK_API_KEY" in error_msg or "GROK" in error_msg.upper() or "API" in error_msg.upper():
            raise ValueError("AI search service is not properly configured. Please check GROK API settings in your .env file.")
        elif "Cannot resolve address" in error_msg or "connection" in error_msg.lower():
            raise ValueError("Database connection error. Please try again later.")
        raise ValueError(f"An error occurred during search: {error_msg}")

def get_story_statistics(story_id: str) -> Dict[str, Any]:
    """Get statistics for a story (total nodes, entity count, etc.)"""
    try:
        logger.debug(f"Fetching statistics for story: {story_id}")
        # Try gr_id schema by story_gid first, then by story_title
        query, params = get_story_statistics_query(story_gid=story_id)
        results = db.execute_query(query, params)
        if not results or len(results) == 0:
            logger.debug(f"No results for story_gid, trying story_title: {story_id}")
            query, params = get_story_statistics_query(story_title=story_id)
            results = db.execute_query(query, params)
        # Fallback to legacy :story/:chapter/:section schema
        if not results or len(results) == 0:
            logger.debug("No results from gr_id schema, trying legacy story statistics query")
            query, params = get_story_statistics_query_legacy(story_gid=story_id)
            results = db.execute_query(query, params)
        if not results or len(results) == 0:
            query, params = get_story_statistics_query_legacy(story_title=story_id)
            results = db.execute_query(query, params)
        if not results or len(results) == 0:
            logger.warning(f"No statistics found for story: {story_id}")
            return {
                "story_id": story_id,
                "total_nodes": 0,
                "entity_count": 0,
                "highlighted_nodes": 0,
                "updated_date": None
            }
        
        stats = results[0].get("statistics", {})
        total_nodes = stats.get("total_nodes", 0) or 0
        entity_count = stats.get("entity_count", 0) or 0
        highlighted_nodes = stats.get("highlighted_nodes", 0) or 0
        updated_date = stats.get("updated_date", None)
        
        logger.debug(f"Statistics for {story_id}: {total_nodes} nodes, {entity_count} entities, {highlighted_nodes} highlighted")
        return {
            "story_id": story_id,
            "total_nodes": total_nodes,
            "entity_count": entity_count,
            "highlighted_nodes": highlighted_nodes,
            "updated_date": updated_date
        }
    except Exception as e:
        # Return default values on error (same shape as success/not-found)
        logger.error(f"Error fetching statistics for story {story_id}: {str(e)}", exc_info=True)
        return {
            "story_id": story_id,
            "total_nodes": 0,
            "entity_count": 0,
            "highlighted_nodes": 0,
            "updated_date": None
        }

def get_all_node_types() -> List[str]:
    """Get all distinct node types from the database"""
    try:
        query, params = get_all_node_types_query()
        results = db.execute_query(query, params)
        
        if not results:
            # Fallback: return hardcoded list if query fails
            logger.warning("Failed to fetch node types from database, using fallback list")
            return [
                # New DB normalized labels (lowercase, underscores)
                # Primary entity types
                'entity', 'entity_gen', 'relationship',
                # Action/Process types
                'action', 'process', 'result', 'event_attend',
                # Financial types
                'funding', 'amount', 'disb_or_trans',
                # Organizational types
                'agency', 'recipient', 'dba', 'organization', 'department',
                'foundation', 'committee', 'council', 'institution', 'university',
                # Location types
                'country', 'location', 'place_of_performance', 'region', 'usaid_program_region',
                # Other types
                'description', 'publication', 'article', 'person', 'program',
                'event', 'concept', 'framework', 'data'
            ]
        
        node_types = [result.get("node_type") for result in results if result.get("node_type")]
        
        # If no results, return fallback list
        if not node_types:
            logger.warning("No node types found, using fallback list")
            return [
                # New DB normalized labels (lowercase, underscores)
                # Primary entity types
                'entity', 'entity_gen', 'relationship',
                # Action/Process types
                'action', 'process', 'result', 'event_attend',
                # Financial types
                'funding', 'amount', 'disb_or_trans',
                # Organizational types
                'agency', 'recipient', 'dba', 'organization', 'department',
                'foundation', 'committee', 'council', 'institution', 'university',
                # Location types
                'country', 'location', 'place_of_performance', 'region', 'usaid_program_region',
                # Other types
                'description', 'publication', 'article', 'person', 'program',
                'event', 'concept', 'framework', 'data'
            ]
        
        return node_types
    except Exception as e:
        logger.error(f"Error fetching node types: {str(e)}", exc_info=True)
        # Return fallback list on error
        return [
            # New DB normalized labels (lowercase, underscores)
            # Primary entity types
            'entity', 'entity_gen', 'relationship',
            # Action/Process types
            'action', 'process', 'result', 'event_attend',
            # Financial types
            'funding', 'amount', 'disb_or_trans',
            # Organizational types
            'agency', 'recipient', 'dba', 'organization', 'department',
            'foundation', 'committee', 'council', 'institution', 'university',
            # Location types
            'country', 'location', 'place_of_performance', 'region', 'usaid_program_region',
            # Other types
            'description', 'publication', 'article', 'person', 'program',
            'event', 'concept', 'framework', 'data'
        ]


def generate_graph_summary(query: str, graph_data: dict) -> dict:
    """
    Generate an AI summary of graph data with embedded entity markers.
    
    Args:
        query: User's question about the graph
        graph_data: Dict containing nodes and links
        
    Returns:
        Dict with summary text containing [[Entity Name]] markers
    """
    from config import Config
    import requests
    
    if not Config.GROK_API_KEY:
        raise ValueError("GROK_API_KEY is not configured. Please set it in your .env file.")
    
    nodes = graph_data.get('nodes', [])
    links = graph_data.get('links', [])
    
    if not nodes:
        return {
            "summary": "No graph data available to summarize.",
            "entities": []
        }
    
    # Build a summary of the graph structure for the AI
    entity_names = []
    entity_types = {}
    
    for node in nodes:
        name = node.get('name') or node.get('entity_name') or node.get('id', '')
        node_type = node.get('node_type') or node.get('type') or 'Entity'
        if name:
            entity_names.append(name)
            entity_types[name] = node_type
    
    # Build relationship descriptions
    relationship_descriptions = []
    for link in links[:50]:  # Limit to first 50 relationships
        from_name = link.get('from_name') or link.get('source', '')
        to_name = link.get('to_name') or link.get('target', '')
        rel_type = link.get('type') or link.get('label') or 'relates to'
        rel_summary = link.get('relationship_summary', '')
        
        if from_name and to_name:
            desc = f"- {from_name} {rel_type} {to_name}"
            if rel_summary:
                desc += f" ({rel_summary[:100]})"
            relationship_descriptions.append(desc)
    
    # Build the prompt
    prompt = f"""You are an investigative analyst assistant. Analyze the following graph data and answer the user's question.

User Question: {query}

Graph Contains:
- {len(nodes)} nodes (entities)
- {len(links)} relationships

Key Entities (first 30):
{chr(10).join(f'- {name} ({entity_types.get(name, "Entity")})' for name in entity_names[:30])}

Key Relationships (first 20):
{chr(10).join(relationship_descriptions[:20])}

IMPORTANT INSTRUCTIONS:
1. Provide a concise, insightful summary that answers the user's question
2. When mentioning entities that exist in the graph, wrap them in double brackets like [[Entity Name]]
3. Only use [[brackets]] for entity names that EXACTLY match names from the "Key Entities" list above
4. Focus on the most significant connections and patterns
5. Be specific and cite actual entity names from the data
6. Keep the summary under 300 words
7. If the question cannot be answered from the data, explain what information is available

Example format:
"The investigation reveals that [[Organization A]] has significant ties to [[Person B]] through multiple funding channels. [[Organization C]] appears to be a key intermediary..."

Generate the summary:"""

    try:
        headers = {
            "Authorization": f"Bearer {Config.GROK_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "messages": [
                {
                    "role": "system",
                    "content": "You are an investigative analyst. Provide clear, factual summaries based on graph data. Always use [[Entity Name]] format when referencing entities."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "model": Config.GROK_MODEL,
            "temperature": 0.3,
            "max_tokens": 1000
        }
        
        response = requests.post(
            Config.GROK_API_URL,
            headers=headers,
            json=payload,
            timeout=60
        )
        
        if response.status_code != 200:
            error_text = response.text
            logger.error(f"GROK API error: {response.status_code} - {error_text}")
            raise ValueError(f"AI service error: {response.status_code}")
        
        result = response.json()
        choices = result.get("choices", [])
        
        if not choices:
            raise ValueError("AI service returned no response")
        
        summary_text = choices[0].get("message", {}).get("content", "").strip()
        
        if not summary_text:
            raise ValueError("AI service returned empty summary")
        
        # Extract entity names from the summary (those in [[brackets]])
        import re
        mentioned_entities = re.findall(r'\[\[([^\]]+)\]\]', summary_text)
        
        # Validate that mentioned entities exist in the graph
        valid_entities = []
        entity_name_lower_map = {name.lower(): name for name in entity_names}
        
        for entity in mentioned_entities:
            entity_lower = entity.lower()
            if entity_lower in entity_name_lower_map:
                valid_entities.append({
                    "name": entity_name_lower_map[entity_lower],
                    "mentioned_as": entity
                })
        
        return {
            "summary": summary_text,
            "entities": valid_entities,
            "query": query,
            "node_count": len(nodes),
            "link_count": len(links)
        }
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Network error connecting to AI service: {e}")
        raise ValueError("Failed to connect to AI service. Please check your internet connection.")
    except Exception as e:
        logger.error(f"Error generating summary: {e}")
        raise


def get_entity_wikidata(entity_name: str) -> Dict[str, Any]:
    """
    Fetch detailed entity information from Neon PostgreSQL wikidata table.
    Searches by name (case-insensitive partial match).
    
    Args:
        entity_name: The name of the entity to search for
        
    Returns:
        Dict with 'found' boolean and 'data' containing entity details if found
    """
    from neon_database import neon_db
    from urllib.parse import unquote
    
    # Decode URL-encoded entity name and clean it
    entity_name = unquote(entity_name).strip()
    
    logger.debug(f"Fetching wikidata for entity: '{entity_name}'")
    
    # Check if Neon database is configured
    if not neon_db.is_configured():
        logger.warning("Neon database not configured, returning empty result")
        return {"found": False, "data": None, "error": "Wikidata database not configured"}
    
    try:
        # Verify we're querying the correct table in the wuhan database
        # The query explicitly targets entity_wikidata table
        query = """
            SELECT 
                qid, name, alias, description,
                sex_or_gender, sex_or_gender_label, 
                wikipedia_url, image_url, logo_url, url,
                father, father_label, mother, mother_label, 
                spouse, spouse_label, children, children_label,
                country, country_label, headquarters, headquarters_label, 
                place_of_birth, place_of_birth_label, location, location_label,
                citizenship, citizenship_label,
                date_birth, date_death,
                occupation, occupation_label, educated_at, educated_at_label,
                position_held, position_held_label, field_of_work, field_of_work_label,
                significant_event, significant_event_label, residence, residence_label,
                founded_by, founded_by_label, industry, industry_label,
                start_time, end_time,
                instance_of, instance_of_label, award_received, award_reeived_label,
                viafid, locid, worldcat_id, locator_map, coordinates
            FROM entity_wikidata
            WHERE LOWER(TRIM(name)) = LOWER(TRIM(%s))
               OR LOWER(TRIM(name)) LIKE LOWER(%s)
               OR (alias IS NOT NULL AND LOWER(TRIM(alias)) LIKE LOWER(%s))
            ORDER BY 
                CASE 
                    WHEN LOWER(TRIM(name)) = LOWER(TRIM(%s)) THEN 0
                    WHEN LOWER(TRIM(name)) LIKE LOWER(%s) THEN 1
                    ELSE 2
                END,
                LENGTH(name)
            LIMIT 1
        """
         
        search_pattern = f"%{entity_name}%"
        
        logger.debug(f"Querying entity_wikidata table for: '{entity_name}'")
        logger.debug(f"Search pattern: '{search_pattern}'")
        
        results = neon_db.execute_query(
            query, 
            (entity_name, search_pattern, search_pattern, entity_name, search_pattern)
        )
        
        logger.debug(f"Query returned {len(results) if results else 0} result(s)")

        if results:
            entity_data = dict(results[0])
            db_name = entity_data.get('name', 'N/A')
            
            # Convert datetime objects to strings for JSON serialization
            # Also handle empty strings for image URLs
            for key, value in entity_data.items():
                if hasattr(value, 'isoformat'):
                    entity_data[key] = value.isoformat()
                elif value is None:
                    entity_data[key] = None
                elif key in ['image_url', 'logo_url'] and value == '':
                    # Convert empty strings to None for image URLs
                    entity_data[key] = None
                    logger.debug(f"Converted empty {key} to None")

            logger.debug(f"Retrieved wikidata for entity: '{entity_name}' (matched to DB name: '{db_name}')")
            return {"found": True, "data": entity_data}
        else:
            logger.warning(f"No wikidata found in entity_wikidata table for entity: '{entity_name}'")
            
            # Debug: Try to find what's actually in the database
            try:
                debug_query = """
                    SELECT name, alias, qid
                    FROM entity_wikidata 
                    WHERE LOWER(TRIM(name)) LIKE LOWER(%s)
                       OR (alias IS NOT NULL AND LOWER(TRIM(alias)) LIKE LOWER(%s))
                    LIMIT 10
                """
                # Try with first significant word
                words = [w for w in entity_name.split() if len(w) > 2]
                first_word = words[0] if words else entity_name[:10]
                debug_pattern = f"%{first_word}%"
                debug_results = neon_db.execute_query(debug_query, (debug_pattern, debug_pattern))
                if debug_results:
                    logger.debug(f"Similar entities in database (searching for '{first_word}'): {[row.get('name') for row in debug_results]}")
            except Exception as debug_err:
                logger.debug(f"Debug query failed: {debug_err}")
            
            return {"found": False, "data": None}
            
    except Exception as e:
        logger.error(f"Error fetching entity wikidata for '{entity_name}': {e}")
        logger.exception(e)  # Log full traceback
        raise


def get_wikidata_by_id(node_id: str, node_type: str = None) -> Dict[str, Any]:
    """
    Fetch entity by node id and enrich with all fields from entity_wikidata.
    Matches on entity.id = entity_wikidata.id. Returns merged entity + entity_wikidata
    so the frontend can show all valid values on the node properties tab.
    
    Args:
        node_id: The node/entity id from the graph
        node_type: Optional node type (entity, concept, data, entity_gen, framework)
        
    Returns:
        Dict with 'found' boolean and 'data' containing all entity + entity_wikidata fields
    """
    from neon_database import neon_db
        
    logger.debug(f"Fetching wikidata for node_id: '{node_id}'" + (f", node_type: '{node_type}'" if node_type else ""))
    
    if not neon_db.is_configured():
        logger.warning("Neon database not configured, returning empty result")
        return {"found": False, "data": None, "error": "Wikidata database not configured"}
    
    if not node_id:
        return {"found": False, "data": None}
    
    try:
        # Fetch entity row
        entity_query = "SELECT * FROM entity WHERE id = %s LIMIT 1"
        entity_results = neon_db.execute_query(entity_query, (node_id,))
        if not entity_results:
            logger.warning(f"No entity found for node_id: '{node_id}'")
            return {"found": False, "data": None}
        
        entity_row = dict(entity_results[0])
        merged = {}
        for k, v in entity_row.items():
            merged[k] = v
        
        # Fetch entity_wikidata row (same id) and merge
        wikidata_query = "SELECT * FROM entity_wikidata WHERE id = %s LIMIT 1"
        wikidata_results = neon_db.execute_query(wikidata_query, (node_id,))
        if wikidata_results:
            wikidata_row = dict(wikidata_results[0])
            for k, v in wikidata_row.items():
                merged[k] = v
        
        # Serialize and normalize
        empty_url_keys = {'image_url', 'logo_url', 'wikipedia_url', 'url', 'alias', 'subtype'}
        for key, value in list(merged.items()):
            if hasattr(value, 'isoformat'):
                merged[key] = value.isoformat()
            elif value is None:
                merged[key] = None
            elif key in empty_url_keys and value == '':
                merged[key] = None
            elif isinstance(value, str) and value.strip() == '':
                merged[key] = None
        
        logger.debug(f"Found entity and wikidata for node_id: '{node_id}'")
        return {"found": True, "data": merged}
        
    except Exception as e:
        logger.error(f"Error fetching wikidata for node_id '{node_id}': {e}")
        raise


def search_entity_wikidata(search_term: str, limit: int = 10) -> Dict[str, Any]:
    """
    Search for entities in the wikidata table.
    Returns multiple matches for autocomplete/search functionality.
    
    Args:
        search_term: The search term to look for
        limit: Maximum number of results to return
        
    Returns:
        Dict with 'results' list of matching entities
    """
    from neon_database import neon_db
    
    logger.debug(f"Searching wikidata for: {search_term}")
    
    if not neon_db.is_configured():
        logger.warning("Neon database not configured")
        return {"results": [], "error": "Wikidata database not configured"}
    
    try:
        query = """
            SELECT 
                qid, name, alias, description, instance_of_label,
                image_url, wikipedia_url
            FROM entity_wikidata
            WHERE LOWER(name) LIKE LOWER(%s)
               OR LOWER(alias) LIKE LOWER(%s)
            ORDER BY 
                CASE WHEN LOWER(name) = LOWER(%s) THEN 0 
                     WHEN LOWER(name) LIKE LOWER(%s) THEN 1 
                     ELSE 2 END,
                LENGTH(name)
            LIMIT %s
        """
        
        search_pattern = f"%{search_term}%"
        starts_with_pattern = f"{search_term}%"
        
        results = neon_db.execute_query(
            query, 
            (search_pattern, search_pattern, search_term, starts_with_pattern, limit)
        )
        
        entities = []
        for row in results:
            entity = dict(row)
            entities.append({
                "qid": entity.get("qid"),
                "name": entity.get("name"),
                "alias": entity.get("alias"),
                "description": entity.get("description"),
                "type": entity.get("instance_of_label"),
                "image_url": entity.get("image_url"),
                "wikipedia_url": entity.get("wikipedia_url")
            })
        
        logger.debug(f"Found {len(entities)} wikidata matches for: {search_term}")
        return {"results": entities, "count": len(entities)}
        
    except Exception as e:
        logger.error(f"Error searching entity wikidata: {e}")
        raise

