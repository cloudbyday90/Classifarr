# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.36.3-alpha] - 2026-01-07

### Fixed
- **CI/CD Pipeline:** Fixed 77+ consecutive test failures in `mediaServer.test.js`
- **Test Mocks:** Updated test mocks to match cascading delete query sequence from v0.36.1 and v0.36.2
- All 376 tests now passing

## [0.36.2-alpha] - 2026-01-07

### Fixed
- **OMDb Log Spam:** Limit warning now logs once per session, skips API calls when limit hit
- **Task Queue Cleanup:** Pending tasks cleared on library re-sync to prevent failures
- **Enrichment Retry Queue:** Cleared before media_server_items to prevent FK constraint violations

## [0.36.1-alpha] - 2026-01-07

### Fixed
- **Library Sync:** Fixed unique constraint violation when syncing libraries after media server database rebuild
- Sync now properly clears all related tables before inserting fresh library records

## [0.36.0-alpha] - 2026-01-04

### 🚀 Major: Pattern-Driven Classification & Settings Reorganization

This release activates pattern-based classification, introduces hybrid pattern management UI, reorganizes the Settings experience, and adds cost controls for API users.

### Added

#### Pattern-Based Classification
- **Pattern Signal Collection:** Use discovered patterns (studio, franchise, genre, certification) as first-pass classification signals
- **Reinforcement Learning:** Patterns learn from user corrections, auto-adjust confidence (+5% correct, -5% incorrect)
- **Conflict Resolution:** Auto-resolve conflicting patterns (highest confidence wins), with manual override option
- **AI Cost Optimization:** High-confidence patterns (≥90%) skip AI calls entirely, saving 60-85% on API costs

#### Hybrid Pattern Management UI
- **Per-Library Patterns:** "Learned Patterns" section added to each library detail page
  - Shows only patterns routing TO that specific library
  - Approve/Reject/Details actions inline
  - "Discover Patterns for This Library" button
  - Link to global patterns page
- **Global Patterns Page:** Moved to top-level navigation (out of Settings)
  - Full patterns table with all columns
  - Target Library filter as primary filter
  - Conflict detection and resolution section
  - Bulk actions (approve/reject/delete selected)
  - System-wide discovery and stats

#### Settings Sidebar Reorganization
- **GENERAL:** General, Scheduler, Queue
- **CONNECTIONS:** Media Server, Radarr, Sonarr
- **METADATA:** TMDB, OMDb, Tavily
- **CLASSIFICATION:** AI, Confidence, Rules
- **NOTIFICATIONS:** Discord, Webhooks
- **SYSTEM:** Backup, SSL/HTTPS, Logs

#### AI Settings Page Restructure
- **🤖 AI Provider:** Classification provider, model, API key, embedding config (always shown)
- **🔍 Semantic Search (RAG):** Enable toggle, similarity threshold, min history count (always shown)
- **🧩 Pattern-Based Classification:** Enable, priority, auto-discovery, "Manage Patterns" link (always shown)
- **💰 API Cost Management:** Skip threshold, budget alert, cost stats (API providers only)

#### New API Endpoints
- `GET /api/patterns/library/:libraryId` - Get patterns for specific library
- `POST /api/patterns/discover/:libraryId` - Discover patterns for specific library
- `GET /api/patterns/cost-summary` - Monthly cost and savings statistics

### Changed
- Confidence settings moved from GENERAL to CLASSIFICATION section
- Tavily moved from AI & DATA to METADATA section (metadata enrichment)
- "Patterns" removed from Settings sidebar (now top-level nav only)
- AI settings page reorganized into 4 logical sections
- API cost controls only shown for API-based providers (OpenAI, Anthropic, etc.)

### Fixed
- Duplicate "Patterns" navigation (was in both Settings and top-level)
- AI Skip Threshold was in wrong section (moved to API Cost Management)

## [0.35.0-alpha] - 2026-01-03

### 🚀 Major: Pattern Discovery Engine

Introduces automated pattern detection from classification history—identifying studios, franchises, genres, and certifications that consistently route to specific libraries.

### Added

#### Pattern Types
- **Studio Patterns:** "All Pixar Animation Studios → Kids Movies"
- **Franchise Patterns:** "All Marvel Cinematic Universe → Superhero Movies"
- **Genre Patterns:** "All Animation + Family → Kids Movies"
- **Certification Patterns:** "All G-rated → Kids Movies"

#### Pattern Discovery UI
- **Patterns Page:** New top-level navigation item
  - Discovered patterns table with type, value, target library, confidence, status
  - Confidence shown as percentage with color coding (green ≥80%, yellow ≥60%, red <60%)
  - Status badges: Pending (yellow), Approved (green), Rejected (red)
  - Pattern actions: Approve, Reject, Delete
  - Filters: Type, Status, Target Library
  - "Discover Patterns" button to run discovery manually

#### Discovery Engine
- Analyzes classification history for routing patterns
- Minimum 3 occurrences required for pattern detection
- Calculates confidence based on consistency (matches / total occurrences)
- Deduplication: Won't create pattern if identical one exists

#### Database Schema
- New `patterns` table: id, type, value, targetLibraryId, confidence, status, occurrences, timestamps
- Indexes on type, status, targetLibraryId for efficient querying

