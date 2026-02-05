# Phase 2 Development Tickets

## Overview
This document breaks down the Phase 2 plan into actionable development tickets organized by category and priority.

---

## Category 1: Infrastructure & Database Migration

### TICKET-001: Migrate to Domain and Admin Sandbox Setup
**Priority:** High  
**Status:** Pending  
**Description:**
- Purchase and configure domain
- Set up admin sandbox environment
- Create admin upload interface for testing graphs
- Implement private testing page for graph visualization
- Framework should be reusable for user submission page

**Acceptance Criteria:**
- Domain configured and accessible
- Admin sandbox environment operational
- Admin can upload and test graphs in private environment
- Private testing page functional with graph visualization

**Dependencies:** None  
**Estimated Effort:** 5 days

---

### TICKET-002: Named Neo4j Database Management
**Priority:** High  
**Status:** Pending  
**Description:**
- Implement system to save graphs to named Neo4j databases
- Create database naming convention (e.g., user_id_section_id)
- Add database creation/deletion endpoints
- Integrate with n8n for orchestration

**Acceptance Criteria:**
- Each saved view creates/uses a named Neo4j database
- Database names follow consistent pattern
- n8n orchestrates database creation
- Admin can manage named databases

**Dependencies:** TICKET-001  
**Estimated Effort:** 3 days

---

### TICKET-003: Postgres Database Migration - Resolution Tables
**Priority:** High  
**Status:** Pending  
**Description:**
- Create alias join table (id->id mapping)
- Create wikidata table (id mapping)
- Create linkedin table (TBD structure)
- Create resolution table for entity resolution
- Migrate existing data to new schema

**Acceptance Criteria:**
- All resolution tables created in Postgres
- Data migration completed successfully
- API endpoints updated to use new tables
- Backward compatibility maintained during transition

**Dependencies:** None  
**Estimated Effort:** 4 days

---

### TICKET-004: Unified Daily Backup System
**Priority:** High  
**Status:** Pending  
**Description:**
- Design and implement unified backup strategy for:
  - All Neo4j databases (main + named user databases)
  - Postgres databases (user data, subscriptions, activities)
- Schedule daily automated backups
- Implement backup retention policy
- Create backup restoration procedures

**Acceptance Criteria:**
- Automated daily backups for all databases
- Backup retention policy defined and implemented
- Restoration procedures documented and tested
- Backup monitoring and alerting in place

**Dependencies:** TICKET-002  
**Estimated Effort:** 5 days

---

## Category 2: Security

### TICKET-005: Postgres SQL Injection Prevention
**Priority:** Critical  
**Status:** Pending  
**Description:**
- Audit all Postgres queries for SQL injection vulnerabilities
- Implement parameterized queries everywhere
- Add input validation and sanitization
- Security testing and penetration testing

**Acceptance Criteria:**
- All queries use parameterized statements
- Input validation on all user inputs
- Security audit passed
- No SQL injection vulnerabilities found

**Dependencies:** None  
**Estimated Effort:** 3 days

---

### TICKET-006: User ID and Hash Security
**Priority:** Critical  
**Status:** Pending  
**Description:**
- Review and strengthen user authentication
- Ensure user IDs are properly hashed/encrypted where needed
- Implement secure session management
- Add password hashing best practices audit

**Acceptance Criteria:**
- User IDs properly secured
- Password hashing follows best practices
- Session management secure
- Security audit completed

**Dependencies:** None  
**Estimated Effort:** 2 days

---

### TICKET-007: Neo4j Injection Prevention
**Priority:** Critical  
**Status:** Pending  
**Description:**
- Audit all Cypher queries for injection vulnerabilities
- Implement parameterized Cypher queries
- Add query validation and sanitization
- Test with malicious inputs

**Acceptance Criteria:**
- All Cypher queries use parameters
- Query validation in place
- No injection vulnerabilities
- Security testing passed

**Dependencies:** None  
**Estimated Effort:** 3 days

---

### TICKET-008: Agent Injection Prevention
**Priority:** High  
**Status:** Pending  
**Description:**
- Review AI/agent query generation for injection risks
- Implement query sanitization before execution
- Add query validation layer
- Limit agent query capabilities

**Acceptance Criteria:**
- Agent-generated queries validated
- Injection prevention in place
- Query capabilities appropriately limited
- Security testing completed

**Dependencies:** TICKET-007  
**Estimated Effort:** 2 days

---

## Category 3: User Features & Subscriptions

