# Invisible-Inq - Interactive Graph Visualization Application

An interactive graph visualization web application that allows users to explore relationships between entities in various stories. The application features 3D graph visualization, AI-powered search, and detailed entity information from multiple data sources.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [Development Guidelines](#development-guidelines)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Features

- **Interactive 3D Graph Visualization**: Explore entity relationships using Three.js and ForceGraph3D
- **Multi-Story Support**: Select and filter multiple stories with entity highlighting
- **AI-Powered Search**: Search and summarize graph data using Grok AI integration
- **Entity Wikidata Integration**: Display detailed entity information from Neon PostgreSQL database
- **Responsive Layout**: Collapsible sidebars with detailed node and edge information
- **Calendar & Timeline Views**: Visualize data across time periods
- **Customizable Graph Parameters**: Adjust node size, edge length, force strength, and more
- **Map Visualization**: Geographic visualization of entity relationships
- **Real-time Data Loading**: Dynamic data fetching from Neo4j graph database

## Prerequisites

Before you begin, ensure you have the following installed on your system:

### Required Software

1. **Node.js** (v18.0.0 or higher)
   - Download from [nodejs.org](https://nodejs.org/)
   - Verify installation: `node --version`
   - Verify npm: `npm --version`

2. **Python** (v3.8 or higher, v3.11+ recommended)
   - Download from [python.org](https://www.python.org/downloads/)
   - Verify installation: `python --version` or `python3 --version`
   - Ensure pip is installed: `pip --version` or `pip3 --version`

3. **Neo4j Database** (v5.0 or higher)
   - Download from [neo4j.com](https://neo4j.com/download/)
   - Or use Neo4j Desktop: [neo4j.com/download-center/#desktop](https://neo4j.com/download-center/#desktop)
   - Or use Neo4j Aura (cloud): [neo4j.com/cloud/aura/](https://neo4j.com/cloud/aura/)

4. **Neon PostgreSQL** (Cloud database, optional but recommended)
   - Sign up at [neon.tech](https://neon.tech/)
   - Create a database named `wuhan` (or update the connection string accordingly)
   - Required for entity wikidata features

### Recommended Tools

- **Git**: For version control
- **VS Code** or **PyCharm**: For development
- **Postman** or **curl**: For API testing

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Invisible-Inq
```

### 2. Backend Setup

#### Step 2.1: Navigate to Backend Directory

```bash
cd backend
```

#### Step 2.2: Create Virtual Environment (Recommended)

**On Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**On Linux/Mac:**
```bash
python3 -m venv venv
source venv/bin/activate
```

#### Step 2.3: Install Python Dependencies

```bash
pip install -r requirements.txt
```

This will install:
- FastAPI (web framework)
- Uvicorn (ASGI server)
- Neo4j driver
- psycopg2-binary (PostgreSQL adapter)
- python-dotenv (environment variables)
- pydantic (data validation)
- requests (HTTP library)
- python-multipart (file uploads)

#### Step 2.4: Configure Environment Variables

Copy the example environment file:

```bash
cp env.example .env
```

Edit the `.env` file with your actual configuration values (see [Environment Configuration](#environment-configuration) section below).

### 3. Frontend Setup

#### Step 3.1: Navigate to Project Root

```bash
cd ..  # Return to project root
```

#### Step 3.2: Install Node.js Dependencies

```bash
npm install
```

This will install:
- React 19
- Vite (build tool)
- Three.js (3D graphics)
- D3.js (data visualization)
- react-force-graph (graph visualization)
- Tailwind CSS (styling)
- And other dependencies listed in `package.json`

#### Step 3.3: Create Frontend Environment File (Optional)

If you need to customize the API base URL, create a `.env` file in the project root:

```bash
echo "VITE_API_BASE_URL=http://localhost:8000" > .env
```

## Environment Configuration

### Backend Environment Variables (`backend/.env`)

Create or edit `backend/.env` file with the following variables:

```env
# Neo4j Database Configuration (REQUIRED)
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password_here

# Neon PostgreSQL Configuration (OPTIONAL - for entity wikidata features)
NEON_DATABASE_URL=postgresql://username:password@your-neon-host.neon.tech/wuhan?sslmode=require
# Example format:
# NEON_DATABASE_URL=postgresql://neondb_owner:password@ep-patient-hall-ahkpu77g-pooler.c-3.us-east-1.aws.neon.tech/wuhan?sslmode=require&channel_binding=require

# Backend Configuration
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000

# CORS Configuration (comma-separated list of allowed origins)
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173

# GROK AI Configuration (OPTIONAL - for AI search features)
GROK_API_KEY=your_grok_api_key_here
GROK_API_URL=https://api.x.ai/v1/chat/completions
GROK_MODEL=grok-3
```

### Frontend Environment Variables (`.env` in project root)

Create `.env` in the project root if you need to customize the API URL:

```env
VITE_API_BASE_URL=http://localhost:8000
```

**Note:** In production, set this to your backend server URL (e.g., `http://3.135.248.92:8000`).

## Database Setup

### Neo4j Database Setup

1. **Install Neo4j** (if not using cloud)
   - Download Neo4j Desktop or Neo4j Community Edition
   - Create a new database
   - Note the connection URI, username, and password

2. **Import Your Data**
   - Use Neo4j Browser or Cypher commands to import your graph data
   - Ensure your data follows the expected node and relationship structure

3. **Verify Connection**
   ```bash
   cd backend
   python test_db_connection.py
   ```

### Neon PostgreSQL Setup (Optional)

1. **Create Neon Account**
   - Sign up at [neon.tech](https://neon.tech/)
   - Create a new project
   - Create a database named `wuhan` (or use your preferred name)

2. **Import Entity Wikidata Table**
   - Create the `entity_wikidata` table with the required schema
   - Import your entity wikidata data
   - The table should have columns like: `qid`, `name`, `alias`, `description`, `image_url`, `logo_url`, `wikipedia_url`, etc.

3. **Get Connection String**
   - Copy the connection string from Neon dashboard
   - Add it to `backend/.env` as `NEON_DATABASE_URL`

**Note:** If Neon PostgreSQL is not configured, entity wikidata features will be disabled, but the application will still work with Neo4j data.

## Running the Application

### Development Mode

#### Step 1: Start the Backend Server

**On Windows (Recommended):**
```bash
cd backend
start.bat
```

**On Linux/Mac:**
```bash
cd backend
python run.py
```

**Or manually:**
```bash
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend API will be available at: `http://localhost:8000`

You should see output like:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

**Test the backend:**
```bash
curl http://localhost:8000/health
```

#### Step 2: Start the Frontend Development Server

Open a new terminal window and navigate to the project root:

```bash
npm run dev
```

The frontend will be available at: `http://localhost:3000`

You should see output like:
```
  VITE v6.5.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

#### Step 3: Access the Application

Open your browser and navigate to:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs (Swagger UI)

### Production Mode

#### Build Frontend

```bash
npm run build
```

This creates a `dist/` directory with the production build.

#### Preview Production Build

```bash
npm run preview
```

#### Run Backend in Production

```bash
cd backend
python main.py
```

Or with uvicorn:
```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

## Project Structure

```
Invisible-Inq/
├── backend/                    # Python FastAPI backend
│   ├── __pycache__/           # Python cache files
│   ├── venv/                   # Python virtual environment (gitignored)
│   ├── main.py                 # FastAPI application entry point
│   ├── config.py               # Configuration management
│   ├── database.py             # Neo4j database connection
│   ├── neon_database.py        # Neon PostgreSQL connection
│   ├── services.py             # Business logic and data processing
│   ├── models.py               # Pydantic models
│   ├── queries.py              # Neo4j Cypher queries
│   ├── ai_service.py           # AI service integration
│   ├── platform_fix.py         # Windows multiprocessing fix
│   ├── run.py                  # Development server runner
│   ├── start.bat               # Windows startup script
│   ├── requirements.txt        # Python dependencies
│   ├── env.example             # Environment variables example
│   └── .env                    # Environment variables (create from env.example)
│
├── src/                        # React frontend source code
│   ├── components/             # React components
│   │   ├── common/             # Common/shared components
│   │   │   ├── AISummaryModal.jsx
│   │   │   ├── NodeTooltipEnhanced.jsx
│   │   │   ├── ConnectedData.jsx
│   │   │   ├── NeighborsGraph.jsx
│   │   │   └── ...
│   │   ├── graph/              # Graph visualization components
│   │   │   ├── ThreeGraphVisualization.jsx
│   │   │   └── GraphControls.jsx
│   │   ├── layout/             # Layout components
│   │   │   ├── Header.jsx
│   │   │   ├── LeftSidebar.jsx
│   │   │   └── RightSidebar.jsx
│   │   └── story/              # Story-related components
│   │       ├── Story.jsx
│   │       └── ...
│   ├── pages/                  # Page components
│   │   ├── HomePage.jsx
│   │   ├── GraphPage.jsx
│   │   └── ...
│   ├── hooks/                  # Custom React hooks
│   │   └── useGraphData.jsx
│   ├── utils/                  # Utility functions
│   │   ├── colorUtils.js
│   │   ├── dataUtils.js
│   │   └── urlUtils.js
│   ├── contexts/               # React contexts
│   │   └── ToastContext.jsx
│   ├── App.jsx                 # Main App component
│   ├── main.jsx                # Application entry point
│   └── index.css               # Global styles
│
├── public/                     # Static assets
│   ├── data/                   # Data files (JSON, ZIP)
│   └── images/                 # Images (logos, icons)
│
├── dist/                       # Production build output (generated)
│
├── scripts/                    # Build and utility scripts
│   ├── generateStoryMap.cjs
│   └── normalizeUsaidWuhanGraphs.cjs
│
├── package.json                # Node.js dependencies and scripts
├── vite.config.js              # Vite configuration
├── tailwind.config.js          # Tailwind CSS configuration
├── eslint.config.js            # ESLint configuration
├── .env                        # Frontend environment variables (optional)
└── README.md                   # This file
```

## API Endpoints

### Health Check

- **GET** `/health` - Check API and database health

### Stories

- **GET** `/api/stories` - Get all stories with chapters and substories

### Graph Data

- **GET** `/api/graph/{substory_id}` - Get graph data for a specific substory
- **GET** `/api/graph?graph_path=...` - Get graph data by path
- **GET** `/api/graph/section?section_query=...&country=...` - Get graph data filtered by section and country

### Calendar & Timeline

- **GET** `/api/calendar?section_query=...&country=...` - Get calendar/timeline data

### Clustering

- **GET** `/api/cluster?method=...&property=...` - Get clustered graph data

### AI Services

- **GET** `/api/ai/search?query=...` - AI-powered search
- **POST** `/api/ai/summary` - Generate AI summary of graph data

### Entity Wikidata

- **GET** `/api/entity/wikidata/{entity_name}` - Get detailed entity information from Wikidata

### Statistics

- **GET** `/api/stats` - Get story statistics
- **GET** `/api/node-types` - Get all node types in the database

### Interactive API Documentation

- **GET** `/docs` - Swagger UI documentation
- **GET** `/redoc` - ReDoc documentation

## Development Guidelines

### Code Style

- **Python**: Follow PEP 8 style guide
- **JavaScript/React**: Follow ESLint rules configured in `eslint.config.js`
- Use meaningful variable and function names
- Add comments for complex logic

### Git Workflow

1. Create a feature branch: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Commit with descriptive messages: `git commit -m "Add: description of changes"`
4. Push to remote: `git push origin feature/your-feature-name`
5. Create a pull request

### Adding New Features

1. **Backend:**
   - Add new endpoints in `backend/main.py`
   - Add business logic in `backend/services.py`
   - Add data models in `backend/models.py`
   - Update API documentation

2. **Frontend:**
   - Create components in appropriate directories
   - Update routing in `src/App.jsx` if needed
   - Add styles using Tailwind CSS classes
   - Test components in isolation

### Testing

- Test backend endpoints using `/docs` (Swagger UI)
- Test frontend components in browser
- Verify database connections before deployment

### Windows-Specific Notes

- The project includes `platform_fix.py` to resolve multiprocessing issues with Neo4j on Windows
- Use `start.bat` or `run.py` for development instead of direct uvicorn commands
- If you encounter reload errors, disable auto-reload: `python main.py`

## Troubleshooting

### Common Issues

#### 1. Backend Won't Start

**Error:** `Configuration validation failed: NEO4J_PASSWORD environment variable is required`

**Solution:**
- Ensure `backend/.env` file exists and contains `NEO4J_PASSWORD`
- Verify the file is in the `backend/` directory, not the project root

**Error:** `Port 8000 is already in use`

**Solution:**
- Stop the existing server: `Ctrl+C` in the terminal running the server
- Or change `BACKEND_PORT` in `backend/.env` to a different port (e.g., 8001)
- On Windows, find and kill the process: `netstat -ano | findstr :8000`

#### 2. Frontend Won't Start

**Error:** `Port 3000 is already in use`

**Solution:**
- Vite will automatically try the next available port
- Or manually set port in `vite.config.js`

**Error:** `Cannot find module` errors

**Solution:**
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again

#### 3. Database Connection Issues

**Error:** `Failed to connect to Neo4j`

**Solution:**
- Verify Neo4j is running: Open Neo4j Browser at `http://localhost:7474`
- Check `NEO4J_URI`, `NEO4J_USER`, and `NEO4J_PASSWORD` in `backend/.env`
- For remote Neo4j, ensure the URI includes the correct host and port
- Check firewall settings if connecting to remote database

**Error:** `NEON_DATABASE_URL not configured`

**Solution:**
- This is a warning, not an error. Entity wikidata features will be disabled
- If you need entity wikidata, configure `NEON_DATABASE_URL` in `backend/.env`

#### 4. CORS Errors

**Error:** `Access to fetch at '...' has been blocked by CORS policy`

**Solution:**
- Add your frontend URL to `CORS_ORIGINS` in `backend/.env`
- Format: `CORS_ORIGINS=http://localhost:3000,http://your-frontend-url:port`
- Restart the backend server after changing `.env`

#### 5. Image Loading Issues

**Error:** Images not displaying in tooltip or sidebar

**Solution:**
- Check browser console for CORS or 404 errors
- Verify image URLs are accessible
- For Wikimedia Commons images, the app should automatically convert URLs
- Check network tab for failed image requests

#### 6. AI Features Not Working

**Error:** `GROK_API_KEY` not configured

**Solution:**
- AI search features require a valid Grok API key
- Add `GROK_API_KEY` to `backend/.env`
- Get API key from [x.ai](https://x.ai/)

#### 7. Windows Multiprocessing Errors

**Error:** Platform detection errors on Windows with auto-reload

**Solution:**
- Use `start.bat` or `run.py` instead of direct uvicorn commands
- The project includes `platform_fix.py` to handle this automatically
- If issues persist, run without reload: `python main.py`

#### 8. Build Errors

**Error:** Frontend build fails

**Solution:**
- Clear build cache: Delete `dist/` and `node_modules/.vite/`
- Check for syntax errors in console
- Ensure all dependencies are installed: `npm install`
- Check Node.js version compatibility

### Getting Help

1. Check the logs:
   - Backend: Check terminal output or `backend/uvicorn.log`
   - Frontend: Check browser console (F12)

2. Verify configuration:
   - Ensure all environment variables are set correctly
   - Check file paths and permissions

3. Test components independently:
   - Backend: Use `/docs` to test API endpoints
   - Frontend: Check browser console for JavaScript errors

4. Database verification:
   - Test Neo4j connection: `python backend/test_db_connection.py`
   - Test Neon connection: Check `backend/.env` configuration

## License

[Add your license information here]

---

## Additional Resources

- [Neo4j Documentation](https://neo4j.com/docs/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [Three.js Documentation](https://threejs.org/docs/)
- [Vite Documentation](https://vitejs.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)

---

**Happy Coding! 🚀**
