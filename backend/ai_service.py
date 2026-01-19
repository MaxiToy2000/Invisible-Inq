import json
import re
import requests
from typing import Optional, Dict, Any
from config import Config
from database import db

def get_database_schema() -> Dict[str, Any]:
    schema = {
        "node_labels": [],
        "relationship_types": [],
        "node_properties": {},
        "relationship_properties": {}
    }

    try:
        labels_query = "CALL db.labels()"
        labels_result = db.execute_query(labels_query)
        schema["node_labels"] = [record.get("label", "") for record in labels_result if record.get("label")]

        rel_types_query = "CALL db.relationshipTypes()"
        rel_types_result = db.execute_query(rel_types_query)
        schema["relationship_types"] = [record.get("relationshipType", "") for record in rel_types_result if record.get("relationshipType")]

        for label in schema["node_labels"][:20]:
            try:
                label_escaped = f"`{label}`" if " " in label else label
                sample_query = f"MATCH (n:{label_escaped}) RETURN n LIMIT 5"
                sample_result = db.execute_query(sample_query)

                properties = set()
                for record in sample_result:
                    node = record.get("n", {})
                    if isinstance(node, dict):
                        for key in node.keys():
                            if key not in ["id", "element_id"]:
                                properties.add(key)

                schema["node_properties"][label] = list(properties)[:20]
            except Exception as e:
                schema["node_properties"][label] = []

        for rel_type in schema["relationship_types"][:20]:
            try:
                rel_type_escaped = f"`{rel_type}`" if " " in rel_type or "_" in rel_type else rel_type
                sample_query = f"MATCH ()-[r:{rel_type_escaped}]->() RETURN r LIMIT 5"
                sample_result = db.execute_query(sample_query)

                properties = set()
                for record in sample_result:
                    rel = record.get("r", {})
                    if isinstance(rel, dict):
                        for key in rel.keys():
                            if key not in ["id", "element_id"]:
                                properties.add(key)

                schema["relationship_properties"][rel_type] = list(properties)[:20]
            except Exception as e:
                schema["relationship_properties"][rel_type] = []

    except Exception as e:
        pass

    return schema

def format_schema_for_prompt(schema: Dict[str, Any]) -> str:
    schema_text = "Neo4j Database Schema:\n\n"

    schema_text += f"Node Labels ({len(schema['node_labels'])}):\n"
    for label in schema["node_labels"][:30]:
        properties = schema["node_properties"].get(label, [])
        schema_text += f"- {label}"
        if properties:
            schema_text += f" (properties: {', '.join(properties[:10])})"
        schema_text += "\n"

    if len(schema["node_labels"]) > 30:
        schema_text += f"... and {len(schema['node_labels']) - 30} more labels\n"

    schema_text += f"\nRelationship Types ({len(schema['relationship_types'])}):\n"
    for rel_type in schema["relationship_types"][:20]:
        properties = schema["relationship_properties"].get(rel_type, [])
        schema_text += f"- {rel_type}"
        if properties:
            schema_text += f" (properties: {', '.join(properties[:10])})"
        schema_text += "\n"

    if len(schema["relationship_types"]) > 20:
        schema_text += f"... and {len(schema['relationship_types']) - 20} more relationship types\n"

    return schema_text

