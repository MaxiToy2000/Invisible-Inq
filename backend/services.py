from typing import List, Dict, Any, Optional, Tuple
import logging
from database import db
from queries import (
    get_all_stories_query,
    get_story_by_id_query,
    get_graph_data_by_section_query,
    get_graph_data_by_section_and_country_query,
    get_section_by_id_query,
    get_story_statistics_query,
    get_all_node_types_query,
    get_calendar_data_by_section_query,
    get_cluster_data_query
)
from models import Story, Chapter, Substory, Node, Link, GraphData

logger = logging.getLogger(__name__)

def generate_id_from_title(title: str) -> str:
    return title.lower().replace(' ', '_').replace('&', 'and').replace('/', '_').replace("'", '').replace('-', '_')

def format_node(node_data: Dict[str, Any]) -> Dict[str, Any]:
    gid_value = node_data.get("gid")
    node_id = str(gid_value) if gid_value is not None else ""

    node_type = node_data.get("node_type", "")

    node = {
        "id": node_id,
        "gid": gid_value,
        "node_type": node_type,
        "section": node_data.get("section"),
        "category": None,
        "color": None,
        "highlight": False,
    }

    if node_type == "Entity":
        entity_name = node_data.get("entity_name")
        gid_fallback = str(gid_value) if gid_value is not None else ""
        node["name"] = str(entity_name) if entity_name is not None else gid_fallback
        node["entity_name"] = node_data.get("entity_name")
        node["entity_acronym"] = node_data.get("entity_acronym")
        node["relationship_name"] = node_data.get("relationship_name")
        node["amount"] = node_data.get("amount")
        node["receiver_name"] = node_data.get("receiver_name")
        node["article_url"] = node_data.get("article_url")
        node["degree"] = node_data.get("degree")
        node["purpose"] = node_data.get("purpose")
        node["url"] = node_data.get("url")
        node["relationship_summary"] = node_data.get("relationship_summary")
        node["entity_2_name"] = node_data.get("entity_2_name")
        node["date"] = node_data.get("date")
        node["action_summary"] = node_data.get("action_summary")
        node["article_url_full"] = node_data.get("article_url_full")
        node["article_text"] = node_data.get("article_text")
        node["article_title"] = node_data.get("article_title")
        node["distributor_full_name"] = node_data.get("distributor_full_name")
        node["summary"] = node_data.get("summary")
        node["modifier_entity_name"] = node_data.get("modifier_entity_name")
        node["relationship_date"] = node_data.get("relationship_date")
        node["tag"] = node_data.get("tag")
        node["action_text"] = node_data.get("action_text")
    elif node_type == "Relationship":
        rel_name = node_data.get("relationship_name")
        rel_summary = node_data.get("relationship_summary")
        gid_fallback = str(gid_value) if gid_value is not None else ""
        node["name"] = str(rel_name) if rel_name is not None else (str(rel_summary) if rel_summary is not None else gid_fallback)
        node["relationship_name"] = node_data.get("relationship_name")
        node["article_text"] = node_data.get("article_text")
        node["article_url"] = node_data.get("article_url")
        node["degree"] = node_data.get("degree")
        node["relationship_date"] = node_data.get("relationship_date")
        node["tag"] = node_data.get("tag")
        node["relationship_summary"] = node_data.get("relationship_summary")
    elif node_type == "Funding":
        desc = node_data.get("prime_award_base_transaction_description")
        gid_fallback = str(gid_value) if gid_value is not None else ""
        node["name"] = str(desc) if desc is not None else gid_fallback
        for key in ["prime_award_obligated_amount_from_covid_19_supplementals", "prime_award_total_outlayed_amount",
                    "prime_award_latest_action_date", "action_date", "initial_report_date", "last_modified_date",
                    "generated_pragmatic_obligations", "prime_award_base_action_date",
                    "prime_award_program_activities_funding_this_award", "total_outlayed_amount_for_overall_award",
                    "subaward_description", "assistance_transaction_unique_key", "usaspending_permalink",
                    "prime_award_outlayed_amount_from_covid_19_supplementals", "prime_award_base_transaction_description",
                    "period_of_performance_start_date", "federal_action_obligation",
                    "prime_award_period_of_performance_current_end_date", "prime_award_period_of_performance_start_date",
                    "program_activities_funding_this_award", "total_obligated_amount", "cfda_title",
                    "period_of_performance_current_end_date"]:
            if node_data.get(key) is not None:
                node[key] = node_data.get(key)
    elif node_type == "Amount":
        trans_desc = node_data.get("transaction_description")
        gid_fallback = str(gid_value) if gid_value is not None else ""
        node["name"] = str(trans_desc) if trans_desc is not None else gid_fallback
        
        # Include all Amount-specific fields from the database
        for key in ["Amount", "Distributor Full Name", "Receiver Name", "Purpose", 
                    "Disb Date", "End Date", "Project Number", "ID", "Summary", "URL",
                    "federal_action_obligation", "awarding_office_name", "action_date_fiscal_year",
                    "primary_place_of_performance_scope", "action_date", "initial_report_date", "last_modified_date",
                    "awarding_agency_name", "transaction_description", "generated_pragmatic_obligations",
                    "primary_place_of_performance_country_name", "object_classes_funding_this_award", "cfda_title",
                    "awarding_sub_agency_name", "total_outlayed_amount_for_overall_award",
                    "period_of_performance_current_end_date", "primary_place_of_performance_city_name",
                    "usaspending_permalink", "prime_award_base_transaction_description", "period_of_performance_start_date"]:
            if node_data.get(key) is not None:
                node[key] = node_data.get(key)
    elif node_type == "Agency":
        agency_name = node_data.get("awarding_agency_name")
        prime_agency = node_data.get("prime_award_awarding_agency_name")
        gid_fallback = str(gid_value) if gid_value is not None else ""
        node["name"] = str(agency_name) if agency_name is not None else (str(prime_agency) if prime_agency is not None else gid_fallback)
        if node_data.get("prime_award_awarding_agency_name") is not None:
            node["prime_award_awarding_agency_name"] = node_data.get("prime_award_awarding_agency_name")
        if node_data.get("awarding_agency_name") is not None:
            node["awarding_agency_name"] = node_data.get("awarding_agency_name")
    elif node_type == "Action":
        action_summary = node_data.get("action_summary")
        article_title = node_data.get("article_title")
        gid_fallback = str(gid_value) if gid_value is not None else ""
        node["name"] = str(action_summary) if action_summary is not None else (str(article_title) if article_title is not None else gid_fallback)
        for key in ["action_summary", "article_url", "article_title", "degree", "action_text"]:
            if node_data.get(key) is not None:
                node[key] = node_data.get(key)
    elif node_type == "Country":
        country_name = node_data.get("country_name")
        gid_fallback = str(gid_value) if gid_value is not None else ""
        node["name"] = str(country_name) if country_name is not None else gid_fallback
        if node_data.get("country_name") is not None:
            node["country_name"] = node_data.get("country_name")
        if node_data.get("degree") is not None:
            node["degree"] = node_data.get("degree")
    elif node_type == "DBA":
        recipient_name = node_data.get("recipient_name_raw")
        gid_fallback = str(gid_value) if gid_value is not None else ""
        node["name"] = str(recipient_name) if recipient_name is not None else gid_fallback
        if node_data.get("recipient_name_raw") is not None:
            node["recipient_name_raw"] = node_data.get("recipient_name_raw")
        if node_data.get("subawardee_name") is not None:
            node["subawardee_name"] = node_data.get("subawardee_name")
    elif node_type == "Description":
        title = node_data.get("title")
        gid_fallback = str(gid_value) if gid_value is not None else ""
        node["name"] = str(title) if title is not None else gid_fallback
        for key in ["award_id", "title", "base_transaction_description", "program_activities"]:
            if node_data.get(key) is not None:
                node[key] = node_data.get(key)
    elif node_type == "Location":
        perf_location = node_data.get("performance_location")
        gid_fallback = str(gid_value) if gid_value is not None else ""
        node["name"] = str(perf_location) if perf_location is not None else gid_fallback
        if node_data.get("performance_location") is not None:
            node["performance_location"] = node_data.get("performance_location")
    elif node_type == "Place Of Performance":
        city_name = node_data.get("primary_place_of_performance_city_name")
        country_name = node_data.get("primary_place_of_performance_country_name")
        gid_fallback = str(gid_value) if gid_value is not None else ""
        node["name"] = str(city_name) if city_name is not None else (str(country_name) if country_name is not None else gid_fallback)
        for key in ["primary_place_of_performance_country_name", "recipient_country_name",
                    "primary_place_of_performance_city_name", "primary_place_of_performance_country_code"]:
            if node_data.get(key) is not None:
                node[key] = node_data.get(key)
    elif node_type == "Process":
        process = node_data.get("process")
        process_summary = node_data.get("process_summary")
        gid_fallback = str(gid_value) if gid_value is not None else ""
        node["name"] = str(process) if process is not None else (str(process_summary) if process_summary is not None else gid_fallback)
        for key in ["process_date", "article_url", "article_text", "process_category", "process_summary", "degree", "process"]:
            if node_data.get(key) is not None:
                node[key] = node_data.get(key)
    elif node_type == "Recipient":
        recipient_name = node_data.get("recipient_name")
        prime_awardee = node_data.get("prime_awardee_name")
        gid_fallback = str(gid_value) if gid_value is not None else ""
        node["name"] = str(recipient_name) if recipient_name is not None else (str(prime_awardee) if prime_awardee is not None else gid_fallback)
        if node_data.get("prime_awardee_name") is not None:
            node["prime_awardee_name"] = node_data.get("prime_awardee_name")
        if node_data.get("recipient_name") is not None:
            node["recipient_name"] = node_data.get("recipient_name")
    elif node_type == "Region":
        global_region = node_data.get("global_region")
        gid_fallback = str(gid_value) if gid_value is not None else ""
        node["name"] = str(global_region) if global_region is not None else gid_fallback
        if node_data.get("global_region") is not None:
            node["global_region"] = node_data.get("global_region")
    elif node_type == "Result":
        process_result = node_data.get("process_result")
        process_summary = node_data.get("process_summary")
        gid_fallback = str(gid_value) if gid_value is not None else ""
        node["name"] = str(process_result) if process_result is not None else (str(process_summary) if process_summary is not None else gid_fallback)
        for key in ["process_date", "article_url", "article_text", "process_result", "process_summary", "process_target"]:
            if node_data.get(key) is not None:
                node[key] = node_data.get(key)
    else:
        gid_fallback = str(gid_value) if gid_value is not None else ""
        node["name"] = gid_fallback

    for key, value in node_data.items():
        if key not in ["id", "gid", "node_type", "section", "name", "category", "color", "highlight"] and value is not None:
            if key not in node:
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
        logger.info("Fetching all stories from database")
        query = get_all_stories_query()
        results = db.execute_query(query)
        logger.debug(f"Retrieved {len(results)} story records from database")

        stories = []
        for record in results:
            story_data = record.get("story", {})
            if not story_data:
                continue

            story_title = story_data.get("story_title", "")
            story_gid = story_data.get("story_gid", "")
            story_brief = story_data.get("story_brief", "")
            
            # Convert to string and strip whitespace
            if story_brief is not None:
                story_brief = str(story_brief).strip()
            else:
                story_brief = ""
            
            # Log story processing (debug level to avoid spam)
            logger.debug(f"Processing story: {story_title} (gid: {story_gid}, brief length: {len(story_brief)})")

            story_id = generate_id_from_title(story_title) if story_title else str(story_gid)

            chapters = []
            for chapter_data in story_data.get("chapters", []):
                if not chapter_data or not chapter_data.get("gid"):
                    continue

                chapter_gid = chapter_data.get("gid", "")
                chapter_number = chapter_data.get("chapter_number", 0)
                chapter_title = chapter_data.get("chapter_title", "")
                chapter_total_nodes = chapter_data.get("total_nodes", 0) or 0

                chapter_id = f"chapter{int(chapter_number)}" if chapter_number is not None else str(chapter_gid)

                substories = []
                for section_data in chapter_data.get("sections", []):
                    if not section_data or not section_data.get("gid"):
                        continue

                    section_gid = section_data.get("gid", "")
                    section_title = section_data.get("section_title", "")
                    section_num = section_data.get("section_num", 0)

                    substory_id = f"substory{int(section_num)}" if section_num is not None else str(section_gid)

                    substories.append(Substory(
                        id=substory_id,
                        title=section_title or f"Section {section_num}",
                        headline=section_title or f"Section {section_num}",
                        brief=section_data.get("brief") or "",
                        graphPath=None,
                        section_query=section_data.get("section_query")
                    ))

                chapters.append(Chapter(
                    id=chapter_id,
                    title=chapter_title or f"Chapter {chapter_number}",
                    headline=chapter_title or f"Chapter {chapter_number}",
                    brief="",
                    substories=substories,
                    total_nodes=int(chapter_total_nodes) if chapter_total_nodes else 0
                ))

            stories.append(Story(
                id=story_id,
                title=story_title,
                headline=story_title,
                brief=story_brief,  # Already processed above
                path=generate_id_from_title(story_title),
                chapters=chapters
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
        # Handle graph_path parameter - treat it as section_query if provided
        if graph_path:
            logger.debug(f"Fetching graph data by graph_path: {graph_path}")
            query, params = get_graph_data_by_section_query(section_query=graph_path)
        elif section_gid:
            logger.debug(f"Fetching graph data by section_gid: {section_gid}")
            query, params = get_graph_data_by_section_query(section_gid=section_gid)
        elif section_query:
            logger.debug(f"Fetching graph data by section_query: {section_query}")
            query, params = get_graph_data_by_section_query(section_query=section_query)
        elif section_title:
            logger.debug(f"Fetching graph data by section_title: {section_title}")
            query, params = get_graph_data_by_section_query(section_query=section_title)
        else:
            raise ValueError("Either section_gid, section_query, section_title, or graph_path must be provided")

        results = db.execute_query(query, params)
        logger.debug(f"Retrieved graph data: {len(results)} result(s)")

        if not results:
            return GraphData(nodes=[], links=[])

        graph_data = results[0].get("graphData", {})

        nodes = []
        for node_data in graph_data.get("nodes", []):
            nodes.append(format_node(node_data))

        links = []
        for link_data in graph_data.get("links", []):
            links.append(format_link(link_data))

        logger.info(f"Successfully formatted graph data: {len(nodes)} nodes, {len(links)} links")
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

def get_graph_data_by_section_and_country(section_query: str, country_name: str) -> GraphData:
    """Fetch graph data filtered by section and country"""
    try:
        logger.info(f"Fetching graph data for section '{section_query}' and country '{country_name}'")
        query, params = get_graph_data_by_section_and_country_query(section_query, country_name)
        logger.debug(f"Executing query with params: {params}")
        
        results = db.execute_query(query, params)
        logger.info(f"Retrieved country-filtered graph data: {len(results)} result(s)")

        if not results:
            logger.warning(f"No results returned for section '{section_query}' and country '{country_name}'")
            return GraphData(nodes=[], links=[])

        graph_data = results[0].get("graphData", {})
        logger.info(f"Graph data structure: nodes={len(graph_data.get('nodes', []))}, links={len(graph_data.get('links', []))}")

        nodes = []
        for node_data in graph_data.get("nodes", []):
            nodes.append(format_node(node_data))

        links = []
        for link_data in graph_data.get("links", []):
            links.append(format_link(link_data))

        logger.info(f"Successfully formatted country-filtered graph data: {len(nodes)} nodes, {len(links)} links")
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
        query, params = get_cluster_data_query(
            node_type=str(node_type).strip(),
            property_key=str(property_key).strip(),
            section_query=section_query,
            cluster_limit=int(cluster_limit),
            node_limit=int(node_limit),
        )

        results = db.execute_query(query, params)
        if not results:
            return {
                "node_type": node_type,
                "property_key": property_key,
                "section_query": section_query,
                "clusters": []
            }

        return results[0].get("clusterData", {
            "node_type": node_type,
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
        # Try to get statistics by story_gid first, then by story_title
        query, params = get_story_statistics_query(story_gid=story_id)
        results = db.execute_query(query, params)
        
        if not results or len(results) == 0:
            # Try by story title
            logger.debug(f"No results for story_gid, trying story_title: {story_id}")
            query, params = get_story_statistics_query(story_title=story_id)
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
        # Return default values on error
        logger.error(f"Error fetching statistics for story {story_id}: {str(e)}", exc_info=True)
        return {
            "story_id": story_id,
            "total_nodes": 0,
            "entity_count": 0
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
                'Entity', 'Relationship', 'Amount', 'Agency', 'Action', 'Country', 
                'DBA', 'Description', 'Location', 'Place Of Performance', 'Process', 
                'Recipient', 'Region', 'Result', 'Purpose', 'Transaction', 
                'Sub Agency', 'USAID Program Region'
            ]
        
        node_types = [result.get("node_type") for result in results if result.get("node_type")]
        
        # If no results, return fallback list
        if not node_types:
            logger.warning("No node types found, using fallback list")
            return [
                'Entity', 'Relationship', 'Amount', 'Agency', 'Action', 'Country', 
                'DBA', 'Description', 'Location', 'Place Of Performance', 'Process', 
                'Recipient', 'Region', 'Result', 'Purpose', 'Transaction', 
                'Sub Agency', 'USAID Program Region'
            ]
        
        return node_types
    except Exception as e:
        logger.error(f"Error fetching node types: {str(e)}", exc_info=True)
        # Return fallback list on error
        return [
            'Entity', 'Relationship', 'Amount', 'Agency', 'Action', 'Country', 
            'DBA', 'Description', 'Location', 'Place Of Performance', 'Process', 
            'Recipient', 'Region', 'Result', 'Purpose', 'Transaction', 
            'Sub Agency', 'USAID Program Region'
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
    
    logger.info(f"Fetching wikidata for entity: '{entity_name}'")
    
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
        
        logger.info(f"Query returned {len(results) if results else 0} result(s)")
        
        if results:
            entity_data = dict(results[0])
            
            # Log what was found for debugging
            db_name = entity_data.get('name', 'N/A')
            db_alias = entity_data.get('alias', 'N/A')
            image_url = entity_data.get('image_url', 'N/A')
            logo_url = entity_data.get('logo_url', 'N/A')
            logger.info(f"Found entity - DB name: '{db_name}', Alias: '{db_alias}', QID: {entity_data.get('qid')}")
            logger.info(f"Image URLs - image_url: '{image_url}', logo_url: '{logo_url}'")
            
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
            
            logger.info(f"Successfully retrieved wikidata for entity: '{entity_name}' (matched to DB name: '{db_name}')")
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
                    logger.info(f"Similar entities in database (searching for '{first_word}'):")
                    for row in debug_results:
                        logger.info(f"  - Name: '{row.get('name')}', Alias: '{row.get('alias')}', QID: {row.get('qid')}")
            except Exception as debug_err:
                logger.debug(f"Debug query failed: {debug_err}")
            
            return {"found": False, "data": None}
            
    except Exception as e:
        logger.error(f"Error fetching entity wikidata for '{entity_name}': {e}")
        logger.exception(e)  # Log full traceback
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
    
    logger.info(f"Searching wikidata for: {search_term}")
    
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
        
        logger.info(f"Found {len(entities)} wikidata matches for: {search_term}")
        return {"results": entities, "count": len(entities)}
        
    except Exception as e:
        logger.error(f"Error searching entity wikidata: {e}")
        raise

