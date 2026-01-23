from typing import Optional, Tuple

def get_all_stories_query():
    """Query to fetch all stories with their chapters and sections.

    Updated for the new Neo4j schema:
    - Nodes: :story, :chapter, :section
    - Relationships: :story_chapter, :chapter_section
    """
    return """
    MATCH (story:story)
    OPTIONAL MATCH (story)-[:story_chapter]-(chapter:chapter)
    OPTIONAL MATCH (chapter)-[:chapter_section]-(section:section)
    WITH story, chapter, section,
         toInteger(coalesce(toFloat(story.`Story Number_new`), toFloat(story.`Story Number`), 0)) AS story_number,
         toInteger(coalesce(toFloat(chapter.`Chapter Number_new`), toFloat(chapter.`Chapter Number`), 0)) AS chapter_number,
         toInteger(coalesce(toFloat(section.`Section Number`), 0)) AS section_num
    ORDER BY story_number, chapter_number, section_num
    WITH story, story_number, chapter, chapter_number,
         COLLECT(DISTINCT {
             gid: section.gid,
             section_title: coalesce(section.`Section Name`, section.`graph name`, toString(section.gid)),
             section_num: section_num,
             // For the frontend, we keep using a "section_query" field. In the new DB, gid is the most reliable identifier.
             section_query: toString(section.gid),
             brief: coalesce(section.summary, section.`Summary`, ""),
             chapter_number: chapter_number,
             chapter_title: coalesce(chapter.`Chapter Name`, toString(chapter.gid))
         }) AS sections
    WITH story, story_number,
         COLLECT(DISTINCT {
             gid: chapter.gid,
             chapter_number: chapter_number,
             chapter_title: coalesce(chapter.`Chapter Name`, toString(chapter.gid)),
             sections: sections,
             total_nodes: 0
         }) AS chapters_raw
    WITH story, story_number,
         [c IN chapters_raw WHERE c.gid IS NOT NULL | c] AS chapters_filtered
    WITH story, story_number,
         [c IN chapters_filtered | {
             gid: c.gid,
             chapter_number: c.chapter_number,
             chapter_title: c.chapter_title,
             sections: [s IN c.sections WHERE s.gid IS NOT NULL | s],
             total_nodes: c.total_nodes
         }] AS chapters
    RETURN {
        story_title: coalesce(story.`Story Name`, toString(story.gid)),
        story_gid: story.gid,
        story_brief: "",
        chapters: chapters
    } AS story
    ORDER BY story_number, story.gid
    """

def get_story_by_id_query(story_id: str):
    """Query to fetch a specific story by ID (using Story Name/Number or gid).

    Updated for the new Neo4j schema:
    - Nodes: :story, :chapter, :section
    - Relationships: :story_chapter, :chapter_section
    """
    return """
    MATCH (story:story)
    WHERE toString(story.gid) = $story_id
       OR story.`Story Name` = $story_id
       OR toString(story.`Story Number`) = $story_id
       OR toString(story.`Story Number_new`) = $story_id
    OPTIONAL MATCH (story)-[:story_chapter]-(chapter:chapter)
    OPTIONAL MATCH (chapter)-[:chapter_section]-(section:section)
    WITH story, chapter, section,
         toInteger(coalesce(toFloat(chapter.`Chapter Number_new`), toFloat(chapter.`Chapter Number`), 0)) AS chapter_number,
         toInteger(coalesce(toFloat(section.`Section Number`), 0)) AS section_num
    ORDER BY chapter_number, section_num
    WITH story, chapter, chapter_number,
         COLLECT(DISTINCT {
             gid: section.gid,
             section_title: coalesce(section.`Section Name`, section.`graph name`, toString(section.gid)),
             section_num: section_num,
             section_query: toString(section.gid),
             brief: coalesce(section.summary, section.`Summary`, "")
         }) AS sections
    WITH story,
         COLLECT(DISTINCT {
             gid: chapter.gid,
             chapter_number: chapter_number,
             chapter_title: coalesce(chapter.`Chapter Name`, toString(chapter.gid)),
             sections: [s IN sections WHERE s.gid IS NOT NULL | s],
             total_nodes: 0
         }) AS chapters
    RETURN {
        story_title: coalesce(story.`Story Name`, toString(story.gid)),
        story_gid: story.gid,
        story_brief: "",
        chapters: [c IN chapters WHERE c.gid IS NOT NULL ORDER BY c.chapter_number]
    } AS story
    """, {"story_id": story_id}

