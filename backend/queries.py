from typing import Optional, Tuple, Dict, Any


def get_all_stories_query():
    """Query to fetch all stories with their chapters and sections.

    Supports two Neo4j schemas:

    1. gr_id unified schema (primary):
       - All entities are :gr_id nodes; category distinguishes "story", "chapter", "section".
       - Relationships: Story -[:HAS_CHAPTER]-> Chapter -[:HAS_SECTION]-> Section.
       - Returns one row per story with key "story" containing nested chapters/sections.

    2. Legacy schema (fallback):
       - Nodes: :story, :chapter, :section
       - Relationships: :story_chapter, :chapter_section
    """
    # gr_id unified schema (category-based story/chapter/section)
    return """
    MATCH (story:gr_id)
    WHERE toLower(trim(coalesce(story.category, ''))) = 'story'
    OPTIONAL MATCH (story)-[:HAS_CHAPTER]-(chapter:gr_id)
    WHERE toLower(trim(coalesce(chapter.category, ''))) = 'chapter'
    OPTIONAL MATCH (chapter)-[:HAS_SECTION]-(section:gr_id)
    WHERE toLower(trim(coalesce(section.category, ''))) = 'section'
    WITH story, chapter, section,
         toInteger(coalesce(toFloat(story.order), toFloat(story.`Story Number`), toFloat(story.`Story Number_new`), 0)) AS story_order,
         toInteger(coalesce(toFloat(chapter.`Chapter Number`), toFloat(chapter.`Chapter Number_new`), 0)) AS chapter_number,
         toInteger(coalesce(toFloat(section.`Section Number`), 0)) AS section_num
    ORDER BY story_order, story.id, story.g_id, story.name, chapter_number, section_num
    WITH story, story_order, chapter, chapter_number,
         COLLECT(DISTINCT {
             gid: coalesce(section.gid, section.id, section.g_id),
             section_title: coalesce(section.name, section.`Section Name`, section.`graph name`, toString(section.gid), ""),
             section_num: section_num,
             section_query: toString(coalesce(section.gid, section.id, section.g_id)),
             brief: coalesce(section.summary, section.`Summary`, section.brief, "")
         }) AS sections
    WITH story, story_order,
         COLLECT(DISTINCT {
             gid: coalesce(chapter.gid, chapter.id, chapter.g_id),
             chapter_number: chapter_number,
             chapter_title: coalesce(chapter.name, chapter.`Chapter Name`, toString(chapter.gid), ""),
             sections: [s IN sections WHERE s.gid IS NOT NULL | s],
             total_nodes: 0
         }) AS chapters_raw
    WITH story, story_order,
         [c IN chapters_raw WHERE c.gid IS NOT NULL | c] AS chapters_filtered
    WITH story, story_order,
         [c IN chapters_filtered | {
             gid: c.gid,
             chapter_number: c.chapter_number,
             chapter_title: c.chapter_title,
             sections: [s IN c.sections WHERE s.gid IS NOT NULL | s],
             total_nodes: c.total_nodes
         }] AS chapters
    RETURN {
        story_title: coalesce(story.name, story.`Story Name`, toString(story.gid), ""),
        story_id: coalesce(toString(story.id), toString(story.g_id), toString(story.gid)),
        story_gid: coalesce(story.gid, story.g_id, story.id),
        story_brief: coalesce(story.brief, story.summary, story.`Summary`, ""),
        chapters: chapters
    } AS story
    ORDER BY story_order, story.id, story.g_id, story.name
    """



