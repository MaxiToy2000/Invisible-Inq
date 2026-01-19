from typing import Optional, Tuple

def get_all_stories_query():
    """Query to fetch all stories with their chapters and sections, including node counts per chapter"""
    return """
    MATCH (story:Story)
    OPTIONAL MATCH (story)-[:Story_Chapter]->(chapter:Chapter)
    OPTIONAL MATCH (chapter)-[:Chapter_Section]->(section:Section)
    WITH story, chapter, section
    ORDER BY chapter.`Chapter Number`, section.Section_Num
    WITH story, chapter,
         COLLECT(DISTINCT {
             gid: section.gid,
             section_title: section.Section_Title,
             section_num: section.Section_Num,
             section_query: section.section_query,
             brief: section.brief,
             chapter_number: section.`Chapter Number`,
             chapter_title: section.`Chapter Title`
         }) AS sections
    WITH story,
         COLLECT(DISTINCT {
             gid: chapter.gid,
             chapter_number: chapter.`Chapter Number`,
             chapter_title: chapter.`Chapter Title`,
             sections: sections
         }) AS chapters_raw
    WITH story,
         [c IN chapters_raw WHERE c.gid IS NOT NULL | c] AS chapters_filtered
    WITH story,
         [c IN chapters_filtered | {
             gid: c.gid,
             chapter_number: c.chapter_number,
             chapter_title: c.chapter_title,
             sections: [s IN c.sections WHERE s.gid IS NOT NULL | s]
         }] AS chapters
    // Calculate node counts per chapter
    UNWIND chapters AS chapter_data
    WITH story, chapter_data,
         [s IN chapter_data.sections WHERE s.section_query IS NOT NULL AND s.section_query <> "" | s.section_query] AS section_queries
    WITH story, chapter_data, section_queries,
         size(section_queries) AS section_queries_size
    OPTIONAL MATCH (n)
    WHERE (n:Entity OR n:Relationship OR n:Amount OR n:Agency OR n:Action OR n:Country OR n:DBA OR n:Description OR n:Location OR n:`Place Of Performance` OR n:Process OR n:Recipient OR n:Region OR n:Result OR n:Purpose OR n:Transaction OR n:`Sub Agency` OR n:`USAID Program Region`)
      AND section_queries_size > 0
      AND n.section IN section_queries
    WITH story, chapter_data, section_queries_size,
         CASE 
           WHEN section_queries_size = 0 THEN 0
           ELSE COUNT(DISTINCT n)
         END AS chapter_node_count
    WITH story, COLLECT({
        gid: chapter_data.gid,
        chapter_number: chapter_data.chapter_number,
        chapter_title: chapter_data.chapter_title,
        sections: chapter_data.sections,
        total_nodes: chapter_node_count
    }) AS chapters_with_counts
    RETURN {
        story_title: story.Story_Title,
        story_gid: story.gid,
        story_brief: story.brief,
        chapters: chapters_with_counts
    } AS story
    ORDER BY story.Story_Title
    """

def get_story_by_id_query(story_id: str):
    """Query to fetch a specific story by ID (using Story_Title or gid)"""
    return """
    MATCH (story:Story)
    WHERE story.Story_Title = $story_id
       OR toString(story.gid) = $story_id
    OPTIONAL MATCH (story)-[:Story_Chapter]->(chapter:Chapter)
    OPTIONAL MATCH (chapter)-[:Chapter_Section]->(section:Section)
    WITH story, chapter,
         COLLECT(DISTINCT {
             gid: section.gid,
             section_title: section.Section_Title,
             section_num: section.Section_Num,
             section_query: section.section_query,
             brief: section.brief,
             chapter_number: section.`Chapter Number`,
             chapter_title: section.`Chapter Title`
         }) AS sections
    WHERE section.gid IS NOT NULL OR section.gid IS NULL
    WITH story,
         COLLECT(DISTINCT {
             gid: chapter.gid,
             chapter_number: chapter.`Chapter Number`,
             chapter_title: chapter.`Chapter Title`,
             sections: [s IN sections WHERE s.chapter_number = chapter.`Chapter Number` ORDER BY s.section_num]
         }) AS chapters
    RETURN {
        story_title: story.Story_Title,
        story_gid: story.gid,
        story_brief: story.brief,
        chapters: [c IN chapters WHERE c.gid IS NOT NULL ORDER BY c.chapter_number]
    } AS story
    """, {"story_id": story_id}