### TICKET-009: Paid Subscription Integration
**Priority:** High  
**Status:** Pending  
**Description:**
- Connect payment processing to user subscriptions
- Implement subscription upgrade/downgrade flow
- Add payment webhook handling
- Update subscription status based on payments

**Acceptance Criteria:**
- Payment processing integrated
- Users can upgrade/downgrade subscriptions
- Webhooks properly handled
- Subscription status updates automatically

**Dependencies:** None (subscription service exists)  
**Estimated Effort:** 5 days

---

### TICKET-010: Rate Limiting by Subscription Tier
**Priority:** High  
**Status:** Pending  
**Description:**
- Implement rate limits per subscription tier:
  - Requests per second (to be defined per tier)
  - Monthly request limits per subscription
- Apply to:
  - Ingestion (user submissions)
  - AI graph queries
  - AI question submissions
- Add rate limit tracking and enforcement

**Acceptance Criteria:**
- Rate limits defined per tier
- Limits enforced on all endpoints
- Rate limit tracking accurate
- Users see appropriate error messages when limits exceeded

**Dependencies:** TICKET-009  
**Estimated Effort:** 3 days

---

### TICKET-011: User Activity Tracking Enhancement
**Priority:** Medium  
**Status:** Pending  
**Description:**
- Implement comprehensive user tracking:
  - Page tracking
  - IP address logging
  - Time on page
  - Clicked nodes
  - Click-outs (external links)
- Store tracking data in Postgres
- Create analytics dashboard for tracking data

**Acceptance Criteria:**
- All tracking events captured
- Data stored in Postgres
- Analytics dashboard functional
- Privacy considerations addressed

**Dependencies:** None (activity service exists)  
**Estimated Effort:** 4 days

---

## Category 4: Graph Visualization Features

### TICKET-012: Saved States and XYZ Data
**Priority:** High  
**Status:** Pending  
**Description:**
- Implement ability to save graph views with:
  - XYZ coordinates for node positions
  - Layout style/configuration
  - Scene layout settings
- Each scene loads from sections with specific layout and configuration
- Save/load functionality for graph states

**Acceptance Criteria:**
- Users can save graph views with positions
- Saved views can be loaded and restored
- Layout configurations preserved
- Scene-specific configurations work correctly

**Dependencies:** TICKET-002  
**Estimated Effort:** 5 days

---

### TICKET-013: Node Properties Display Improvements
**Priority:** Medium  
**Status:** Pending  
**Description:**
- Improve node properties display in tooltips/sidebar
- Add more data fields to popup
- Improve spacing and layout
- Make popups more compact when no data available
- Ensure popups stay on screen

**Acceptance Criteria:**
- Node properties display improved
- More data visible in popups
- Better spacing and layout
- Popups remain on screen

**Dependencies:** None  
**Estimated Effort:** 2 days

---

### TICKET-014: Relationship Display Improvements
**Priority:** Medium  
**Status:** Pending  
**Description:**
- Relationships need 2 connections: relational + connected node
- Improve spacing for connected nodes
- Enhance relationship visualization

**Acceptance Criteria:**
- Relationships show both connections
- Better spacing for connected nodes
- Improved relationship visualization

**Dependencies:** None  
**Estimated Effort:** 2 days

---

### TICKET-015: Click to Select Node in Main View
**Priority:** Medium  
**Status:** Pending  
**Description:**
- Ensure nodes are clickable in main graph view
- Clicking node selects it and shows properties
- Improve click detection and selection feedback

**Acceptance Criteria:**
- All nodes clickable
- Selection works reliably
- Visual feedback on selection

**Dependencies:** None  
**Estimated Effort:** 1 day

---

### TICKET-016: Hierarchy Tree Enhancements
**Priority:** High  
**Status:** Pending  
**Description:**
- Add hierarchy tree options:
  - By neighbor count
  - By schema (current)
  - Cluster nodes (needs discussion)
  - Timeline (needs discussion - may not work with current config)
- Ensure nodes remain clickable in hierarchy view
- Connected nodes modify force layout approach

**Acceptance Criteria:**
- Multiple hierarchy options available
- Nodes clickable in all views
- Force layout works with connected nodes
- Timeline solution discussed and implemented if feasible

**Dependencies:** None  
**Estimated Effort:** 5 days

---

### TICKET-017: Zoom and Scale Improvements
**Priority:** Medium  
**Status:** Pending  
**Description:**
- Zoom in/out functionality
- Not locked to fixed scale
- Smooth zoom transitions
- Zoom controls accessible

**Acceptance Criteria:**
- Zoom functionality works smoothly
- Scale not fixed
- Zoom controls intuitive

**Dependencies:** None  
**Estimated Effort:** 2 days

