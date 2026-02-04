from typing import Optional, Tuple
import re
from cypher_security import validate_label, sanitize_label_for_query
from sql_security import validate_string_input

def get_all_stories_query():
    """Query to fetch all stories with their chapters and sections.

    New Neo4j schema (gr_id unified nodes):
    - Single node type :gr_id with category: "Story" | "Chapter" | "Section"
    - Relationships: HAS_CHAPTER (Story -> Chapter), HAS_SECTION (Chapter -> Section)
    - chapter_number, section_number for ordering
    """
    return """
    MATCH (story:gr_id)
    WHERE toLower(trim(coalesce(story.category, ''))) = 'story'
    OPTIONAL MATCH (story)-[:HAS_CHAPTER]-(chapter:gr_id)
    WHERE toLower(trim(coalesce(chapter.category, ''))) = 'chapter'
    OPTIONAL MATCH (chapter)-[:HAS_SECTION]-(section:gr_id)
    WHERE toLower(trim(coalesce(section.category, ''))) = 'section'
    WITH story, chapter, section,
         toInteger(coalesce(toFloat(story.chapter_number), toFloat(story.`Story Number`), toFloat(story.`Story Number_new`), 0)) AS story_order,
         toInteger(coalesce(toFloat(chapter.chapter_number), toFloat(chapter.`Chapter Number`), toFloat(chapter.`Chapter Number_new`), 0)) AS chapter_number,
         toInteger(coalesce(toFloat(section.section_number), toFloat(section.`Section Number`), 0)) AS section_num
    ORDER BY story_order, chapter_number, section_num
    WITH story, story_order, chapter, chapter_number,
         COLLECT(DISTINCT {
             id: coalesce(section.id, section.g_id, section.name, elementId(section)),
             section_title: coalesce(section.name, section.`Section Name`, section.`graph name`, toString(section.id), toString(section.g_id)),
             section_num: section_num,
             section_query: toString(coalesce(section.id, section.g_id, section.name, elementId(section))),
             brief: coalesce(section.summary, section.`Summary`, ""),
             chapter_number: chapter_number,
             chapter_title: coalesce(chapter.name, chapter.`Chapter Name`, toString(chapter.id), toString(chapter.g_id))
         }) AS sections
    WITH story, story_order,
         COLLECT(DISTINCT {
             id: coalesce(chapter.id, chapter.g_id, chapter.name, elementId(chapter)),
             chapter_number: chapter_number,
             chapter_title: coalesce(chapter.name, chapter.`Chapter Name`, toString(chapter.id), toString(chapter.g_id)),
             sections: sections,
             total_nodes: 0
         }) AS chapters_raw
    WITH story, story_order,
         [c IN chapters_raw WHERE c.id IS NOT NULL | c] AS chapters_filtered
    WITH story, story_order,
         [c IN chapters_filtered | {
             id: c.id,
             chapter_number: c.chapter_number,
             chapter_title: c.chapter_title,
             sections: [s IN c.sections WHERE s.id IS NOT NULL | s],
             total_nodes: c.total_nodes
         }] AS chapters
    RETURN {
        story_title: coalesce(story.name, story.`Story Name`, toString(story.id), toString(story.g_id)),
        story_id: coalesce(story.id, story.g_id, story.name, elementId(story)),
        story_brief: "",
        chapters: chapters
    } AS story
    ORDER BY story_order, story.id, story.g_id, story.name
    """