def get_graph_data_by_section_query(section_gid: Optional[str] = None, section_query: Optional[str] = None, section_title: Optional[str] = None) -> Tuple[str, dict]:
    """
    Query to fetch graph data (nodes and links) for a section.
    
    NODES contain:
    - All ENTITY nodes whose "section" field matches the "section_query" value of the clicked SECTION
    - All RELATIONSHIP nodes whose "section" field matches the "section_query" value of the clicked SECTION
    
    LINKS contain:
    - The relationships between the NODES included in the database's Entity_Relationship
    """
    
    # Build the match clause based on what parameter was provided
    if section_gid:
        match_clause = "MATCH (section:Section {gid: $section_gid})"
        params = {"section_gid": section_gid}
    elif section_query:
        match_clause = "MATCH (section:Section {section_query: $section_query})"
        params = {"section_query": section_query}
    elif section_title:
        match_clause = "MATCH (section:Section {Section_Title: $section_title})"
        params = {"section_title": section_title}
    else:
        raise ValueError("At least one of section_gid, section_query, or section_title must be provided")
    
    query = f"""
    {match_clause}
    WITH section

    // Get all nodes that match this section's section_query
    // Include Entity, Relationship, Amount, Agency, Action, Country, DBA, Description, Location, Place Of Performance, Process, Recipient, Region, Result, Purpose, Transaction, Sub Agency, USAID Program Region
    MATCH (n)
    WHERE (n:Entity OR n:Relationship OR n:Amount OR n:Agency OR n:Action OR n:Country OR n:DBA OR n:Description OR n:Location OR n:`Place Of Performance` OR n:Process OR n:Recipient OR n:Region OR n:Result OR n:Purpose OR n:Transaction OR n:`Sub Agency` OR n:`USAID Program Region`)
      AND n.section = section.section_query

    // Get all relationships from these nodes to other nodes
    // Include relationships where target matches any of the node types
    // and either target's section matches OR source's section matches
    MATCH (n)-[r]->(m)
    WHERE (m:Entity OR m:Relationship OR m:Amount OR m:Agency OR m:Action OR m:Country OR m:DBA OR m:Description OR m:Location OR m:`Place Of Performance` OR m:Process OR m:Recipient OR m:Region OR m:Result OR m:Purpose OR m:Transaction OR m:`Sub Agency` OR m:`USAID Program Region`)
      AND (m.section = section.section_query OR n.section = section.section_query)

    // Collect all unique node gids (both source n and target m nodes)
    WITH section,
         COLLECT(DISTINCT n.gid) + COLLECT(DISTINCT m.gid) as all_node_gids_list

    // Remove nulls and get unique gids
    WITH section,
         [gid IN all_node_gids_list WHERE gid IS NOT NULL] as all_node_gids

    // Get all nodes by their gids
    MATCH (node)
    WHERE (node:Entity OR node:Relationship OR node:Amount OR node:Agency OR node:Action OR node:Country OR node:DBA OR node:Description OR node:Location OR node:`Place Of Performance` OR node:Process OR node:Recipient OR node:Region OR node:Result OR node:Purpose OR node:Transaction OR node:`Sub Agency` OR node:`USAID Program Region`)
      AND node.gid IN all_node_gids

    // Get all relationships again with the collected nodes
    MATCH (n)
    WHERE (n:Entity OR n:Relationship OR n:Amount OR n:Agency OR n:Action OR n:Country OR n:DBA OR n:Description OR n:Location OR n:`Place Of Performance` OR n:Process OR n:Recipient OR n:Region OR n:Result OR n:Purpose OR n:Transaction OR n:`Sub Agency` OR n:`USAID Program Region`)
      AND n.section = section.section_query
      AND n.gid IN all_node_gids

    MATCH (n)-[r]->(m)
    WHERE (m:Entity OR m:Relationship OR m:Amount OR m:Agency OR m:Action OR m:Country OR m:DBA OR m:Description OR m:Location OR m:`Place Of Performance` OR m:Process OR m:Recipient OR m:Region OR m:Result OR m:Purpose OR m:Transaction OR m:`Sub Agency` OR m:`USAID Program Region`)
      AND (m.section = section.section_query OR n.section = section.section_query)
      AND m.gid IN all_node_gids

    // Collect all nodes and relationships
    WITH section,
         COLLECT(DISTINCT node) as all_nodes,
         COLLECT(DISTINCT {{
             rel: r,
             from: n,
             to: m,
             type: type(r)
         }}) as all_rels

    // Format and return
    // Return different properties based on node type (Entity vs Relationship)
    RETURN {{
        nodes: [node IN all_nodes |
            CASE
                WHEN 'Entity' IN labels(node) THEN {{
                    gid: node.gid,
                    node_type: 'Entity',
                    section: node.section,
                    entity_name: node.`Entity Name`,
                    entity_acronym: node.`Entity Acronym`,
                    relationship_name: node.`Relationship NAME`,
                    amount: node.Amount,
                    receiver_name: node.`Receiver Name`,
                    article_url: node.`article URL`,
                    degree: node.degree,
                    purpose: node.Purpose,
                    url: node.URL,
                    relationship_summary: node.`Relationship Summary`,
                    entity_2_name: node.`Entity 2 Name`,
                    date: node.Date,
                    action_summary: node.`Action Summary`,
                    article_url_full: node.`Article URL`,
                    article_text: node.`Article Text`,
                    article_title: node.`Article Title`,
                    distributor_full_name: node.`Distributor Full Name`,
                    summary: node.Summary,
                    modifier_entity_name: node.`Modifier Entity Name`,
                    relationship_date: node.`Relationship Date`,
                    tag: node.Tag,
                    action_text: node.`Action Text`
                }}
                WHEN 'Relationship' IN labels(node) THEN {{
                    gid: node.gid,
                    node_type: 'Relationship',
                    section: node.section,
                    relationship_name: node.`Relationship NAME`,
                    article_text: node.`Article Text`,
                    article_url: node.`Article URL`,
                    degree: node.degree,
                    relationship_date: node.`Relationship Date`,
                    tag: node.Tag,
                    relationship_summary: node.`Relationship Summary`
                }}
                WHEN 'Amount' IN labels(node) THEN {{
                    gid: node.gid,
                    node_type: 'Amount',
                    section: node.section,
                    degree: node.degree,
                    Amount: node.Amount,
                    `Distributor Full Name`: node.`Distributor Full Name`,
                    `Receiver Name`: node.`Receiver Name`,
                    Purpose: node.Purpose,
                    `Disb Date`: node.`Disb Date`,
                    `End Date`: node.`End Date`,
                    `Project Number`: node.`Project Number`,
                    ID: node.ID,
                    Summary: node.Summary,
                    URL: node.URL,
                    federal_action_obligation: node.federal_action_obligation,
                    awarding_office_name: node.awarding_office_name,
                    action_date_fiscal_year: node.action_date_fiscal_year,
                    primary_place_of_performance_scope: node.primary_place_of_performance_scope,
                    action_date: node.action_date,
                    initial_report_date: node.initial_report_date,
                    last_modified_date: node.last_modified_date,
                    awarding_agency_name: node.awarding_agency_name,
                    transaction_description: node.transaction_description,
                    generated_pragmatic_obligations: node.generated_pragmatic_obligations,
                    primary_place_of_performance_country_name: node.primary_place_of_performance_country_name,
                    object_classes_funding_this_award: node.object_classes_funding_this_award,
                    cfda_title: node.cfda_title,
                    awarding_sub_agency_name: node.awarding_sub_agency_name,
                    total_outlayed_amount_for_overall_award: node.total_outlayed_amount_for_overall_award,
                    period_of_performance_current_end_date: node.period_of_performance_current_end_date,
                    primary_place_of_performance_city_name: node.primary_place_of_performance_city_name,
                    usaspending_permalink: node.usaspending_permalink,
                    prime_award_base_transaction_description: node.prime_award_base_transaction_description,
                    period_of_performance_start_date: node.period_of_performance_start_date
                }}
                WHEN 'Agency' IN labels(node) THEN {{
                    gid: node.gid,
                    node_type: 'Agency',
                    section: node.section,
                    awarding_agency: node.`Awarding Agency`,
                    contracting_agency_id: node.`Contracting Agency ID`,
                    awarding_agency_name: node.awarding_agency_name,
                    contracting_agency: node.`Contracting Agency`
                }}
                WHEN 'Action' IN labels(node) THEN {{
                    gid: node.gid,
                    node_type: 'Action',
                    section: node.section,
                    action_summary: node.`Action Summary`,
                    article_url: node.`Article URL`,
                    article_title: node.`Article Title`,
                    degree: node.degree,
                    action_text: node.`Action Text`
                }}
                WHEN 'Country' IN labels(node) THEN {{
                    gid: node.gid,
                    node_type: 'Country',
                    section: node.section,
                    country_name: node.`Country Name`,
                    degree: node.degree
                }}
                WHEN 'DBA' IN labels(node) THEN {{
                    gid: node.gid,
                    node_type: 'DBA',
                    section: node.section,
                    recipient_name_raw: node.recipient_name_raw,
                    subawardee_name: node.subawardee_name
                }}
                WHEN 'Description' IN labels(node) THEN {{
                    gid: node.gid,
                    node_type: 'Description',
                    section: node.section,
                    award_id: node.`Award ID`,
                    title: node.Title,
                    base_transaction_description: node.`Base Transaction Description`,
                    program_activities: node.`Program Activities`
                }}
                WHEN 'Location' IN labels(node) THEN {{
                    gid: node.gid,
                    node_type: 'Location',
                    section: node.section,
                    performance_location: node.`Performance Location`
                }}
                WHEN 'Place Of Performance' IN labels(node) THEN {{
                    gid: node.gid,
                    node_type: 'Place Of Performance',
                    section: node.section,
                    primary_place_of_performance_country_name: node.primary_place_of_performance_country_name,
                    recipient_country_name: node.recipient_country_name,
                    primary_place_of_performance_city_name: node.primary_place_of_performance_city_name,
                    primary_place_of_performance_country_code: node.primary_place_of_performance_country_code
                }}
                WHEN 'Process' IN labels(node) THEN {{
                    gid: node.gid,
                    node_type: 'Process',
                    section: node.section,
                    process_date: node.`Process Date`,
                    article_url: node.`Article URL`,
                    article_text: node.`Article Text`,
                    process_category: node.`Process Category`,
                    process_summary: node.`Process Summary`,
                    degree: node.degree,
                    process: node.Process
                }}
                WHEN 'Recipient' IN labels(node) THEN {{
                    gid: node.gid,
                    node_type: 'Recipient',
                    section: node.section,
                    recipient_name: node.`Recipient Name`,
                    entity_city: node.`Entity City`,
                    legal_business_name: node.`Legal Business Name`,
                    entity_zip_code: node.`Entity ZIP Code`,
                    recipient_name_lower: node.recipient_name
                }}
                WHEN 'Region' IN labels(node) THEN {{
                    gid: node.gid,
                    node_type: 'Region',
                    section: node.section,
                    global_region: node.`Global Region`
                }}
                WHEN 'Result' IN labels(node) THEN {{
                    gid: node.gid,
                    node_type: 'Result',
                    section: node.section,
                    process_date: node.`Process Date`,
                    article_url: node.`Article URL`,
                    article_text: node.`Article Text`,
                    process_result: node.`Process Result`,
                    process_summary: node.`Process Summary`,
                    process_target: node.`Process Target`
                }}
                WHEN 'Purpose' IN labels(node) THEN {{
                    gid: node.gid,
                    node_type: 'Purpose',
                    section: node.section,
                    url: node.URL,
                    usaspending_permalink: node.usaspending_permalink,
                    naics_description: node.`NAICS Description`,
                    prime_award_base_transaction_description: node.prime_award_base_transaction_description,
                    transaction_description: node.transaction_description,
                    cfda_title: node.cfda_title,
                    additional_reporting_description: node.`Additional Reporting Description`,
                    psc_description: node.`PSC Description`,
                    program_activities_funding_this_award: node.program_activities_funding_this_award,
                    purpose: node.Purpose
                }}
                WHEN 'Transaction' IN labels(node) THEN {{
                    gid: node.gid,
                    node_type: 'Transaction',
                    section: node.section,
                    url: node.URL,
                    performance_end_date: node.`Performance End Date`,
                    action_date: node.`Action Date`,
                    total_outlayed_for_award: node.`Total Outlayed For Award`,
                    award_id: node.`Award ID`,
                    total_obligated: node.`Total Obligated`,
                    transaction_key: node.`Transaction Key`,
                    awarding_sub_agency: node.`Awarding Sub-Agency`,
                    recipient_name: node.`Recipient Name`,
                    performance_start_date: node.`Performance Start Date`,
                    doc_class: node.`Doc Class`,
                    title: node.Title,
                    fed_action_obligated: node.`Fed Action Obligated`,
                    base_transaction_description: node.`Base Transaction Description`,
                    transaction_description: node.`Transaction Description`
                }}
                WHEN 'Sub Agency' IN labels(node) THEN {{
                    gid: node.gid,
                    node_type: 'Sub Agency',
                    section: node.section,
                    awarding_sub_agency: node.`Awarding Sub-Agency`,
                    awarding_office_name: node.awarding_office_name
                }}
                WHEN 'USAID Program Region' IN labels(node) THEN {{
                    gid: node.gid,
                    node_type: 'USAID Program Region',
                    section: node.section,
                    usaid_region: node.`USAID Region`
                }}
                ELSE {{
                    gid: node.gid,
                    node_type: labels(node)[0],
                    section: node.section
                }}
            END
        ],
        links: [rel_data IN all_rels WHERE rel_data.rel IS NOT NULL | {{
            gid: id(rel_data.rel),
            from_gid: rel_data.from.gid,
            to_gid: rel_data.to.gid,
            from_name: CASE
                WHEN 'Entity' IN labels(rel_data.from) THEN rel_data.from.`Entity Name`
                WHEN 'Relationship' IN labels(rel_data.from) THEN rel_data.from.`Relationship NAME`
                WHEN 'Country' IN labels(rel_data.from) THEN rel_data.from.`Country Name`
                WHEN 'Agency' IN labels(rel_data.from) THEN COALESCE(rel_data.from.`Awarding Agency`, rel_data.from.awarding_agency_name, toString(rel_data.from.gid))
                WHEN 'Recipient' IN labels(rel_data.from) THEN COALESCE(rel_data.from.`Recipient Name`, rel_data.from.recipient_name, toString(rel_data.from.gid))
                WHEN 'DBA' IN labels(rel_data.from) THEN rel_data.from.recipient_name_raw
                WHEN 'Description' IN labels(rel_data.from) THEN rel_data.from.Title
                WHEN 'Location' IN labels(rel_data.from) THEN rel_data.from.`Performance Location`
                WHEN 'Region' IN labels(rel_data.from) THEN rel_data.from.`Global Region`
                WHEN 'Process' IN labels(rel_data.from) THEN rel_data.from.Process
                WHEN 'Action' IN labels(rel_data.from) THEN rel_data.from.`Action Summary`
                WHEN 'Result' IN labels(rel_data.from) THEN rel_data.from.`Process Result`
                WHEN 'Amount' IN labels(rel_data.from) THEN rel_data.from.cfda_title
                WHEN 'Place Of Performance' IN labels(rel_data.from) THEN rel_data.from.primary_place_of_performance_city_name
                WHEN 'Purpose' IN labels(rel_data.from) THEN rel_data.from.Purpose
                WHEN 'Transaction' IN labels(rel_data.from) THEN rel_data.from.Title
                WHEN 'Sub Agency' IN labels(rel_data.from) THEN rel_data.from.`Awarding Sub-Agency`
                WHEN 'USAID Program Region' IN labels(rel_data.from) THEN rel_data.from.`USAID Region`
                ELSE toString(rel_data.from.gid)
            END,
            to_name: CASE
                WHEN 'Entity' IN labels(rel_data.to) THEN rel_data.to.`Entity Name`
                WHEN 'Relationship' IN labels(rel_data.to) THEN rel_data.to.`Relationship NAME`
                WHEN 'Country' IN labels(rel_data.to) THEN rel_data.to.`Country Name`
                WHEN 'Agency' IN labels(rel_data.to) THEN COALESCE(rel_data.to.`Awarding Agency`, rel_data.to.awarding_agency_name, toString(rel_data.to.gid))
                WHEN 'Recipient' IN labels(rel_data.to) THEN COALESCE(rel_data.to.`Recipient Name`, rel_data.to.recipient_name, toString(rel_data.to.gid))
                WHEN 'DBA' IN labels(rel_data.to) THEN rel_data.to.recipient_name_raw
                WHEN 'Description' IN labels(rel_data.to) THEN rel_data.to.Title
                WHEN 'Location' IN labels(rel_data.to) THEN rel_data.to.`Performance Location`
                WHEN 'Region' IN labels(rel_data.to) THEN rel_data.to.`Global Region`
                WHEN 'Process' IN labels(rel_data.to) THEN rel_data.to.Process
                WHEN 'Action' IN labels(rel_data.to) THEN rel_data.to.`Action Summary`
                WHEN 'Result' IN labels(rel_data.to) THEN rel_data.to.`Process Result`
                WHEN 'Amount' IN labels(rel_data.to) THEN rel_data.to.transaction_description
                WHEN 'Place Of Performance' IN labels(rel_data.to) THEN rel_data.to.primary_place_of_performance_city_name
                WHEN 'Purpose' IN labels(rel_data.to) THEN rel_data.to.Purpose
                WHEN 'Transaction' IN labels(rel_data.to) THEN rel_data.to.Title
                WHEN 'Sub Agency' IN labels(rel_data.to) THEN rel_data.to.`Awarding Sub-Agency`
                WHEN 'USAID Program Region' IN labels(rel_data.to) THEN rel_data.to.`USAID Region`
                ELSE toString(rel_data.to.gid)
            END,
            relationship_summary: rel_data.rel.`Relationship Summary`,
            article_title: rel_data.rel.`Article Title`,
            article_url: rel_data.rel.`article URL`,
            relationship_date: rel_data.rel.`Relationship Date`,
            relationship_quality: rel_data.rel.`Relationship Quality`,
            type: rel_data.type
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
    MATCH (n)
    WHERE ANY(l IN labels(n) WHERE replace(toLower(l), ' ', '_') = $node_type OR toLower(l) = $node_type)
      AND ($section_query IS NULL OR n.section = $section_query)
      AND n[$property_key] IS NOT NULL
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
    MATCH (section:Section {gid: $section_gid})
    OPTIONAL MATCH (chapter:Chapter)-[:Chapter_Section]->(section)
    RETURN {
        gid: section.gid,
        section_title: section.Section_Title,
        section_num: section.Section_Num,
        section_query: section.section_query,
        brief: section.brief,
        chapter: {
            gid: chapter.gid,
            chapter_number: chapter.`Chapter Number`,
            chapter_title: chapter.`Chapter Title`
        }
    } AS section
    """, {"section_gid": section_gid}