---

### TICKET-018: Basic Graph Functionality
**Priority:** High  
**Status:** Pending  
**Description:**
- Delete node functionality
- Hide/show button for nodes
- Shift+select = box select
- Ctrl+select/Shift+select = deselect
- Save view to Neo4j database (n8n orchestrates)

**Acceptance Criteria:**
- All basic functions working
- Multi-select with modifiers works
- Views save to Neo4j
- n8n integration functional

**Dependencies:** TICKET-002  
**Estimated Effort:** 4 days

---

### TICKET-019: Relational Node Text Processing
**Priority:** Medium  
**Status:** Pending  
**Description:**
- Relational nodes carry "text" which can be:
  - "Text_id" format: pulls paragraph from article_chunk
  - Format: <<1-16>> at beginning of sentence
  - Looks in article_chunk for chunk_num (1), sentence num from "text"
  - If no <<id>>, lists text as-is

**Acceptance Criteria:**
- Text processing works correctly
- Article chunks properly referenced
- Fallback to raw text when no ID

**Dependencies:** None  
**Estimated Effort:** 3 days

---

### TICKET-020: Node Behavior - Right-Click Menu
**Priority:** High  
**Status:** Pending  
**Description:**
- Implement right-click context menu with options:
  - Expand node (expands neighbors connected by relational nodes)
  - Web search (web search, possibly pulls in network graph from results)
  - Graph it (similarity/venn - select secondary node and performs shortest path or similarity search)
- Behavioral difference between relational nodes and static nodes

**Acceptance Criteria:**
- Right-click menu functional
- All menu options work
- Different behavior for relational vs static nodes

**Dependencies:** None  
**Estimated Effort:** 4 days

---

### TICKET-021: Relationship Sentiment and Citation Scores
**Priority:** Medium  
**Status:** Pending  
**Description:**
- Add relationship sentiment score
- Add edge citation score
- Display scores in UI
- Use scores for filtering/sorting

**Acceptance Criteria:**
- Sentiment scores calculated/stored
- Citation scores calculated/stored
- Scores visible in UI
- Filtering/sorting by scores works

**Dependencies:** None  
**Estimated Effort:** 3 days

---

### TICKET-022: Merge Nodes Functionality
**Priority:** Medium  
**Status:** Pending  
**Description:**
- Implement merge nodes feature
- Merge by alias (from Postgres)
- Update all relationships when merging
- Preserve data integrity

**Acceptance Criteria:**
- Nodes can be merged
- Merging uses alias table
- Relationships updated correctly
- Data integrity maintained

**Dependencies:** TICKET-003  
**Estimated Effort:** 4 days

---

## Category 5: Query System & Search

### TICKET-023: Query System Revision with n8n Orchestration
**Priority:** High  
**Status:** Pending  
**Description:**
- Revise query system to orchestrate from n8n
- Dependencies pull from:
  - Neo4j
  - Postgres
  - Vector (Neo4j or vector store)
- Implement unified query interface

**Acceptance Criteria:**
- n8n orchestration working
- All data sources integrated
- Unified query interface functional

**Dependencies:** TICKET-002  
**Estimated Effort:** 5 days

---

### TICKET-024: Enhanced Search Bar
**Priority:** High  
**Status:** Pending  
**Description:**
- Search by name with dropdown options from Postgres + Neo4j
- Brings up all relational data
- Improved search results display

**Acceptance Criteria:**
- Search works across data sources
- Dropdown suggestions functional
- All relational data displayed

**Dependencies:** TICKET-023  
**Estimated Effort:** 3 days

---

### TICKET-025: Venn Diagram Feature
**Priority:** High  
**Status:** Pending  
**Description:**
- Select one or more entities
- Create new graph showing:
  - Similarity
  - Shortest paths (within degree)
  - All connections
  - Other variables

**Acceptance Criteria:**
- Venn diagram feature functional
- All visualization options work
- Graph generation accurate

**Dependencies:** None  
**Estimated Effort:** 5 days

---

## Category 6: User Submission & Visualization

### TICKET-026: User Submission Page with Visualization
**Priority:** High  
**Status:** Pending  
**Description:**
- Create user submission page that:
  - Operates and tags data
  - Gets returned data
  - Creates view (like graphxr)
  - Saves view to user-based database (tagged by user_id and section_id)
- Integrate with existing submission service

**Acceptance Criteria:**
- Submission page functional
- Data properly tagged
- Views created and saved
- User-specific databases used

**Dependencies:** TICKET-002, TICKET-012  
**Estimated Effort:** 6 days

