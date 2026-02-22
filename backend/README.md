# Backend API Documentation

## Overview

Python FastAPI backend that serves graph data from a Neo4j database. The API provides endpoints that match the structure expected by the frontend application.

## Setup

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your Neo4j credentials:

```bash
cp .env.example .env
```

Edit `.env` with your Neo4j connection details:

```env
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password_here
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

### 3. Run the Backend

#### Option 1: Production Mode (No Auto-Reload)

```bash
python main.py
```

#### Option 2: Development Mode with Auto-Reload

**On Windows:**
```bash
start.bat
```

Or using the Python script:
```bash
python run.py
```

**On Linux/Mac:**
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Or:
```bash
python run.py
```

The API will be available at `http://localhost:8000`

> **Note for Windows users:** Due to multiprocessing issues with neo4j on Windows, we've included a `platform_fix.py` module that resolves reload errors. If you encounter any issues with auto-reload, use `start.bat` or `run.py` which are optimized for Windows.

## API Endpoints

### GET `/api/stories`

Returns all stories with their chapters and substories, matching the structure of `index.json`.

**Response:**
```json
[
  {
    "id": "story_id",
    "title": "Story Title",
    "headline": "Story Headline",
    "brief": "Story description",
    "path": "story_path",
    "chapters": [
      {
        "id": "chapter_id",
        "title": "Chapter Title",
        "headline": "Chapter Headline",
        "brief": "Chapter description",
        "substories": [
          {
            "id": "substory_id",
            "title": "Substory Title",
            "headline": "Substory Headline",
            "brief": "Substory description",
            "graphPath": "path/to/graph"
          }
        ]
      }
    ]
  }
]
```

### GET `/api/graph/{substory_id}`

Returns graph data (nodes and links) for a specific substory.

**Response:**
```json
{
  "nodes": [
    {
      "id": "node_id",
      "name": "Node Name",
      "category": "person",
      "color": "#4263EB",
      "highlight": false
    }
  ],
  "links": [
    {
      "id": "link_id",
      "sourceId": "source_node_id",
      "targetId": "target_node_id",
      "title": "Relationship Title",
      "label": "Relationship Summary",
      "category": "relationship_type"
    }
  ]
}
```

### GET `/api/graph?graph_path=...`

Alternative endpoint to fetch graph data by graph path instead of substory ID.

## Neo4j Schema Requirements

The queries in `queries.py` expect the following Neo4j structure:

### Nodes

- **Story nodes**: Label `:Story` with properties: `id`, `title`, `headline`, `brief`, `path`
- **Chapter nodes**: Label `:Chapter` with properties: `id`, `title`, `headline`, `brief`
- **Substory nodes**: Label `:Substory` with properties: `id`, `title`, `headline`, `brief`, `graphPath`
- **Entity nodes**: Various labels with properties: `id`, `name`, `category`, `color`, `highlight`, etc.

### Relationships

- `Chapter-[:IN_STORY]->Story` (chapter belongs to story)
- `Section-[:IN_CHAPTER]->Chapter` (section belongs to chapter)
- `Chapter-[:HAS_SUBSTORY]->Substory`
- `Substory-[:HAS_NODE|BELONGS_TO|CONTAINS*]->Entity`
- `Entity-[:RELATIONSHIP_TYPE]->Entity` (for links/edges)

**Note:** You may need to adjust the queries in `queries.py` to match your actual Neo4j schema. The current queries are templates that should be customized based on your data model.

## Customizing Queries

Edit `queries.py` to match your Neo4j schema:

1. Adjust node labels (e.g., `:Story`, `:Chapter`, `:Substory`)
2. Adjust relationship types (e.g., `:IN_STORY`, `:IN_CHAPTER`, `:HAS_SUBSTORY`)
3. Modify property names to match your node/relationship properties
4. Update the graph data query to match how nodes and links are connected to substories

## Testing

Test the API endpoints:

```bash
# Get all stories
curl http://localhost:8000/api/stories

# Get graph data by substory ID
curl http://localhost:8000/api/graph/substory1

# Get graph data by path
curl http://localhost:8000/api/graph?graph_path=story1/graph.json
```

## Development

The backend uses:
- **FastAPI** for the web framework
- **Neo4j** Python driver for database access
- **Pydantic** for data validation
- **python-dotenv** for environment variable management