#### API Endpoints
- `GET /api/patterns` - List all patterns (with filters)
- `POST /api/patterns/discover` - Run pattern discovery
- `PATCH /api/patterns/:id/approve` - Approve a pattern
- `PATCH /api/patterns/:id/reject` - Reject a pattern
- `DELETE /api/patterns/:id` - Delete a pattern

### Technical Notes
- Patterns are discovered but NOT yet used for classification (next release)
- Discovery runs on-demand only (no automatic scheduling yet)
- Studio/franchise data requires TMDB metadata to be populated

## [0.34.0-alpha] - 2026-01-02

### 🚀 Major: Manual Classification Overrides & Confidence Threshold Controls

Adds the ability for users to manually override AI classifications and control confidence thresholds for auto-processing.

### Added

#### Manual Override System
- **Override Modal:** Click any media item to open override dialog
  - Current classification shown with confidence
  - Dropdown to select different target library
  - "Override Reason" text field (optional)
  - Override badge shown on items that were manually overridden
- **Override History:** Track who overrode what and when
  - Stored in classification_history with `isOverride: true`
  - Original AI suggestion preserved for comparison

#### Confidence Threshold Settings
- **Settings → General → Confidence Thresholds**
  - Auto-Accept Threshold (default: 85%): Items above this are auto-processed
  - Review Threshold (default: 60%): Items between review and auto-accept need manual review
  - Items below review threshold are flagged as "Low Confidence"
- **Queue Integration:**
  - High confidence items: Green checkmark, auto-process enabled
  - Medium confidence items: Yellow warning, manual review suggested
  - Low confidence items: Red flag, manual classification required

#### Queue Improvements
- Confidence column with color-coded badges
- "Needs Review" filter to show only medium/low confidence items
- Bulk actions respect confidence thresholds

### Changed
- Classification results now include `requiresReview` boolean
- Queue default sort changed to confidence ascending (lowest first)

### Fixed
- Queue pagination resetting when applying filters

## [0.33.0-alpha] - 2025-12-28

### 🚀 Major: AI-Powered Classification with RAG

Introduces the core AI classification engine using Retrieval-Augmented Generation (RAG) for intelligent media categorization.

### Added

#### AI Classification Engine
- **Provider Support:** OpenAI (GPT-4, GPT-3.5), Anthropic (Claude), Ollama (local models)
- **RAG Pipeline:**
  1. Embed media metadata (title, overview, genres, cast, crew)
  2. Retrieve similar previously-classified items from vector store
  3. Generate classification with context from similar items
  4. Return target library with confidence score

#### Vector Store Integration
- **ChromaDB** for vector storage (runs as sidecar container)
- Automatic embedding of classification history
- Similarity search for RAG context retrieval
- Configurable similarity threshold (default: 0.7)

#### Classification History
- Track all classifications with metadata
- Store: mediaId, mediaType, title, targetLibrary, confidence, aiProvider, timestamp
- Used for RAG context and pattern discovery (future)

#### Settings Pages
- **Settings → AI & Data → AI Settings**
  - Provider selection (OpenAI, Anthropic, Ollama)
  - Model selection per provider
  - API key input (encrypted storage)
  - Test connection button
- **Settings → AI & Data → Classification**
  - Enable/disable AI classification
  - RAG enable/disable toggle
  - Similarity threshold slider
  - Minimum history count for RAG (default: 10)

#### API Endpoints
- `POST /api/classify` - Classify single media item
- `POST /api/classify/bulk` - Classify multiple items
- `GET /api/classification-history` - Get classification history
- `POST /api/embeddings/rebuild` - Rebuild vector store

### Technical Notes
- Ollama requires separate installation and model pull
- ChromaDB data persisted in Docker volume
- API keys encrypted at rest using AES-256

## [0.32.0-alpha] - 2025-12-20

### Added
- Media server connection (Plex, Jellyfin, Emby)
- Library discovery and mapping
- Radarr/Sonarr integration for *arr users
- Basic queue system for pending classifications

### Changed
- Complete UI redesign with new navigation structure
- Settings reorganized into logical sections

### Fixed
- Docker compose health checks timing out

## [0.31.0-alpha] - 2025-12-15

### Added
- Initial project structure
- Docker containerization
- Basic Express API server
- React frontend with Vite
- SQLite database with Drizzle ORM
- Authentication system (local users)

---

[0.36.2-alpha]: https://github.com/cloudbyday90/Classifarr/compare/v0.36.1-alpha...v0.36.2-alpha
[0.36.1-alpha]: https://github.com/cloudbyday90/Classifarr/compare/v0.36.0-alpha...v0.36.1-alpha
[0.36.0-alpha]: https://github.com/cloudbyday90/Classifarr/compare/v0.35.0-alpha...v0.36.0-alpha
[0.35.0-alpha]: https://github.com/cloudbyday90/Classifarr/compare/v0.34.0-alpha...v0.35.0-alpha
[0.34.0-alpha]: https://github.com/cloudbyday90/Classifarr/compare/v0.33.0-alpha...v0.34.0-alpha
[0.33.0-alpha]: https://github.com/cloudbyday90/Classifarr/compare/v0.32.0-alpha...v0.33.0-alpha
[0.32.0-alpha]: https://github.com/cloudbyday90/Classifarr/compare/v0.31.0-alpha...v0.32.0-alpha
[0.31.0-alpha]: https://github.com/cloudbyday90/Classifarr/releases/tag/v0.31.0-alpha