def get_graph_data_by_section_and_country_query(section_query: str, country_name: str) -> Tuple[str, dict]:
    """
    Query to fetch graph data (nodes and links) for a section filtered by country.
    
    NODES contain:
    - All nodes whose "section" field matches the section_query AND are connected to the specified country
    - Country nodes matching the country_name
    
    LINKS contain:
    - The relationships between the NODES included in the database
    """
    
    query = f"""
    MATCH (section:Section {{section_query: $section_query}})
    WITH section

    // Find the country node(s) matching the country name in this section
    MATCH (country:Country)
    WHERE country.`Country Name` = $country_name
      AND country.section = section.section_query

    // Get all nodes directly connected to this country (1 hop)
    MATCH (country)-[r1]-(n)
    WHERE (n:Entity OR n:Relationship OR n:Amount OR n:Agency OR n:Action OR n:Country OR n:DBA OR n:Description OR n:Location OR n:`Place Of Performance` OR n:Process OR n:Recipient OR n:Region OR n:Result OR n:Purpose OR n:Transaction OR n:`Sub Agency` OR n:`USAID Program Region`)
      AND n.section = section.section_query

    // Collect direct connections first
    WITH section, country, COLLECT(DISTINCT n.gid) as direct_connections

    // Also get nodes connected through one intermediate node (2 hops)
    OPTIONAL MATCH (country)-[r2]-(intermediate)-[r3]-(n2)
    WHERE (intermediate:Entity OR intermediate:Relationship OR intermediate:Amount OR intermediate:Agency OR intermediate:Action OR intermediate:Country OR intermediate:DBA OR intermediate:Description OR intermediate:Location OR intermediate:`Place Of Performance` OR intermediate:Process OR intermediate:Recipient OR intermediate:Region OR intermediate:Result OR intermediate:Purpose OR intermediate:Transaction OR intermediate:`Sub Agency` OR intermediate:`USAID Program Region`)
      AND (n2:Entity OR n2:Relationship OR n2:Amount OR n2:Agency OR n2:Action OR n2:Country OR n2:DBA OR n2:Description OR n2:Location OR n2:`Place Of Performance` OR n2:Process OR n2:Recipient OR n2:Region OR n2:Result OR n2:Purpose OR n2:Transaction OR n2:`Sub Agency` OR n2:`USAID Program Region`)
      AND intermediate.section = section.section_query
      AND n2.section = section.section_query

    // Collect all unique node gids (country, direct connections, and 2-hop connections)
    WITH section, country, direct_connections,
         COLLECT(DISTINCT n2.gid) as two_hop_connections
    WITH section, country,
         direct_connections + two_hop_connections + [country.gid] as all_node_gids_list

    // Remove nulls and get unique gids
    WITH section,
         [gid IN all_node_gids_list WHERE gid IS NOT NULL] as all_node_gids

    // Check if we have any nodes to process
    WITH section, all_node_gids,
         CASE WHEN size(all_node_gids) = 0 THEN [] ELSE all_node_gids END as node_gids_to_process

    // Get all nodes by their gids
    OPTIONAL MATCH (node)
    WHERE (node:Entity OR node:Relationship OR node:Amount OR node:Agency OR node:Action OR node:Country OR node:DBA OR node:Description OR node:Location OR node:`Place Of Performance` OR node:Process OR node:Recipient OR node:Region OR node:Result OR node:Purpose OR node:Transaction OR node:`Sub Agency` OR node:`USAID Program Region`)
      AND node.gid IN node_gids_to_process
      AND node.section = section.section_query

    // Get all relationships between these nodes
    OPTIONAL MATCH (n)
    WHERE (n:Entity OR n:Relationship OR n:Amount OR n:Agency OR n:Action OR n:Country OR n:DBA OR n:Description OR n:Location OR n:`Place Of Performance` OR n:Process OR n:Recipient OR n:Region OR n:Result OR n:Purpose OR n:Transaction OR n:`Sub Agency` OR n:`USAID Program Region`)
      AND n.section = section.section_query
      AND n.gid IN node_gids_to_process

    OPTIONAL MATCH (n)-[r]->(m)
    WHERE (m:Entity OR m:Relationship OR m:Amount OR m:Agency OR m:Action OR m:Country OR m:DBA OR m:Description OR m:Location OR m:`Place Of Performance` OR m:Process OR m:Recipient OR m:Region OR m:Result OR m:Purpose OR m:Transaction OR m:`Sub Agency` OR m:`USAID Program Region`)
      AND m.section = section.section_query
      AND m.gid IN node_gids_to_process

    // Collect all nodes and relationships (filter out nulls from OPTIONAL MATCH)
    WITH section,
         [node IN COLLECT(DISTINCT node) WHERE node IS NOT NULL] as all_nodes,
         [rel_data IN COLLECT(DISTINCT {{
             rel: r,
             from: n,
             to: m,
             type: type(r)
         }}) WHERE rel_data.rel IS NOT NULL AND rel_data.from IS NOT NULL AND rel_data.to IS NOT NULL] as all_rels

    // Format and return (reuse the same formatting logic from get_graph_data_by_section_query)
    RETURN {{
        nodes: [node IN all_nodes |
            CASE
                WHEN 'Entity' IN labels(node) THEN {{
                    gid: node.gid,
                    node_type: 'Entity',
                    section: node.section,
                    entity_name: node.`Entity Name`,
                    entity_acronym: node.`Entity Acronym`,
                    relationship_name: node.`Relationship NAME`,
                    amount: node.Amount,
                    receiver_name: node.`Receiver Name`,
                    article_url: node.`article URL`,
                    degree: node.degree,
                    purpose: node.Purpose,
                    url: node.URL,
                    relationship_summary: node.`Relationship Summary`,
                    entity_2_name: node.`Entity 2 Name`,
                    date: node.Date,
                    action_summary: node.`Action Summary`,
                    article_url_full: node.`Article URL`,
                    article_text: node.`Article Text`,
                    article_title: node.`Article Title`,
                    distributor_full_name: node.`Distributor Full Name`,
                    summary: node.Summary,
                    modifier_entity_name: node.`Modifier Entity Name`,
                    relationship_date: node.`Relationship Date`,
                    tag: node.Tag,
                    action_text: node.`Action Text`
                }}
                WHEN 'Amount' IN labels(node) THEN {{
                    gid: node.gid,
                    node_type: 'Amount',
                    section: node.section,
                    degree: node.degree,
                    Amount: node.Amount,
                    `Distributor Full Name`: node.`Distributor Full Name`,
                    `Receiver Name`: node.`Receiver Name`,
                    Purpose: node.Purpose,
                    `Disb Date`: node.`Disb Date`,
                    `End Date`: node.`End Date`,
                    `Project Number`: node.`Project Number`,
                    ID: node.ID,
                    Summary: node.Summary,
                    URL: node.URL
                }}
                WHEN 'Country' IN labels(node) THEN {{
                    gid: node.gid,
                    node_type: 'Country',
                    section: node.section,
                    country_name: node.`Country Name`,
                    degree: node.degree
                }}
                ELSE {{
                    gid: node.gid,
                    node_type: labels(node)[0],
                    section: node.section
                }}
            END
        ],
        links: [rel_data IN all_rels WHERE rel_data.rel IS NOT NULL | {{
            gid: id(rel_data.rel),
            from_gid: rel_data.from.gid,
            to_gid: rel_data.to.gid,
            from_name: CASE
                WHEN 'Entity' IN labels(rel_data.from) THEN rel_data.from.`Entity Name`
                WHEN 'Relationship' IN labels(rel_data.from) THEN rel_data.from.`Relationship NAME`
                WHEN 'Country' IN labels(rel_data.from) THEN rel_data.from.`Country Name`
                ELSE toString(rel_data.from.gid)
            END,
            to_name: CASE
                WHEN 'Entity' IN labels(rel_data.to) THEN rel_data.to.`Entity Name`
                WHEN 'Relationship' IN labels(rel_data.to) THEN rel_data.to.`Relationship NAME`
                WHEN 'Country' IN labels(rel_data.to) THEN rel_data.to.`Country Name`
                ELSE toString(rel_data.to.gid)
            END,
            relationship_summary: rel_data.rel.`Relationship Summary`,
            article_title: rel_data.rel.`Article Title`,
            article_url: rel_data.rel.`article URL`,
            relationship_date: rel_data.rel.`Relationship Date`,
            relationship_quality: rel_data.rel.`Relationship Quality`,
            type: rel_data.type
        }}]
    }} AS graphData
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
    
    # Build the match clause based on what parameter was provided
    if section_gid:
        match_clause = "MATCH (section:Section {gid: $section_gid})"
        params = {"section_gid": section_gid}
    elif section_query:
        match_clause = "MATCH (section:Section {section_query: $section_query})"
        params = {"section_query": section_query}
    elif section_title:
        match_clause = "MATCH (section:Section {Section_Title: $section_title})"
        params = {"section_title": section_title}
    else:
        raise ValueError("At least one of section_gid, section_query, or section_title must be provided")
    
    query = f"""
    {match_clause}
    WITH section

    // ========== TIMELINE ITEMS: Milestone, Result, Incident (mapped as Result), Action ==========
    OPTIONAL MATCH (timeline_node)
    WHERE timeline_node.section = section.section_query
      AND (timeline_node:Result OR timeline_node:Action)
      AND timeline_node.Date IS NOT NULL

    WITH section, timeline_node,
         labels(timeline_node)[0] as node_label,
         CASE
             WHEN timeline_node:Result THEN COALESCE(timeline_node.`Result Name`, timeline_node.`Process Result`, 'Result')
             WHEN timeline_node:Action THEN COALESCE(timeline_node.`Action Text`, timeline_node.`Action Summary`, 'Action')
             ELSE toString(timeline_node.gid)
         END as node_name,
         CASE
             WHEN timeline_node:Result THEN COALESCE(timeline_node.`Process Summary`, timeline_node.brief, '')
             WHEN timeline_node:Action THEN COALESCE(timeline_node.`Action Summary`, timeline_node.brief, '')
             ELSE ''
         END as node_description,
         CASE
             WHEN timeline_node:Result THEN 2
             WHEN timeline_node:Action THEN 3
             ELSE 4
         END as type_priority
    WHERE timeline_node IS NOT NULL
    
    // Sort timeline items by date DESC, then by type priority ASC
    WITH section, timeline_node, node_label, node_name, node_description, type_priority
    ORDER BY timeline_node.Date DESC, type_priority ASC
    
    WITH section,
         COLLECT(DISTINCT {{
             gid: timeline_node.gid,
             node_type: node_label,
             date: timeline_node.Date,
             name: node_name,
             description: node_description,
             properties: timeline_node {{
                 .gid, .Date, .section, .degree,
                 .`Process Date`, .`Article URL`, .`Article Text`, .`Process Result`, 
                 .`Process Summary`, .`Process Target`, .`Action Text`, .`Action Summary`,
                 .`Article Title`, .`Result Name`
             }},
             type_priority: type_priority
         }}) as timeline_items

    // ========== FREE-FLOATING ITEMS: Entity, Location, Event, Country, etc. ==========
    OPTIONAL MATCH (floating_node)
    WHERE floating_node.section = section.section_query
      AND (floating_node:Entity OR floating_node:Location OR floating_node:Country 
           OR floating_node:Recipient OR floating_node:Region OR floating_node:Agency
           OR floating_node:`Place Of Performance` OR floating_node:Process)

    WITH section, timeline_items,
         COLLECT(DISTINCT {{
             gid: floating_node.gid,
             node_type: labels(floating_node)[0],
             name: CASE
                 WHEN floating_node:Entity THEN COALESCE(floating_node.`Entity Name`, 'Entity')
                 WHEN floating_node:Location THEN COALESCE(floating_node.`Performance Location`, 'Location')
                 WHEN floating_node:Country THEN COALESCE(floating_node.`Country Name`, 'Country')
                 WHEN floating_node:Recipient THEN COALESCE(floating_node.`Recipient Name`, 'Recipient')
                 WHEN floating_node:Region THEN COALESCE(floating_node.`Global Region`, 'Region')
                 WHEN floating_node:Agency THEN COALESCE(floating_node.`Awarding Agency`, 'Agency')
                 WHEN floating_node:`Place Of Performance` THEN COALESCE(floating_node.primary_place_of_performance_country_name, 'Place')
                 WHEN floating_node:Process THEN COALESCE(floating_node.Process, floating_node.`Process Summary`, 'Process')
                 ELSE toString(floating_node.gid)
             END,
             properties: floating_node {{
                 .gid, .section, .degree,
                 .`Entity Name`, .`Performance Location`, .`Country Name`,
                 .`Recipient Name`, .`Global Region`, .`Awarding Agency`,
                 .primary_place_of_performance_country_name, .Process, .`Process Summary`
             }}
         }}) as floating_items

    // ========== RELATIONSHIPS: connections between ALL items ==========
    OPTIONAL MATCH (source)-[rel]->(target)
    WHERE source.section = section.section_query
      AND target.section = section.section_query
      AND (source:Entity OR source:Relationship OR source:Action OR source:Result OR source:Country 
           OR source:Location OR source:Recipient OR source:Region OR source:Agency 
           OR source:`Place Of Performance` OR source:Process)
      AND (target:Entity OR target:Relationship OR target:Action OR target:Result OR target:Country 
           OR target:Location OR target:Recipient OR target:Region OR target:Agency 
           OR target:`Place Of Performance` OR target:Process)

    WITH section, timeline_items, floating_items,
         COLLECT(DISTINCT {{
             gid: id(rel),
             type: type(rel),
             source_gid: source.gid,
             target_gid: target.gid,
             source_type: labels(source)[0],
             target_type: labels(target)[0],
             date: rel.`Relationship Date`,
             properties: rel {{
                 .`Relationship Summary`, .`Article Title`, .`article URL`, .`Relationship Date`
             }}
         }}) as relationships

    RETURN {{
        section_query: section.section_query,
        section_title: section.Section_Title,
        timeline_items: timeline_items,
        floating_items: floating_items,
        relationships: relationships
    }} AS calendarData
    """
    
    return query, params

def get_story_statistics_query(story_gid: Optional[str] = None, story_title: Optional[str] = None):
    """Get statistics for a story: total nodes, entity count, etc."""
    if story_gid:
        match_clause = "MATCH (story:Story {gid: $story_gid})"
        params = {"story_gid": story_gid}
    elif story_title:
        match_clause = "MATCH (story:Story {Story_Title: $story_title})"
        params = {"story_title": story_title}
    else:
        raise ValueError("Either story_gid or story_title must be provided")
    
    query = f"""
    {match_clause}
    OPTIONAL MATCH (story)-[:Story_Chapter]->(chapter:Chapter)
    OPTIONAL MATCH (chapter)-[:Chapter_Section]->(section:Section)
    
    // Get all section queries for this story
    WITH story, COLLECT(DISTINCT section.section_query) as section_queries
    
    // Count all nodes across all sections in this story
    MATCH (n)
    WHERE (n:Entity OR n:Relationship OR n:Amount OR n:Agency OR n:Action OR n:Country OR n:DBA OR n:Description OR n:Location OR n:`Place Of Performance` OR n:Process OR n:Recipient OR n:Region OR n:Result OR n:Purpose OR n:Transaction OR n:`Sub Agency` OR n:`USAID Program Region`)
      AND n.section IN section_queries
    
    // Count total nodes, entities, and highlighted nodes separately
    WITH story, section_queries, 
         COUNT(DISTINCT n) as total_nodes,
         COLLECT(DISTINCT CASE WHEN n:Entity THEN n.gid ELSE null END) as entity_gids,
         COUNT(DISTINCT CASE WHEN n.highlight = true THEN n.gid ELSE null END) as highlighted_nodes
    
    WITH story, total_nodes, highlighted_nodes,
         SIZE([gid IN entity_gids WHERE gid IS NOT NULL]) as entity_count
    
    RETURN {{
        story_gid: story.gid,
        story_brief: story.brief,
        story_title: story.Story_Title,
        total_nodes: total_nodes,
        entity_count: entity_count,
        highlighted_nodes: highlighted_nodes,
        updated_date: COALESCE(story.updated_date, story.created_date, story.date, datetime())
    }} AS statistics
    """
    
    return query, params

def get_all_node_types_query():
    """Query to fetch all distinct node types (labels) from the database"""
    # Use a query that finds all distinct labels by checking actual nodes
    # This is more reliable than CALL db.labels() which may not work in all Neo4j versions
    query = """
    // Get all distinct node labels by sampling nodes
    MATCH (n)
    WHERE n:Entity OR n:Relationship OR n:Amount OR n:Agency OR n:Action OR n:Country OR n:DBA OR n:Description OR n:Location OR n:`Place Of Performance` OR n:Process OR n:Recipient OR n:Region OR n:Result OR n:Purpose OR n:Transaction OR n:`Sub Agency` OR n:`USAID Program Region`
    WITH labels(n) AS nodeLabels
    UNWIND nodeLabels AS label
    WITH label
    WHERE label IN ['Entity', 'Relationship', 'Amount', 'Agency', 'Action', 'Country', 'DBA', 'Description', 'Location', 'Place Of Performance', 'Process', 'Recipient', 'Region', 'Result', 'Purpose', 'Transaction', 'Sub Agency', 'USAID Program Region']
    RETURN DISTINCT label AS node_type
    ORDER BY node_type
    """
    return query, {}