def get_all_stories_query_legacy():
    """Legacy query for :story/:chapter/:section schema with :story_chapter/:chapter_section.
    Used when gr_id schema returns no results."""
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
        story_id: toString(story.gid),
        story_gid: story.gid,
        story_brief: "",
        chapters: chapters
    } AS story
    ORDER BY story_number, story.gid
    """

def get_story_statistics_query(story_gid: Optional[str] = None, story_title: Optional[str] = None):
    """Statistics for a story. New schema: gr_id nodes with HAS_CHAPTER, HAS_SECTION."""
    if story_gid:
        match_clause = """
        MATCH (story:gr_id)
        WHERE toLower(trim(coalesce(story.category, ''))) = 'story'
          AND (toString(coalesce(story.id, story.g_id)) = toString($story_gid)
               OR toString(story.name) = toString($story_gid))
        """
        params = {"story_gid": story_gid}
    elif story_title:
        match_clause = """
        MATCH (story:gr_id)
        WHERE toLower(trim(coalesce(story.category, ''))) = 'story'
          AND (story.name = $story_title OR story.`Story Name` = $story_title)
        """
        params = {"story_title": story_title}
    else:
        raise ValueError("Either story_gid or story_title must be provided")

    # Use relationship-based matching (section)-[*1..5]-(n) - same as graph data query
    query = f"""
    {match_clause}
    OPTIONAL MATCH (story)-[:HAS_CHAPTER]-(chapter:gr_id)
    WHERE toLower(trim(coalesce(chapter.category, ''))) = 'chapter'
    OPTIONAL MATCH (chapter)-[:HAS_SECTION]-(section:gr_id)
    WHERE toLower(trim(coalesce(section.category, ''))) = 'section'
    WITH story, COLLECT(DISTINCT section) AS sections
    UNWIND CASE WHEN size(sections) = 0 OR sections[0] IS NULL THEN [null] ELSE sections END AS section
    OPTIONAL MATCH (section)-[*1..5]-(n)
    WHERE (section IS NOT NULL AND NONE(l IN labels(n) WHERE toLower(l) = 'gr_id')) OR section IS NULL
    WITH story, n
    WITH story, COLLECT(DISTINCT n) AS node_list
    WITH story, [x IN node_list WHERE x IS NOT NULL] AS nodes_only
    WITH story,
         size(nodes_only) AS total_nodes,
         size([x IN nodes_only WHERE ANY(l IN labels(x) WHERE toLower(l) = 'entity')]) AS entity_count,
         REDUCE(max_date = null, x IN [x IN nodes_only | coalesce(x.date, x.`Date`, x.`Relationship Date`, x.`Action Date`, x.`Process Date`, x.`Disb Date`)] | CASE WHEN max_date IS NULL OR x > max_date THEN x ELSE max_date END) AS updated_date

    RETURN {{
      story_id: coalesce(story.id, story.g_id, story.name, elementId(story)),
      story_title: coalesce(story.name, story.`Story Name`, toString(story.id), toString(story.g_id)),
      total_nodes: total_nodes,
      entity_count: entity_count,
      highlighted_nodes: 0,
      updated_date: "2026-01-20"
    }} AS statistics
    """
    
    return query, params

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

    Primary: gr_id schema — section is :gr_id with category='section'; match by id/g_id (section_gid)
    or id, g_id, name, Section Name, graph name (section_query/section_title). Traverse (section)-[*1..10]-(node),
    excluding nodes labeled gr_id; return nodes and relationships between those nodes.

    Fallback: legacy :section schema (section.`graph name` / node.gr_id) is in get_graph_data_by_section_query_legacy.
    """
    if section_gid:
        match_clause = """
        MATCH (section:gr_id)
        WHERE toLower(trim(coalesce(section.category, ''))) = 'section'
          AND toString(coalesce(section.id, section.g_id, section.gid)) = toString($section_gid)
        """
        params = {"section_gid": section_gid}
    elif section_query:
        match_clause = """
        MATCH (section:gr_id)
        WHERE toLower(trim(coalesce(section.category, ''))) = 'section'
          AND (toString(coalesce(section.id, section.g_id, section.gid)) = toString($section_query)
               OR section.name = $section_query
               OR section.`Section Name` = $section_query
               OR section.`graph name` = $section_query)
        """
        params = {"section_query": section_query}
    elif section_title:
        match_clause = """
        MATCH (section:gr_id)
        WHERE toLower(trim(coalesce(section.category, ''))) = 'section'
          AND (section.name = $section_title
               OR section.`Section Name` = $section_title
               OR section.`graph name` = $section_title)
        """
        params = {"section_title": section_title}
    else:
        raise ValueError("At least one of section_gid, section_query, or section_title must be provided")

    query = f"""
    {match_clause}
    WITH section
    // All nodes connected to the section within 1..10 hops, excluding other gr_id hierarchy nodes
    MATCH (section)-[*1..10]-(node)
    WHERE NONE(l IN labels(node) WHERE toLower(l) = 'gr_id')
    WITH COLLECT(DISTINCT node) AS all_nodes
    // Relationships between those nodes (pattern comprehension; works when no rels exist)
    WITH all_nodes,
         [(a)-[rel]-(b) WHERE a IN all_nodes AND b IN all_nodes AND id(a) < id(b) | {{ rel: rel, from: a, to: b }}] AS all_rels
    RETURN {{
      nodes: [n IN all_nodes | n {{
        .*,
        elementId: elementId(n),
        labels: labels(n),
        node_type: head(labels(n))
      }}],
      links: [rd IN all_rels | {{
        gid: coalesce(toString(rd.rel.gid), toString(rd.rel.id), elementId(rd.rel)),
        elementId: elementId(rd.rel),
        type: type(rd.rel),
        from_gid: coalesce(toString(rd.from.gid), toString(rd.from.id), toString(rd.from.g_id), elementId(rd.from)),
        to_gid: coalesce(toString(rd.to.gid), toString(rd.to.id), toString(rd.to.g_id), elementId(rd.to)),
        from_labels: labels(rd.from),
        to_labels: labels(rd.to),
        relationship_summary: coalesce(rd.rel.summary, rd.rel.`Relationship Summary`, rd.rel.`Relationship Summary_new`, rd.rel.name, rd.rel.text),
        article_title: coalesce(rd.rel.title, rd.rel.`Article Title`, rd.rel.`Source Title`),
        article_url: coalesce(rd.rel.url, rd.rel.`Article URL`, rd.rel.`article URL`, rd.rel.`Source URL`),
        relationship_date: coalesce(rd.rel.date, rd.rel.`Date`, rd.rel.`Relationship Date`),
        properties: properties(rd.rel)
      }}]
    }} AS graphData
    """
    return query, params