def get_graph_data_by_section_query(section_gid: Optional[str] = None, section_query: Optional[str] = None, section_title: Optional[str] = None) -> Tuple[str, dict]:
    """
    Query to fetch graph data (nodes and links) for a section.

    Updated for the new Neo4j schema:
    - Section identity: resolve `(:section)` by gid/name
    - Graph membership: Cross-property matching
      * Section has: `graph name` property (with space)
      * Other nodes have: `gr_id` property
    - When a section is clicked, return all nodes where `node.gr_id == section.graph name`
    - Return all relationships between those nodes
    """
    
    # Build the match clause based on what parameter was provided
    if section_gid:
        # URL supplies gid as string; compare via toString() for type safety.
        match_clause = "MATCH (section:section) WHERE toString(section.gid) = toString($section_gid)"
        params = {"section_gid": section_gid}
    elif section_query:
        # Backwards/compat: treat section_query as section.gid (string), or try matching common section name fields.
        match_clause = """
        MATCH (section:section)
        WHERE toString(section.gid) = toString($section_query)
           OR section.`Section Name` = $section_query
           OR section.`graph name` = $section_query
        """
        params = {"section_query": section_query}
    elif section_title:
        # New DB uses `Section Name` / `graph name` instead of Section_Title
        match_clause = """
        MATCH (section:section)
        WHERE section.`Section Name` = $section_title
           OR section.`graph name` = $section_title
        """
        params = {"section_title": section_title}
    else:
        raise ValueError("At least one of section_gid, section_query, or section_title must be provided")
    
    query = f"""
    {match_clause}
    // Get the section's `graph name` - this is the key that matches other nodes' gr_id
    WITH section, toString(section.`graph name`) AS section_graph_name

    // Collect all nodes where node.gr_id == section.`graph name` (excluding story/chapter/section hierarchy)
    MATCH (node)
    WHERE toString(node.gr_id) = section_graph_name
      AND NONE(l IN labels(node) WHERE toLower(l) IN ['story','chapter','section'])
    WITH section_graph_name, COLLECT(DISTINCT node) AS all_nodes

    // Collect relationships between nodes in this section's graph
    // Only include relationships where BOTH endpoints have the same gr_id
    MATCH (a)-[rel]-(b)
    WHERE toString(a.gr_id) = section_graph_name
      AND toString(b.gr_id) = section_graph_name
      AND NONE(l IN labels(a) WHERE toLower(l) IN ['story','chapter','section'])
      AND NONE(l IN labels(b) WHERE toLower(l) IN ['story','chapter','section'])
    WITH all_nodes,
         COLLECT(DISTINCT {{
           rel: rel,
           from: a,
           to: b,
           type: type(rel)
         }}) AS all_rels

    RETURN {{
      nodes: [n IN all_nodes | n {{
        .*,
        elementId: elementId(n),
        labels: labels(n),
        node_type: head(labels(n))
      }}],
      links: [rd IN all_rels | {{
        gid: coalesce(toString(rd.rel.gid), elementId(rd.rel)),
        elementId: elementId(rd.rel),
        type: rd.type,
        // Ensure link endpoints match node ids (gid preferred, fallback to elementId)
        from_gid: coalesce(toString(rd.from.gid), elementId(rd.from)),
        to_gid: coalesce(toString(rd.to.gid), elementId(rd.to)),
        from_labels: labels(rd.from),
        to_labels: labels(rd.to),
        // Common fields consumed by the frontend
        relationship_summary: coalesce(rd.rel.summary, rd.rel.`Relationship Summary`, rd.rel.`Relationship Summary_new`, rd.rel.name, rd.rel.text),
        article_title: coalesce(rd.rel.title, rd.rel.`Article Title`, rd.rel.`Source Title`),
        article_url: coalesce(rd.rel.url, rd.rel.`Article URL`, rd.rel.`article URL`, rd.rel.`Source URL`),
        relationship_date: coalesce(rd.rel.date, rd.rel.`Date`, rd.rel.`Relationship Date`),
        properties: properties(rd.rel)
      }}]
    }} AS graphData
    """
    
    return query, params