def get_story_by_id_query(story_id: str):
    """Query to fetch a specific story by ID. New schema: gr_id nodes with HAS_CHAPTER, HAS_SECTION."""
    return """
    MATCH (story:gr_id)
    WHERE toLower(trim(coalesce(story.category, ''))) = 'story'
      AND (
        toString(coalesce(story.id, story.g_id)) = $story_id
        OR story.name = $story_id
        OR story.`Story Name` = $story_id
        OR toString(story.`Story Number`) = $story_id
        OR toString(story.`Story Number_new`) = $story_id
      )
    OPTIONAL MATCH (story)-[:HAS_CHAPTER]-(chapter:gr_id)
    WHERE toLower(trim(coalesce(chapter.category, ''))) = 'chapter'
    OPTIONAL MATCH (chapter)-[:HAS_SECTION]-(section:gr_id)
    WHERE toLower(trim(coalesce(section.category, ''))) = 'section'
    WITH story, chapter, section,
         toInteger(coalesce(toFloat(chapter.chapter_number), toFloat(chapter.`Chapter Number`), toFloat(chapter.`Chapter Number_new`), 0)) AS chapter_number,
         toInteger(coalesce(toFloat(section.section_number), toFloat(section.`Section Number`), 0)) AS section_num
    ORDER BY chapter_number, section_num
    WITH story, chapter, chapter_number,
         COLLECT(DISTINCT {
             id: coalesce(section.id, section.g_id, section.name, elementId(section)),
             section_title: coalesce(section.name, section.`Section Name`, section.`graph name`, toString(section.id), toString(section.g_id)),
             section_num: section_num,
             section_query: toString(coalesce(section.id, section.g_id, section.name, elementId(section))),
             brief: coalesce(section.summary, section.`Summary`, "")
         }) AS sections
    WITH story,
         COLLECT(DISTINCT {
             id: coalesce(chapter.id, chapter.g_id, chapter.name, elementId(chapter)),
             chapter_number: chapter_number,
             chapter_title: coalesce(chapter.name, chapter.`Chapter Name`, toString(chapter.id), toString(chapter.g_id)),
             sections: [s IN sections WHERE s.id IS NOT NULL | s],
             total_nodes: 0
         }) AS chapters
    RETURN {
        story_title: coalesce(story.name, story.`Story Name`, toString(story.id), toString(story.g_id)),
        story_id: coalesce(story.id, story.g_id, story.name, elementId(story)),
        story_brief: "",
        chapters: [c IN chapters WHERE c.id IS NOT NULL | c]
    } AS story
    """, {"story_id": story_id}