def generate_cypher_query(user_query: str) -> Optional[str]:
    if not Config.GROK_API_KEY:
        raise ValueError("GROK_API_KEY is not configured. Please set it in your .env file.")

    try:
        schema = get_database_schema()
        schema_text = format_schema_for_prompt(schema)

        prompt = f"""You are a Cypher query expert for Neo4j database.

{schema_text}

User Query: {user_query}

Generate a Cypher query that:
1. Answers the user's question based on the database schema above
2. Returns results in the format: {{nodes: [node objects], links: [link objects]}}
3. Uses parameterized queries with $param_name for any user-provided values when appropriate
4. Returns all matching nodes and links (no limits applied)
5. Matches ALL relationship types between nodes (not just specific ones)

Important Rules:
- Node labels with spaces must be wrapped in backticks: `Place Of Performance`
- Property names with spaces must use backticks: node.`Entity Name`
- Use CASE statements to return different properties based on node type
- The query must return a single record with properties: nodes (list), links (list)
- For nodes, use CASE statements to format different node types:
  * Entity nodes: gid, node_type: 'Entity', section, entity_name (from `Entity Name`), entity_acronym, relationship_name, etc.
  * Relationship nodes: gid, node_type: 'Relationship', section, relationship_name (from `Relationship NAME`), etc.
  * Other node types: Include relevant properties based on the schema
- For links, include: gid, from_gid, to_gid, from_name, to_name, relationship_summary, article_title, article_url, relationship_date, relationship_quality, type
- Use CASE statements for from_name and to_name in links to handle different node types

CRITICAL SYNTAX RULES:
- Map property keys (left side of colon) MUST use identifiers WITHOUT spaces
- Use snake_case for property keys: entity_name, article_url, relationship_summary
- NEVER use spaces in property keys: WRONG "Entity Name:", CORRECT "entity_name:"
- Use backticks ONLY when accessing node properties: node.`Entity Name`, node.`Article Title`
- List comprehension syntax: [item IN collection | expression]
- CASE statements in list comprehensions: [node IN nodes | CASE ... END]

Example query structure:
MATCH (n)
WHERE (n:Entity OR n:Relationship OR ...)
  AND n.`Entity Name` CONTAINS $search_term
MATCH (n)-[r]->(m)
WHERE (m:Entity OR m:Relationship OR ...)
WITH COLLECT(DISTINCT n) + COLLECT(DISTINCT m) AS all_nodes_list,
     COLLECT(DISTINCT {{
         rel: r,
         from: n,
         to: m,
         type: type(r)
     }}) AS all_rels
WITH [node IN all_nodes_list WHERE node IS NOT NULL] AS all_nodes,
     [r IN all_rels WHERE r.rel IS NOT NULL] AS filtered_rels
RETURN {{
    nodes: [node IN all_nodes |
        CASE
            WHEN 'Entity' IN labels(node) THEN {{
                gid: node.gid,
                node_type: 'Entity',
                section: node.section,
                entity_name: node.`Entity Name`,
                ...
            }}
            WHEN 'Relationship' IN labels(node) THEN {{
                gid: node.gid,
                node_type: 'Relationship',
                section: node.section,
                relationship_name: node.`Relationship NAME`,
                ...
            }}
            ELSE {{
                gid: node.gid,
                node_type: labels(node)[0],
                section: node.section
            }}
        END
    ],
    links: [r IN filtered_rels | {{
        gid: id(r.rel),
        from_gid: r.from.gid,
        to_gid: r.to.gid,
        from_name: CASE
            WHEN 'Entity' IN labels(r.from) THEN r.from.`Entity Name`
            WHEN 'Relationship' IN labels(r.from) THEN r.from.`Relationship NAME`
            ELSE toString(r.from.gid)
        END,
        to_name: CASE
            WHEN 'Entity' IN labels(r.to) THEN r.to.`Entity Name`
            WHEN 'Relationship' IN labels(r.to) THEN r.to.`Relationship NAME`
            ELSE toString(r.to.gid)
        END,
        relationship_summary: r.rel.`Relationship Summary`,
        article_title: r.rel.`Article Title`,
        article_url: r.rel.`article URL`,
        relationship_date: r.rel.`Relationship Date`,
        relationship_quality: r.rel.`Relationship Quality`,
        type: r.type
    }}]
}} AS graphData

Now generate the Cypher query for the user's query. Return ONLY the Cypher query, no explanations or markdown formatting. Do not include code blocks or backticks."""

        headers = {
            "Authorization": f"Bearer {Config.GROK_API_KEY}",
            "Content-Type": "application/json"
        }

        payload = {
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "model": Config.GROK_MODEL,
            "temperature": 0.1,
            "max_tokens": 2000
        }

        response = requests.post(
            Config.GROK_API_URL,
            headers=headers,
            json=payload,
            timeout=60
        )

        if response.status_code != 200:
            error_text = response.text
            try:
                error_json = response.json()
                error_message = error_json.get("error", {}).get("message", error_text)
            except:
                pass
            raise ValueError(f"GROK API error ({response.status_code}): {error_text[:200]}")

        try:
            result = response.json()
        except Exception as e:
            raise ValueError(f"Invalid response from GROK API: {str(e)}")

        try:
            choices = result.get("choices", [])
            if not choices:
                raise ValueError("GROK API returned no choices in response")

            message = choices[0].get("message", {})
            if not message:
                raise ValueError("GROK API returned no message in response")

            generated_query = message.get("content", "").strip()

            if not generated_query:
                raise ValueError("GROK API returned an empty query")

        except (KeyError, IndexError) as e:
            raise ValueError(f"Unexpected response format from GROK API: {str(e)}")

        if generated_query.startswith("```"):
            lines = generated_query.split("\n")

            lines = lines[1:]

            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            generated_query = "\n".join(lines).strip()

        generated_query = validate_and_fix_cypher_query(generated_query)

        if not generated_query:
            raise ValueError("Generated query is empty after processing")

        return generated_query

    except ValueError as e:
        raise
    except requests.exceptions.RequestException as e:
        error_msg = f"Network error connecting to GROK API: {str(e)}"
        raise ValueError(error_msg)
    except Exception as e:
        error_msg = f"Unexpected error generating Cypher query: {str(e)}"
        raise ValueError(error_msg)

def validate_and_fix_cypher_query(query: str) -> str:
    if not query:
        return query

    def convert_to_snake_case(name: str) -> str:
        return re.sub(r'[\s-]+', '_', name).lower()

    query = re.sub(
        r'^(\s+)([A-Z][a-zA-Z\s-]+?):(\s+)(.+)',
        lambda m: f"{m.group(1)}{convert_to_snake_case(m.group(2))}:{m.group(3)}{m.group(4)}",
        query,
        flags=re.MULTILINE
    )

    property_fixes = {
        r'\bEntity Name:\s*': 'entity_name: ',
        r'\bEntity Acronym:\s*': 'entity_acronym: ',
        r'\bArticle Title:\s*': 'article_title: ',
        r'\barticle URL:\s*': 'article_url: ',
        r'\bRelationship Summary:\s*': 'relationship_summary: ',
        r'\bRelationship Date:\s*': 'relationship_date: ',
        r'\bRelationship Quality:\s*': 'relationship_quality: ',
        r'\bReceiver Name:\s*': 'receiver_name: ',
    }

    for pattern, replacement in property_fixes.items():
        query = re.sub(pattern, replacement, query)

    return query