def get_cluster_data_query(
    node_type: str,
    property_key: str,
    section_query: Optional[str] = None,
    cluster_limit: int = 5,
    node_limit: int = 10
) -> Tuple[str, dict]:
    """
    Query to fetch clustered node samples grouped by a given property key.

    - `node_type` is expected to be a frontend normalized label (e.g. "place_of_performance", "entity", "action").
      We match it against actual Neo4j labels using a normalized comparison:
        replace(toLower(label), ' ', '_') == node_type  OR  toLower(label) == node_type
    - `property_key` is the Neo4j property name to cluster by.
    - Optionally filters to a section via `n.section = section_query` if provided.

    Returns a dict shape:
      {
        node_type, property_key, section_query,
        clusters: [{ value, count, nodes: [{id,name}, ...] }, ...]
      }
    """

    query = """
    // Resolve section filter to section.`graph name` if provided.
    WITH $section_query AS section_query
    OPTIONAL MATCH (sec:section)
    WHERE section_query IS NOT NULL
      AND (
        toString(sec.gid) = toString(section_query)
        OR sec.`Section Name` = section_query
        OR sec.`graph name` = section_query
      )
    WITH section_query, toString(sec.`graph name`) AS section_graph_name

    MATCH (n)
    WHERE ANY(l IN labels(n) WHERE replace(toLower(l), ' ', '_') = $node_type OR toLower(l) = $node_type)
      AND n[$property_key] IS NOT NULL
      AND (
        section_query IS NULL
        OR toString(n.gr_id) = section_graph_name
      )
    WITH n, toString(n[$property_key]) AS propVal
    WITH propVal,
         collect(DISTINCT {
            id: coalesce(toString(n.gid), toString(n.id), toString(id(n))),
            name: coalesce(
              n.name,
              n.`Entity Name`,
              n.`Action Text`,
              n.`Result Name`,
              n.`Process Name`,
              n.`Relationship NAME`,
              n.`Country Name`,
              toString(n.gid),
              toString(id(n))
            )
         }) AS nodes,
         count(DISTINCT n) AS count
    ORDER BY count DESC, propVal ASC
    WITH collect({
      value: propVal,
      count: count,
      nodes: nodes[0..$node_limit]
    })[0..$cluster_limit] AS clusters
    RETURN {
      node_type: $node_type,
      property_key: $property_key,
      section_query: $section_query,
      clusters: clusters
    } AS clusterData
    """

    params = {
        "node_type": node_type,
        "property_key": property_key,
        "section_query": section_query,
        "cluster_limit": cluster_limit,
        "node_limit": node_limit,
    }

    return query, params

def get_section_by_id_query(section_gid: str):
    """Get section details by gid"""
    return """
    MATCH (section:section)
    WHERE toString(section.gid) = toString($section_gid)
    OPTIONAL MATCH (chapter:chapter)-[:chapter_section]-(section)
    RETURN {
        gid: section.gid,
        section_title: coalesce(section.`Section Name`, section.`graph name`, toString(section.gid)),
        section_num: toInteger(coalesce(toFloat(section.`Section Number`), 0)),
        section_query: toString(section.gid),
        brief: coalesce(section.summary, section.`Summary`, ""),
        chapter: {
            gid: chapter.gid,
            chapter_number: toInteger(coalesce(toFloat(chapter.`Chapter Number_new`), toFloat(chapter.`Chapter Number`), 0)),
            chapter_title: coalesce(chapter.`Chapter Name`, toString(chapter.gid))
        }
    } AS section
    """, {"section_gid": section_gid}