def get_graph_data_by_section_query_legacy(section_gid: Optional[str] = None, section_query: Optional[str] = None, section_title: Optional[str] = None) -> Tuple[str, dict]:
    """
    Legacy graph query for :section schema: section.`graph name` and node.gr_id matching.
    Used when gr_id schema returns no graph data.
    """
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

    MATCH (node)
    WHERE toString(node.gr_id) = section_graph_name
      AND NONE(l IN labels(node) WHERE toLower(l) IN ['story','chapter','section'])
    WITH section_graph_name, COLLECT(DISTINCT node) AS all_nodes

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
        from_gid: coalesce(toString(rd.from.gid), elementId(rd.from)),
        to_gid: coalesce(toString(rd.to.gid), elementId(rd.to)),
        from_labels: labels(rd.from),
        to_labels: labels(rd.to),
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



def get_story_statistics_query_legacy(story_gid: Optional[str] = None, story_title: Optional[str] = None):
    """Legacy statistics query for :story/:chapter/:section schema (section.`graph name`, n.gr_id)."""
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
      story_id: toString(story.gid),
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


def get_articles_by_relationship_gid_query(relationship_gid: str) -> Tuple[str, dict]:
    """
    Get all article nodes that have an IN_ARTICLE relationship to the given relationship node.
    relationship_gid is the gid of the relationship (link) in the graph; the relationship
    may be represented as a node with that gid, and articles link to it via :IN_ARTICLE.
    """
    query = """
    MATCH (relNode)
    WHERE toString(coalesce(relNode.gid, relNode.id, relNode.g_id)) = toString($relationship_gid)
    MATCH (article)-[:IN_ARTICLE]-(relNode)
    RETURN DISTINCT {
      gid: coalesce(article.gid, article.id, article.g_id),
      elementId: elementId(article),
      labels: labels(article),
      node_type: head(labels(article)),
      name: coalesce(article.name, article.title, article.`Article Title`, article.`Source Title`, toString(article.gid)),
      title: coalesce(article.title, article.`Article Title`, article.name),
      url: coalesce(article.url, article.`Article URL`, article.`Source URL`, article.`article URL`)
    } AS article
    """
    return query, {"relationship_gid": relationship_gid}