---

## Category 7: Data Model Updates

### TICKET-027: Neo4j Backend Schema Changes
**Priority:** High  
**Status:** Pending  
**Description:**
- Change Neo4j backend structure:
  - Articles connect to chunks
  - Chunks connect to nodes
  - Stories connect to nodes (currently nodes have story property, but too many stories)
- Hide chunks, articles, and stories from visualization
- Update all queries to reflect new structure

**Acceptance Criteria:**
- Schema updated
- All queries updated
- Chunks/articles/stories hidden from visualization
- Data integrity maintained

**Dependencies:** None  
**Estimated Effort:** 4 days

---

## Category 8: UI/UX Redesign

### TICKET-028: General Page Redesigns
**Priority:** Medium  
**Status:** Pending  
**Description:**
- Redesign the following pages (content will be provided):
  - About page
  - Contact page
  - Donate page
  - Front page (new layout)
  - Our investigations
  - Social Media Roundup
  - In the News

**Acceptance Criteria:**
- All pages redesigned
- New content integrated
- Consistent design language
- Responsive design

**Dependencies:** None (waiting on content)  
**Estimated Effort:** 5 days

---

## Category 9: Future Iterations (Lower Priority)

### TICKET-029: Sankey Layout Style
**Priority:** Low  
**Status:** Future  
**Description:**
- Implement Sankey diagram layout style for graph visualization
- Add as layout option

**Acceptance Criteria:**
- Sankey layout available
- Works with graph data
- Performance acceptable

**Dependencies:** None  
**Estimated Effort:** 4 days

---

### TICKET-030: CSV Import with Schema Mapping
**Priority:** Low  
**Status:** Future  
**Description:**
- Implement CSV import functionality
- Schema mapping interface
- Data validation

**Acceptance Criteria:**
- CSV import works
- Schema mapping functional
- Data validated

**Dependencies:** None  
**Estimated Effort:** 5 days

---

### TICKET-031: API Out
**Priority:** Low  
**Status:** Future  
**Description:**
- Create public API for external access
- API documentation
- Authentication/rate limiting

**Acceptance Criteria:**
- Public API functional
- Documentation complete
- Security in place

**Dependencies:** TICKET-010  
**Estimated Effort:** 6 days

---

### TICKET-032: Node Height Scales by Property
**Priority:** Low  
**Status:** Future  
**Description:**
- Implement node height scaling based on node properties
- Configurable property selection
- Smooth scaling transitions

**Acceptance Criteria:**
- Node height scales correctly
- Property selection works
- Smooth transitions

**Dependencies:** None  
**Estimated Effort:** 2 days

---

### TICKET-033: Transformations and Functions
**Priority:** Low  
**Status:** Future  
**Description:**
- Order by XYZ variable
- Transformers (scale, rotate, position handles)
- Functions (sum, product, etc.)

**Acceptance Criteria:**
- Transformations work
- Functions available
- UI intuitive

**Dependencies:** None  
**Estimated Effort:** 5 days

---

### TICKET-034: Timeline Scroll Feature
**Priority:** Low  
**Status:** Future  
**Description:**
- Timeline scroll functionality
- Scrolls by time
- Hide/show nodes over time
- Based on selected data property: date, date_start, date_end

**Acceptance Criteria:**
- Timeline scroll works
- Nodes hide/show correctly
- Time-based filtering functional

**Dependencies:** TICKET-016  
**Estimated Effort:** 4 days

---

## Summary

### Priority Breakdown:
- **Critical (Security):** 4 tickets
- **High Priority:** 15 tickets
- **Medium Priority:** 6 tickets
- **Low Priority (Future):** 6 tickets

### Estimated Total Effort:
- Critical: 10 days
- High: 75 days
- Medium: 19 days
- Low: 26 days
- **Total: ~130 days** (approximately 6 months with 1 developer)

### Recommended Implementation Order:
1. **Phase 2.1 - Security & Infrastructure** (Tickets 001-008, 027): ~30 days
2. **Phase 2.2 - Core Features** (Tickets 009-012, 018, 020, 023-026): ~35 days
3. **Phase 2.3 - Enhancements** (Tickets 013-017, 019, 021-022, 028): ~25 days
4. **Phase 2.4 - Future Iterations** (Tickets 029-034): ~26 days

---

## Notes:
- Some tickets require discussion/clarification (marked in descriptions)
- Content for UI redesigns (TICKET-028) will be provided separately
- Timeline estimates are rough and may vary based on complexity
- Dependencies should be considered when planning sprints
- Security tickets (005-008) should be prioritized and completed early