def get_graph_data_by_section_and_country_query(section_query: str, country_name: str) -> Tuple[str, dict]:
    """
    Query to fetch graph data (nodes and links) for a section filtered by country.

    Updated for the new Neo4j schema:
    - `section_query` is treated as the section `gid` (string), consistent with the homepage mapping.
    - Cross-property matching: section.`graph name` matches other nodes' gr_id
    - Find a Country node with gr_id matching the section's `graph name`
    - Include nodes within 2 hops that have the same gr_id
    """
    
    query = """
    MATCH (section:section)
    WHERE toString(section.gid) = toString($section_query)
       OR section.`Section Name` = $section_query
       OR section.`graph name` = $section_query
    WITH section, toString(section.`graph name`) AS section_graph_name

    // Find the country node(s) matching the country name where country.gr_id = section.`graph name`
    MATCH (country)
    WHERE toString(country.gr_id) = section_graph_name
      AND ANY(l IN labels(country) WHERE toLower(l) = 'country')
      AND toLower(coalesce(country.name, country.`Country Name`, country.`Country Name_new`, '')) = toLower($country_name)

    // Collect nodes within 2 hops of the country (with the same gr_id)
    MATCH (country)-[*0..2]-(n)
    WHERE toString(n.gr_id) = section_graph_name
      AND NONE(l IN labels(n) WHERE toLower(l) IN ['story','chapter','section'])
    WITH COLLECT(DISTINCT n) AS all_nodes

    MATCH (a)-[rel]-(b)
    WHERE a IN all_nodes AND b IN all_nodes
      AND NONE(l IN labels(a) WHERE toLower(l) IN ['story','chapter','section'])
      AND NONE(l IN labels(b) WHERE toLower(l) IN ['story','chapter','section'])
    WITH all_nodes,
         COLLECT(DISTINCT {
           rel: rel,
           from: a,
           to: b,
           type: type(rel)
         }) AS all_rels

    RETURN {
      nodes: [n IN all_nodes | n {
        .*,
        elementId: elementId(n),
        labels: labels(n),
        node_type: head(labels(n))
      }],
      links: [rd IN all_rels | {
        gid: coalesce(toString(rd.rel.gid), elementId(rd.rel)),
        elementId: elementId(rd.rel),
        type: rd.type,
        from_gid: coalesce(toString(rd.from.gid), elementId(rd.from)),
        to_gid: coalesce(toString(rd.to.gid), elementId(rd.to)),
        relationship_summary: coalesce(rd.rel.summary, rd.rel.`Relationship Summary`, rd.rel.name, rd.rel.text),
        article_title: coalesce(rd.rel.title, rd.rel.`Article Title`),
        article_url: coalesce(rd.rel.url, rd.rel.`Article URL`, rd.rel.`article URL`),
        relationship_date: coalesce(rd.rel.date, rd.rel.`Date`, rd.rel.`Relationship Date`),
        properties: properties(rd.rel)
      }]
    } AS graphData
    """

    params = {"section_query": section_query, "country_name": country_name}
    return query, params

def get_calendar_data_by_section_query(section_gid: Optional[str] = None, section_query: Optional[str] = None, section_title: Optional[str] = None) -> Tuple[str, dict]:
    """
    Query to fetch calendar/timeline data for a section with distinct timeline and free-floating items.
    
    Timeline items (Milestone, Result, Incident, Action) are sorted by:
    1. Date (chronological)
    2. Type priority: Milestone (1) → Result/Incident (2) → Action (3)
    
    Free-floating items (Entity, Location, Event, etc.) are returned with their connections
    to timeline items, allowing frontend to position them dynamically based on viewport.
    """
    
    # Build the match clause based on what parameter was provided (new DB: section_query treated as section.gid)
    if section_gid:
        match_clause = "MATCH (section:section) WHERE toString(section.gid) = toString($section_gid)"
        params = {"section_gid": section_gid}
    elif section_query:
        match_clause = """
        MATCH (section:section)
        WHERE toString(section.gid) = toString($section_query)
           OR section.`Section Name` = $section_query
           OR section.`graph name` = $section_query
        """
        params = {"section_query": section_query}
    elif section_title:
        match_clause = """
        MATCH (section:section)
        WHERE section.`Section Name` = $section_title
           OR section.`graph name` = $section_title
        """
        params = {"section_title": section_title}
    else:
        raise ValueError("At least one of section_gid, section_query, or section_title must be provided")
    
    query = f"""
    {match_clause}
    WITH section, toString(section.`graph name`) AS section_graph_name

    // Timeline items: nodes with a usable date and/or event-like labels, where node.gr_id = section.`graph name`
    MATCH (n)
    WHERE toString(n.gr_id) = section_graph_name
      AND NONE(l IN labels(n) WHERE toLower(l) IN ['story','chapter','section'])
      AND (
        ANY(l IN labels(n) WHERE toLower(l) IN ['action','process','result','event_attend','funding','relationship'])
        OR coalesce(n.date, n.`Date`, n.`Relationship Date`, n.`Action Date`, n.`Process Date`, n.`Disb Date`) IS NOT NULL
      )
    WITH section, section_graph_name,
         COLLECT(DISTINCT {{
           gid: coalesce(toString(n.gid), elementId(n)),
           node_type: head(labels(n)),
           date: coalesce(n.date, n.`Date`, n.`Relationship Date`, n.`Action Date`, n.`Process Date`, n.`Disb Date`),
           name: coalesce(n.title, n.name, n.`Article Title`, n.summary, toString(n.gid)),
           description: coalesce(n.summary, n.`Summary`, n.text, ""),
           properties: n {{ .* }}
         }}) AS timeline_items

    // Floating items: everything else in the section with matching gr_id (non-hierarchy nodes)
    MATCH (f)
    WHERE toString(f.gr_id) = section_graph_name
      AND NONE(l IN labels(f) WHERE toLower(l) IN ['story','chapter','section'])
    WITH section, section_graph_name, timeline_items,
         COLLECT(DISTINCT {{
           gid: coalesce(toString(f.gid), elementId(f)),
           node_type: head(labels(f)),
           name: coalesce(f.title, f.name, f.`Article Title`, f.summary, toString(f.gid)),
           description: coalesce(f.summary, f.`Summary`, f.text, ""),
           properties: f {{ .* }}
         }}) AS floating_items

    // Relationships: between all nodes inside this section (by gr_id)
    MATCH (source)-[rel]-(target)
    WHERE toString(source.gr_id) = section_graph_name
      AND toString(target.gr_id) = section_graph_name
      AND NONE(l IN labels(source) WHERE toLower(l) IN ['story','chapter','section'])
      AND NONE(l IN labels(target) WHERE toLower(l) IN ['story','chapter','section'])
    WITH section, timeline_items, floating_items,
         COLLECT(DISTINCT {{
           gid: coalesce(toString(rel.gid), elementId(rel)),
           type: type(rel),
           source_gid: coalesce(toString(source.gid), elementId(source)),
           target_gid: coalesce(toString(target.gid), elementId(target)),
           source_type: head(labels(source)),
           target_type: head(labels(target)),
           date: coalesce(rel.date, rel.`Date`, rel.`Relationship Date`),
           properties: rel {{ .* }}
         }}) AS relationships

    RETURN {{
      section_query: toString(section.gid),
      section_title: coalesce(section.`Section Name`, section.`graph name`, toString(section.gid)),
      timeline_items: timeline_items,
      floating_items: floating_items,
      relationships: relationships
    }} AS calendarData
    """
    
    return query, params