def get_graph_data_by_section_query(section_gid: Optional[str] = None, section_query: Optional[str] = None, section_title: Optional[str] = None) -> Tuple[str, dict]:
    """
    Query to fetch graph data for a section.
    When a section is selected: retrieve all nodes CONNECTED TO the section gr_id node and their relationships.
    New schema: Section is gr_id with category="Section". Nodes linked via relationships (path-based).
    """
    if section_gid:
        match_clause = """
        MATCH (section:gr_id)
        WHERE toLower(trim(coalesce(section.category, ''))) = 'section'
          AND (toString(coalesce(section.id, section.g_id)) = toString($section_gid)
               OR toString(section.name) = toString($section_gid))
        """
        params = {"section_gid": section_gid}
    elif section_query:
        match_clause = """
        MATCH (section:gr_id)
        WHERE toLower(trim(coalesce(section.category, ''))) = 'section'
          AND (toString(coalesce(section.id, section.g_id)) = toString($section_query)
               OR toString(section.name) = toString($section_query)
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

    // All nodes connected to the section gr_id (within 10 hops), excluding other gr_id hierarchy nodes
    MATCH (section)-[*1..10]-(node)
    WHERE NONE(l IN labels(node) WHERE toLower(l) = 'gr_id')
    WITH COLLECT(DISTINCT node) AS all_nodes

    // Relationships between those nodes (pattern comprehension works even when no rels exist)
    WITH all_nodes,
         [(a)-[rel]-(b) WHERE a IN all_nodes AND b IN all_nodes AND id(a) < id(b) | {{ rel: rel, from: a, to: b }}] AS all_rels

    RETURN {{
      nodes: [n IN all_nodes | n {{ .*, elementId: elementId(n), labels: labels(n), node_type: head(labels(n)) }}],
      links: [rd IN all_rels | {{
        id: coalesce(toString(rd.rel.id), elementId(rd.rel)),
        elementId: elementId(rd.rel),
        type: type(rd.rel),
        from_id: coalesce(toString(rd.from.id), toString(rd.from.g_id), elementId(rd.from)),
        to_id: coalesce(toString(rd.to.id), toString(rd.to.g_id), elementId(rd.to)),
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
    WITH $section_query AS section_query
    OPTIONAL MATCH (sec:gr_id)
    WHERE section_query IS NOT NULL
      AND toLower(trim(coalesce(sec.category, ''))) = 'section'
      AND (
        toString(coalesce(sec.id, sec.g_id)) = toString(section_query)
        OR toString(sec.name) = toString(section_query)
        OR sec.`Section Name` = section_query
        OR sec.`graph name` = section_query
      )
    WITH section_query, toString(coalesce(sec.name, sec.id, sec.g_id, sec.`graph name`, elementId(sec))) AS section_graph_name

    MATCH (n)
    WHERE ANY(l IN labels(n) WHERE replace(toLower(l), ' ', '_') = $node_type OR toLower(l) = $node_type)
      AND n[$property_key] IS NOT NULL
      AND NONE(l IN labels(n) WHERE toLower(l) = 'gr_id')
      AND (section_query IS NULL
           OR (section_graph_name IS NOT NULL AND toString(coalesce(n.graph_id, n.gr_id)) = section_graph_name))
    WITH n, toString(n[$property_key]) AS propVal
    WITH propVal,
         collect(DISTINCT {
            id: coalesce(toString(n.id), toString(n.g_id), toString(id(n))),
            name: coalesce(
              n.name,
              n.`Entity Name`,
              n.`Action Text`,
              n.`Result Name`,
              n.`Process Name`,
              n.`Relationship NAME`,
              n.`Country Name`,
              toString(n.id),
              toString(n.g_id),
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
    MATCH (section:gr_id)
    WHERE toLower(trim(coalesce(section.category, ''))) = 'section'
      AND (toString(coalesce(section.id, section.g_id)) = toString($section_gid)
           OR toString(section.name) = toString($section_gid))
    OPTIONAL MATCH (chapter:gr_id)-[:HAS_SECTION]-(section)
    WHERE toLower(trim(coalesce(chapter.category, ''))) = 'chapter'
    RETURN {
        id: coalesce(section.id, section.g_id, section.name, elementId(section)),
        section_title: coalesce(section.name, section.`Section Name`, section.`graph name`, toString(section.id), toString(section.g_id)),
        section_num: toInteger(coalesce(toFloat(section.section_number), toFloat(section.`Section Number`), 0)),
        section_query: toString(coalesce(section.id, section.g_id, section.name, elementId(section))),
        brief: coalesce(section.summary, section.`Summary`, ""),
        chapter: {
            id: coalesce(chapter.id, chapter.g_id, chapter.name, elementId(chapter)),
            chapter_number: toInteger(coalesce(toFloat(chapter.chapter_number), toFloat(chapter.`Chapter Number`), toFloat(chapter.`Chapter Number_new`), 0)),
            chapter_title: coalesce(chapter.name, chapter.`Chapter Name`, toString(chapter.id), toString(chapter.g_id))
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
    MATCH (section:gr_id)
    WHERE toLower(trim(coalesce(section.category, ''))) = 'section'
      AND (toString(coalesce(section.id, section.g_id)) = toString($section_query)
           OR toString(section.name) = toString($section_query)
           OR section.`Section Name` = $section_query
           OR section.`graph name` = $section_query)
    WITH section, toString(coalesce(section.name, section.id, section.g_id, elementId(section))) AS section_graph_name

    MATCH (country)
    WHERE toString(coalesce(country.graph_id, country.gr_id)) = section_graph_name
      AND ANY(l IN labels(country) WHERE toLower(l) = 'country')
      AND toLower(coalesce(country.name, country.`Country Name`, country.`Country Name_new`, '')) = toLower($country_name)

    MATCH (country)-[*0..2]-(n)
    WHERE toString(coalesce(n.graph_id, n.gr_id)) = section_graph_name
      AND NONE(l IN labels(n) WHERE toLower(l) = 'gr_id')
    WITH COLLECT(DISTINCT n) AS all_nodes

    MATCH (a)-[rel]-(b)
    WHERE a IN all_nodes AND b IN all_nodes
      AND NONE(l IN labels(a) WHERE toLower(l) = 'gr_id')
      AND NONE(l IN labels(b) WHERE toLower(l) = 'gr_id')
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
    """Calendar/timeline data for a section. New schema: gr_id section."""
    if section_gid:
        match_clause = """
        MATCH (section:gr_id)
        WHERE toLower(trim(coalesce(section.category, ''))) = 'section'
          AND (toString(coalesce(section.id, section.g_id)) = toString($section_gid)
               OR toString(section.name) = toString($section_gid))
        """
        params = {"section_gid": section_gid}
    elif section_query:
        match_clause = """
        MATCH (section:gr_id)
        WHERE toLower(trim(coalesce(section.category, ''))) = 'section'
          AND (toString(coalesce(section.id, section.g_id)) = toString($section_query)
               OR toString(section.name) = toString($section_query)
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
    WITH section, toString(coalesce(section.name, section.id, section.g_id, section.`graph name`, elementId(section))) AS section_graph_name

    MATCH (n)
    WHERE toString(coalesce(n.graph_id, n.gr_id)) = section_graph_name
      AND NONE(l IN labels(n) WHERE toLower(l) = 'gr_id')
      AND (
        ANY(l IN labels(n) WHERE toLower(l) IN ['action','process','result','event_attend','funding','relationship'])
        OR coalesce(n.date, n.`Date`, n.`Relationship Date`, n.`Action Date`, n.`Process Date`, n.`Disb Date`) IS NOT NULL
      )
    WITH section, section_graph_name,
         COLLECT(DISTINCT {{
           id: coalesce(toString(n.id), toString(n.g_id), elementId(n)),
           node_type: head(labels(n)),
           date: coalesce(n.date, n.`Date`, n.`Relationship Date`, n.`Action Date`, n.`Process Date`, n.`Disb Date`),
           name: coalesce(n.title, n.name, n.`Article Title`, n.summary, toString(n.id), toString(n.g_id)),
           description: coalesce(n.summary, n.`Summary`, n.text, ""),
           properties: n {{ .* }}
         }}) AS timeline_items

    MATCH (f)
    WHERE toString(coalesce(f.graph_id, f.gr_id)) = section_graph_name
      AND NONE(l IN labels(f) WHERE toLower(l) = 'gr_id')
    WITH section, section_graph_name, timeline_items,
         COLLECT(DISTINCT {{
           id: coalesce(toString(f.id), toString(f.g_id), elementId(f)),
           node_type: head(labels(f)),
           name: coalesce(f.title, f.name, f.`Article Title`, f.summary, toString(f.id), toString(f.g_id)),
           description: coalesce(f.summary, f.`Summary`, f.text, ""),
           properties: f {{ .* }}
         }}) AS floating_items

    MATCH (source)-[rel]-(target)
    WHERE toString(coalesce(source.graph_id, source.gr_id)) = section_graph_name
      AND toString(coalesce(target.graph_id, target.gr_id)) = section_graph_name
      AND NONE(l IN labels(source) WHERE toLower(l) = 'gr_id')
      AND NONE(l IN labels(target) WHERE toLower(l) = 'gr_id')
    WITH section, timeline_items, floating_items,
         COLLECT(DISTINCT {{
           id: coalesce(toString(rel.id), elementId(rel)),
           type: type(rel),
           source_id: coalesce(toString(source.id), toString(source.g_id), elementId(source)),
           target_id: coalesce(toString(target.id), toString(target.g_id), elementId(target)),
           source_type: head(labels(source)),
           target_type: head(labels(target)),
           date: coalesce(rel.date, rel.`Date`, rel.`Relationship Date`),
           properties: rel {{ .* }}
         }}) AS relationships

    RETURN {{
      section_query: toString(coalesce(section.id, section.g_id, section.name, elementId(section))),
      section_title: coalesce(section.name, section.`Section Name`, section.`graph name`, toString(section.id), toString(section.g_id)),
      timeline_items: timeline_items,
      floating_items: floating_items,
      relationships: relationships
    }} AS calendarData
    """
    
    return query, params

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

    query = f"""
    {match_clause}
    OPTIONAL MATCH (story)-[:HAS_CHAPTER]-(chapter:gr_id)
    WHERE toLower(trim(coalesce(chapter.category, ''))) = 'chapter'
    OPTIONAL MATCH (chapter)-[:HAS_SECTION]-(section:gr_id)
    WHERE toLower(trim(coalesce(section.category, ''))) = 'section'
    WITH story,
         COLLECT(DISTINCT toString(coalesce(section.name, section.id, section.g_id, section.`graph name`, elementId(section)))) AS section_graph_names
    WITH story, [g IN section_graph_names WHERE g IS NOT NULL AND g <> ""] AS section_graph_names

    MATCH (n)
    WHERE toString(coalesce(n.graph_id, n.gr_id)) IN section_graph_names
      AND NONE(l IN labels(n) WHERE toLower(l) = 'gr_id')
    WITH story,
         COUNT(DISTINCT n) AS total_nodes,
         COUNT(DISTINCT CASE WHEN ANY(l IN labels(n) WHERE toLower(l) = 'entity') THEN coalesce(toString(n.id), toString(n.g_id), elementId(n)) ELSE null END) AS entity_count,
         MAX(coalesce(n.date, n.`Date`, n.`Relationship Date`, n.`Action Date`, n.`Process Date`, n.`Disb Date`)) AS updated_date

    RETURN {{
      story_id: coalesce(story.id, story.g_id, story.name, elementId(story)),
      story_title: coalesce(story.name, story.`Story Name`, toString(story.id), toString(story.g_id)),
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
    MATCH (n)
    WHERE NONE(l IN labels(n) WHERE toLower(l) = 'gr_id')
      AND (n.graph_id IS NOT NULL OR n.gr_id IS NOT NULL OR n.id IS NOT NULL OR n.g_id IS NOT NULL)
    WITH labels(n) AS nodeLabels
    UNWIND nodeLabels AS label
    WITH label
    WHERE toLower(label) <> 'gr_id'
    RETURN DISTINCT replace(toLower(label), ' ', '_') AS node_type
    ORDER BY node_type
    """
    return query, {}