def get_story_statistics_query(story_gid: Optional[str] = None, story_title: Optional[str] = None):
    """Get statistics for a story: total nodes, entity count, etc."""
    if story_gid:
        match_clause = "MATCH (story:story) WHERE toString(story.gid) = toString($story_gid)"
        params = {"story_gid": story_gid}
    elif story_title:
        match_clause = "MATCH (story:story) WHERE story.`Story Name` = $story_title"
        params = {"story_title": story_title}
    else:
        raise ValueError("Either story_gid or story_title must be provided")
    
    query = f"""
    {match_clause}
    OPTIONAL MATCH (story)-[:story_chapter]-(chapter:chapter)
    OPTIONAL MATCH (chapter)-[:chapter_section]-(section:section)
    WITH story,
         COLLECT(DISTINCT toString(section.`graph name`)) AS section_graph_names
    WITH story, [g IN section_graph_names WHERE g IS NOT NULL AND g <> ""] AS section_graph_names

    MATCH (n)
    WHERE toString(n.gr_id) IN section_graph_names
      AND NONE(l IN labels(n) WHERE toLower(l) IN ['story','chapter','section'])
    WITH story,
         COUNT(DISTINCT n) AS total_nodes,
         COUNT(DISTINCT CASE WHEN ANY(l IN labels(n) WHERE toLower(l) = 'entity') THEN coalesce(toString(n.gid), elementId(n)) ELSE null END) AS entity_count,
         MAX(coalesce(n.date, n.`Date`, n.`Relationship Date`, n.`Action Date`, n.`Process Date`, n.`Disb Date`)) AS updated_date

    RETURN {{
      story_gid: story.gid,
      story_title: coalesce(story.`Story Name`, toString(story.gid)),
      total_nodes: total_nodes,
      entity_count: entity_count,
      highlighted_nodes: 0,
      updated_date: updated_date
    }} AS statistics
    """
    
    return query, params

def get_all_node_types_query():
    """Query to fetch all distinct node types (labels) from the database"""
    # Use a query that finds all distinct labels by checking actual nodes
    # This is more reliable than CALL db.labels() which may not work in all Neo4j versions
    query = """
    // New DB: return normalized label names for nodes that participate in graphs (by gr_id).
    MATCH (n)
    WHERE n.gr_id IS NOT NULL
      AND NONE(l IN labels(n) WHERE toLower(l) IN ['story','chapter','section'])
    WITH labels(n) AS nodeLabels
    UNWIND nodeLabels AS label
    WITH label
    WHERE toLower(label) NOT IN ['story','chapter','section']
    RETURN DISTINCT replace(toLower(label), ' ', '_') AS node_type
    ORDER BY node_type
    """
    return query, {}
