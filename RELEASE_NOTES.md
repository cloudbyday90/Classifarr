## v0.36.3-alpha
**Title: Hotfix - CI/CD Pipeline Test Failures & FK Constraint Violation**

### Fixes
- **Test Mock Sequence Fix:** Fixed failing tests in `mediaServer.test.js` that were causing 77+ consecutive CI/CD pipeline failures
  - Root cause: Test mocks didn't account for cascading delete queries added in v0.36.1 and v0.36.2
  - Updated test mocks to include all 11 cascading delete operations for FK constraint handling
  - Tests `should DELETE existing libraries before inserting new ones` and `should handle sync after Plex database rebuild` now pass
- **Classification History FK Constraint:** Fixed FK constraint violation when inserting into `classification_history` after library deletion
  - Error: `insert or update on table "classification_history" violates foreign key constraint "classification_history_library_id_fkey"`
  - Root cause: Queue tasks attempted to insert with library_id that was deleted during sync
  - Solution: Verify library exists before inserting into classification_history, skip insert if library was deleted
  - Added regression test to prevent reintroduction of this bug
- **All Tests Passing:** 377 tests in the test suite now passing (added 1 new regression test)

---

## v0.36.2-alpha
**Title: Hotfix - OMDb Log Spam & Task Queue Cleanup**

### Fixes
- **OMDb Log Spam Fix:** OMDb daily limit warning now only logs once per session instead of on every queue task (was causing 26k+ duplicate error entries)
- **Skip OMDb Calls When Limit Hit:** Once OMDb limit is reached, API calls are skipped entirely until service restart
- **Task Queue Cleanup:** Pending/processing tasks are now cleared when libraries are re-synced, preventing failed task errors from old library IDs
- **Enrichment Retry Queue Fix:** `enrichment_retry_queue` is now cleared before `media_server_items` to prevent foreign key constraint violations

---

## v0.36.1-alpha
**Title: Hotfix - Library Sync After Media Server Rebuild**

### Fixes
- **Library Sync Fix:** Fixed "duplicate key value violates unique constraint" error when syncing libraries after a Plex/Emby/Jellyfin database rebuild
  - Root cause: When media server database is rebuilt, library external IDs change while names stay the same
  - Solution: Sync now clears existing libraries and related data before inserting fresh records
  - Affected tables cleaned: `media_server_sync_status`, `media_server_items`, `media_server_collections`, `library_labels`, `library_pattern_suggestions`, `scheduled_tasks`

> [!IMPORTANT]
> After syncing libraries following a media server rebuild, you will need to **re-map your libraries** to Radarr/Sonarr. This is expected since the old library IDs are no longer valid.

---


**Title: Pattern-Driven Classification - Reinforcement Learning & Management UI**

> [!IMPORTANT]  
> **Opt-In Feature:** Pattern-based classification is **disabled by default**. Enable in Settings → AI & Data → Patterns.
> 
> **No Breaking Changes:** All existing workflows remain unchanged. Patterns can be enabled/disabled without affecting current classification behavior.

### 🚀 Major Features

#### Pattern-Based Signal Collection
Classifarr now uses discovered patterns (from v0.35.0) as the **primary classification signal**:

**How it works:**
1. Patterns are collected from your classification history (studio, franchise, genre, certification)
2. Each pattern has a confidence score based on historical accuracy
3. High-confidence patterns (≥90%) are used for instant classification without AI calls
4. Medium-confidence patterns (70-89%) are validated by AI
5. Low-confidence patterns trigger standard AI classification

**Pattern Types:**
- **Studio Patterns:** "Warner Bros" → Movies library (85% confidence)
- **Franchise Patterns:** "Marvel Cinematic Universe" → Action library (92% confidence)
- **Genre Patterns:** "Action,Sci-Fi" → Movies library (78% confidence)
- **Certification Patterns:** "PG-13" → Family library (88% confidence)

#### Reinforcement Learning
Patterns automatically learn from user corrections and adjust their confidence:

**Confidence Adjustment:**
- **Correct prediction:** +5% confidence boost (capped at 95%)
- **Incorrect prediction:** -5% confidence decay
- **Auto-deprecation:** Patterns below 30% confidence are automatically marked as "decayed"

**Conflict Resolution:**
- When multiple patterns suggest different libraries for the same criteria, the system keeps the highest-confidence pattern
- Conflicts can be resolved manually or automatically via the UI

**Example Evolution:**
```
Day 1:  Studio "Warner Bros" → Movies (70% confidence, 5 samples)
Day 30: Studio "Warner Bros" → Movies (85% confidence, 20 correct predictions)
Day 60: Studio "Warner Bros" → Movies (90% confidence, 40 correct, 2 incorrect)
```

#### Pattern Management UI
New comprehensive UI in **Settings → AI & Data → Patterns**:

**Dashboard Features:**
- Summary statistics (total patterns, approved, suggested, conflicts, avg confidence)
- Pattern list table with:
  - Filter by status (discovered, approved, rejected, decayed)
  - Filter by type (studio, franchise, genre, certification)
  - Filter by minimum confidence
  - Search by pattern value
- Pattern approval/rejection/deletion
- Conflict resolution (one-click to resolve all conflicts)
- Manual pattern discovery trigger

**Pattern Detail Modal:**
- Pattern information (type, library, confidence, match count)
- Accuracy statistics:
  - Total uses
  - Correct predictions
  - Incorrect predictions
  - Accuracy percentage
- Recent match history (last 20 classifications)

**Cost Dashboard:**
- Track AI calls avoided due to high-confidence patterns
- View estimated monthly cost savings
- Monitor pattern effectiveness

### 💰 Cost Optimization

**AI API Call Reduction:**
- High-confidence patterns (≥90%) skip AI calls entirely
- Expected **60-85% reduction** in monthly AI costs for established users
- Pattern discovery is pure data analysis (zero AI cost)
- Only uncertain cases require AI validation

**Configurable Thresholds:**
- AI skip threshold (default: 90%, configurable 0-100%)
- Pattern vs rule priority (default: rules first)
- Enable/disable pattern system entirely

### 🔧 Technical Improvements

**Backend Services:**
- `patternSignalCollector.js` - Collects and ranks pattern signals by confidence
- `patternReinforcementService.js` - Implements reinforcement learning and conflict resolution
- Signal integration - Patterns prioritized early in classification flow
- Classification hooks - Automatic reinforcement on accept/correction

**API Routes:**
- `GET /api/patterns` - List patterns with filtering and pagination
- `GET /api/patterns/:id` - Get pattern details with accuracy stats
- `PUT /api/patterns/:id/approve` - Approve pattern
- `PUT /api/patterns/:id/reject` - Reject pattern
- `DELETE /api/patterns/:id` - Delete pattern
- `POST /api/patterns/resolve-conflicts` - Auto-resolve conflicts
- `POST /api/patterns/discover` - Manual pattern discovery
- `GET /api/patterns/summary` - Statistics summary
- `GET /api/patterns/config` - Get configuration
- `PUT /api/patterns/config` - Update configuration

**Performance Optimizations:**
- Fixed N+1 query problem in studio and franchise pattern collection
- Batch database queries using PostgreSQL's ANY() operator
- O(1) pattern lookups using Map data structures
- Optimized signal collection with early returns

**Input Validation:**
- All route parameters validated (ID, pagination, confidence ranges)
- Pattern configuration validated (priority must be 'rules_first' or 'patterns_first')
- AI skip threshold validated (0-100%)
- Pagination limits enforced (max 100 per page)

**Error Handling:**
- Pattern reinforcement errors now logged for debugging
- Graceful fallback when patterns disabled or unavailable
- Non-blocking async pattern updates

### 📊 Database Changes

**Migration 040:**
- `ai_provider_config.pattern_mining_enabled` (BOOLEAN, default false)
- `ai_provider_config.pattern_rule_priority` (VARCHAR, default 'rules_first')
- `ai_provider_config.pattern_ai_skip_threshold` (INTEGER, default 90)
- `ai_provider_config.pattern_notification_dismissed` (BOOLEAN, default false)
- `pattern_match_log.was_correct` (BOOLEAN) - For accuracy tracking

### 🧪 Testing

**Test Coverage:**
- 26 unit tests for pattern services
- Integration tests for signal collection
- Edge case coverage (disabled patterns, conflicts, validation)
- All 365 server tests passing
- All 3 client tests passing
- CodeQL security scan: 0 vulnerabilities

### 🎯 Migration Guide

**For Existing Users:**
1. Upgrade to v0.36.0-alpha
2. Pattern discovery runs automatically in background (if history exists)
3. Optional: Enable pattern-based classification in Settings → AI & Data → Patterns
4. Optional: Review and approve discovered patterns
5. Optional: Adjust AI skip threshold and rule/pattern priority

**Backward Compatibility:**
- ✅ Pattern system is opt-in (disabled by default)
- ✅ No changes to existing classification behavior
- ✅ All custom rules remain functional
- ✅ Patterns can be disabled without data loss
- ✅ Zero breaking changes

### 📝 Configuration Example

```sql
-- Enable pattern-based classification
UPDATE ai_provider_config 
SET pattern_mining_enabled = true,
    pattern_rule_priority = 'patterns_first',  -- Patterns take precedence
    pattern_ai_skip_threshold = 85             -- Skip AI at 85%+ confidence
WHERE id = 1;
```

### 🔍 How to Use

1. **Enable Pattern Mining:**
   - Go to Settings → AI & Data → Patterns
   - Toggle "Enable Pattern-Based Classification"

2. **Discover Patterns:**
   - Click "Discover New Patterns" (or wait for automatic discovery)
   - Review suggested patterns in the table

3. **Manage Patterns:**
   - Approve high-quality patterns
   - Reject incorrect patterns
   - Delete obsolete patterns
   - Resolve conflicts with one click

4. **Monitor Performance:**
   - View accuracy statistics in pattern details
   - Track AI calls avoided in cost dashboard
   - Adjust confidence thresholds as needed

### 🐛 Fixes
- Fixed Vue component import paths (build failure resolved)
- Fixed N+1 query problem in pattern signal collection
- Fixed route ordering to prevent routing conflicts
- Added missing error logging for pattern reinforcement

---

## v0.35.1-alpha
**Title: Hotfix - Build Fix**

### Fixes
- **Build Fix:** Fixed corrupted HTML tags in Sidebar.vue that caused Vite build to fail
- **Cleanup:** Removed duplicate files with malformed names (`RELEASE_NOTES. md`, `server/package. json`)

---

## v0.35.0-alpha
**Title: RAG Enhancements - RRF Hybrid Search, Rich Embeddings v2, Pattern Mining**

### 🚀 Major Features

#### Reciprocal Rank Fusion (RRF) Hybrid Search
The RAG hybrid search now uses **Reciprocal Rank Fusion (RRF)**, an industry-standard algorithm for combining semantic and full-text search results. RRF provides better fusion than the previous weighted average approach by:
- Giving higher scores to items that appear in both result sets
- Using rank-based scoring rather than raw similarity scores
- Providing more robust handling of score scale differences

**How it works:**
```
RRF Score = Σ 1/(k + rank + 1) across all sources
```
where k=60 is the smoothing constant (configurable via `rag_rrf_k` database field).

**Rollback available:** Set `rag_fusion_method = 'legacy'` in `ai_provider_config` table to use the previous 70/30 weighted approach.

#### Rich Embeddings v2
Embeddings now include significantly more metadata for better semantic matching:

**v1 Format:**
```
Title (Year) [Type] Genres: X, Y Keywords: A, B Overview...
```

**v2 Format:**
```
Title: X | Year: Y | Type: Movie | Genres: A, B | Rating: PG-13 | 
Language: en | Studio: Warner Bros, Marvel | Franchise: MCU |
Cast: Actor1, Actor2, Actor3 | Keywords: hero, action | 
Score: 8.4/10 | Classified: Movies | Synopsis: ...
```

**New fields:**
- **Studio:** Top 3 production companies
- **Franchise:** Collection/series information
- **Cast:** Top 3 cast members
- **Rating:** Content certification (PG-13, TV-MA, etc.)
- **Score:** Vote average formatted as X.X/10
- **Language:** Original language code

**Migration:** Existing embeddings are automatically detected as stale and re-generated in the background at ~120 items/hour. Monitor progress via `GET /api/rag/migration/status`.

#### Pattern Mining (Opt-In)
Classifarr can now automatically discover classification patterns from your history:

**Pattern Types:**
- **Studio Patterns:** "Warner Bros movies → Action Movies library" (70%+ confidence, 3+ examples)
- **Franchise Patterns:** "Marvel Cinematic Universe → Superhero library" (80%+ confidence, 2+ examples)
- **Genre Patterns:** "Anime genre → Anime library" (60%+ confidence, 5+ examples)
- **Certification Patterns:** "TV-MA rating → Adult Animation library" (65%+ confidence, 5+ examples)

**Workflow:**
1. Patterns are discovered automatically from classification history
2. High-confidence patterns (≥85%) are auto-approved
3. Review and approve/reject patterns via new API endpoints
4. Stale patterns (not seen in 90 days) are automatically decayed

**Enable pattern mining:** Set `pattern_mining_enabled = true` in `ai_provider_config` table, then call `POST /api/rag/patterns/discover`.

### 📊 Enhanced Observability

#### RAG Error Categorization
Errors are now automatically categorized into 12 types:
- `quota_exceeded` - API rate limits hit
- `timeout` - Request timeouts
- `dimension_mismatch` - Vector dimension incompatibility
- `invalid_vector` - NaN/Infinity in embeddings
- `database_error` - PostgreSQL errors
- `provider_error` - Ollama/OpenAI/Gemini failures
- `configuration_error` - Missing/invalid settings
- And 5 more...

Each error includes:
- RAG operation context (semantic_search, hybrid_search, etc.)
- Duration in milliseconds
- Recoverable flag for retry logic
- Full stack trace

#### Health Dashboard
New endpoint `GET /api/rag/health` provides:
- Operations count (24h and 1h windows)
- Success/failure rates
- Average duration
- Breakdown by operation type
- Recent errors list

#### Metrics Tracking
All RAG operations are logged with:
- Operation type and duration
- Items processed
- Success/failure status
- Hourly aggregation for performance analysis

Query via `GET /api/rag/metrics?hours=24`.

### 🔧 New API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/rag/health` | GET | Health summary with 24h/1h metrics |
| `/api/rag/metrics` | GET | Detailed metrics by operation type |
| `/api/rag/errors` | GET | RAG error log with filtering |
| `/api/rag/migration/status` | GET | Embedding migration progress |
| `/api/rag/migration/start` | POST | Trigger manual migration |
| `/api/rag/patterns` | GET | List discovered patterns |
| `/api/rag/patterns/discover` | POST | Run pattern discovery |
| `/api/rag/patterns/:id/approve` | PUT | Approve a pattern |
| `/api/rag/patterns/:id/reject` | PUT | Reject a pattern |

### 🔒 Security Fixes
- **SQL Injection:** Pattern decay function now uses parameterized queries
- **NaN Validation:** Vote average parsing validates numeric values
- **Null Safety:** Health metrics division protected against null values

### 🗄️ Database Changes
- **Migration 039:** Adds RAG configuration columns, pattern mining tables, enhanced error logging, metrics tables
- **New Tables:** `discovered_patterns`, `pattern_match_log`, `rag_metrics`
- **New Columns:** `rag_fusion_method`, `rag_rrf_k`, `embedding_format_version` (ai_provider_config), `rag_operation`, `rag_context`, `duration_ms`, `recoverable` (error_log)
- **New View:** `rag_health_summary` for dashboard queries

### 🧪 Testing
- **50 new tests** covering RRF algorithm, rich embeddings, and pattern mining
- **100% test pass rate** (333/333 tests)
- Comprehensive edge case coverage

### 💡 Usage Tips

**Monitor Migration:**
```bash
curl http://localhost:21324/api/rag/migration/status
```

**Check RAG Health:**
```bash
curl http://localhost:21324/api/rag/health
```

**Discover Patterns:**
```sql
-- Enable pattern mining
UPDATE ai_provider_config SET pattern_mining_enabled = true;
```
```bash
# Run discovery
curl -X POST http://localhost:21324/api/rag/patterns/discover
```

**Advanced Tuning (Optional):**
```sql
-- Use legacy fusion instead of RRF
UPDATE ai_provider_config SET rag_fusion_method = 'legacy';

-- Adjust RRF k parameter (higher = more conservative fusion)
UPDATE ai_provider_config SET rag_rrf_k = 80;
```

---

## v0.34.6-alpha
**Title: Event Sub-Categories**

### New Features
- **Event Sub-Types:** When selecting Holiday, Sports, or PPV as an Event Detection Type, a second dropdown now appears allowing you to specify the exact sub-type:
  - **Holidays:** Christmas/Xmas, Halloween, Thanksgiving, Easter, Valentine's Day, New Year's, 4th of July
  - **Sports:** Football/NFL, Basketball/NBA, Baseball/MLB, Hockey/NHL, Soccer, Golf, Racing/F1/NASCAR
  - **PPV/Combat:** UFC/MMA, Boxing, Wrestling/WWE
- Sub-types are available in both **Library Configuration** and **Rule Builder**
- Specific keywords are displayed for each sub-type selection

### Bug Fixes
- **Tavily API Key Fix:** Fixed enrichment failing with "Tavily API key is required" error when processing retry queue - API key is now properly passed to the Tavily service

### Technical
- New database migration `038_add_event_sub_type.sql` adds `event_sub_type` column to libraries table
- Backend route updated to save `event_sub_type` with library configuration

---

## v0.34.5-alpha
**Title: Rule Builder Improvements**

### Improvements
- **Improved Filter Suggestions:** Available Library Filters now only show values with meaningful coverage (5%+ of library)
- **Content Rating Labels:** Numeric ratings (13, 14, 15) now display as friendly labels (PG-13, TV-14, Age 15+)
- **Percentage Display:** Filter values show both count and percentage (e.g., "PG-13 (415 · 15%)")
- **Removed Redundant Suggestions:** AI Suggestions no longer suggest content_type (libraries are already type-specific)
- **Removed Studio Filters:** Studio suggestions removed as they rarely have meaningful coverage

### Bug Fixes
- **Rule Builder Navigation:** Fixed "Use This Rule" and "Use Selected Conditions" buttons navigating away instead of staying on page
- **Negative Timestamps:** Fixed Live Activity Stream showing negative timestamps (timezone mismatch)

---

## v0.34.4-alpha
**Title: Mobile Responsiveness**

### New Features
- **Mobile-Friendly Navigation:** Sidebar is now hidden by default on mobile devices with a hamburger menu toggle
- **Slide-In Overlay:** Sidebar slides in from the left as an overlay on mobile
- **Auto-Close Navigation:** Sidebar automatically closes when navigating to a new page
- **PWA Support:** Added web app manifest for "Add to Home Screen" functionality on mobile

### Improvements
- **Touch Targets:** Increased padding and touch-friendly spacing on mobile
- **iOS Support:** Added Apple web app meta tags for better iOS experience
- **Responsive Padding:** Reduced content padding on mobile for more usable space

---

## v0.34.3b-alpha
**Title: Hotfix: Library Enrichment Stall**

### Fixes
- **Enrichment Logic:** Fixed a critical bug where pre-existing library items were skipped by the enrichment process because they were classified as "analyzed" by the sync process. The gap analysis now correctly identifies items that have sync data but lack OMDb enrichment.
- **Immediate Trigger:** Saving OMDb settings now immediately triggers the enrichment process (Gap Analysis) instead of waiting for the 5-minute scheduled interval.

---

## v0.34.3a-alpha
**Title: UI Polish & Bug Fixes**

### Improvements
- **UI:** Filtered out embedding models (e.g., `nomic-embed`, `minilm`) from the primary "Generation Model" dropdown to reduce clutter.
- **UI:** Added http-fallback for "Copy to Clipboard" in Logs view, enabling functionality in non-secure environments.
- **UX:** Improved error feedback when fetching Ollama models fails.

### Fixes
- **Ollama:** Fixed critical bug where `fetchOllamaModels` ignored custom Host/Port settings and queried `localhost` by default.
- **Scheduler:** Fixed `smart suggestion check` crash caused by undefined config property.
- **Database:** (Inherited from v0.34.3) Restored all missing tables dropped by broken migration 034.

---

## v0.34.3-alpha
**CRITICAL HOTFIX: Database Restoration**

### Emergency Fixes

- **Database Restoration**: Restored ALL tables incorrectly dropped in migration 034. This fixes:
  - **Notifications**: Discord notifications now work again.
  - **SSL Settings**: HTTPS/SSL configuration page restored.
  - **Classification**: Rules engine functional again.
  - **Webhooks**: Overseerr/Jellyseerr requests processing restored.
  - **AI Learning**: Feedback loop patterns restored.
  - **Content Analysis**: Analysis logs restored.

### Database Changes

- **Migration 037**: Re-creates all missing tables with original schemas.
- **Migration 034**: DEPRECATED & NEUTRALIZED. Drop statements commented out to prevent future issues.

---

## v0.34.2-alpha
**Hotfix: Ollama Config**

- **Fix**: Restored `ollama_config` table (Migration 036) to fix "relation does not exist" error on fresh installs.

---

## v0.34.1-alpha
**Hotfix: Error Logs & Docker Compose**

### Fixes

- **Error Logs Page**: Fixed "Internal Server Error" on Settings > Error Logs - restored `error_log` table that was incorrectly dropped in migration 034
- **Docker Compose**: Updated environment variable format to match README with helpful comments for PUID/PGID
- **Docker Compose**: Removed incorrect read-only (:ro) suggestion from media volume comments - re-classification requires write access

### Database Changes

- **Migration 035**: Restores `error_log` table with full schema and indexes

---

## v0.34.0-alpha
**Title: RAG Semantic Search & Enrichment Improvements**

This major release introduces **Semantic Search (RAG)** using pgvector for intelligent similarity-based classification, plus an **Enrichment Retry Queue** for improved metadata coverage. The database has also been cleaned up with removal of unused legacy tables.

### New Features

#### 🔮 RAG Semantic Search

**Why RAG for Media Classification?**

Traditional rule-based systems struggle with edge cases. RAG learns from your classification history to make better decisions:

- **Franchise Consistency**: Classified "Harry Potter" to Kids? RAG remembers and suggests the same for subsequent Harry Potter films.
- **Studio Patterns**: Route all Pixar films to a specific library? RAG learns this pattern for new Pixar releases.
- **Genre Nuances**: Horror-comedies like "Shaun of the Dead" don't fit neatly into rules, but RAG uses context from similar classifications.
- **Personal Preferences**: Your library organization is unique—RAG learns YOUR preferences, not generic rules.

**Technical Implementation:**
- **pgvector Integration:** Full vector similarity search using PostgreSQL pgvector extension
- **RAGRetriever Service:** New service for semantic, hybrid, and full-text search across classification history
- **Embedding Support:** Generate and store embeddings for all classifications
  - Supports Ollama, OpenAI, and Gemini embedding models
  - Configure in Settings → AI → Semantic Search (RAG)
- **Dynamic Weighting:** RAG signals dynamically weighted based on match quality (50-90% confidence)
- **AI Context Enhancement:** Similar past classifications are included in AI prompts for better decisions
- **Backfill Support:** Automatically generate embeddings for existing classification history

**Supported Embedding Models:**
- **Ollama (Free):** nomic-embed-text, mxbai-embed-large, bge-m3, all-minilm
- **OpenAI:** text-embedding-3-small, text-embedding-3-large
- **Gemini:** text-embedding-005, text-embedding-004

#### 🔄 Enrichment Retry Queue
- **Tavily Fallback:** Items that fail OMDb enrichment are automatically queued for Tavily web search
- **Priority-Based Processing:** Queue processes items by priority with configurable max attempts
- **IMDb Data Extraction:** Automatically extracts IMDb IDs, ratings, and genres from web results
- **Backfill Support:** Bulk-queue items missing OMDb data for Tavily enrichment

### Improvements

- **Classification History:** Allow NULL tmdb_id for items without TMDB matches (personal videos, obscure content)
- **Signal Collector:** Enhanced integration with RAG retriever for similarity-based signals
- **Confidence Calculator:** RAG matches now contribute to confidence scoring
- **Context Manager:** RAG context injected into AI classification prompts
- **Health Check Service:** Added RAG embedding status monitoring

### Database Changes

- **Migration 031:** RAG infrastructure - pgvector extension, classification_embeddings table, embedding_costs tracking, HNSW index for fast similarity search
- **Migration 032:** Allow NULL tmdb_id in classification_history for non-TMDB content
- **Migration 033:** Enrichment retry queue table with priority-based processing
- **Migration 034:** Database cleanup - removed unused legacy tables (library_rules, ollama_config, ssl_config, learning_patterns, etc.)

### Technical Notes

- RAG requires minimum 50 embeddings before activating (configurable)
- Similarity threshold default: 70% (configurable 50-95%)
- HNSW index parameters: m=16, ef_construction=64 for balanced speed/accuracy
- Embedding dimensions: Up to 2000 (supports all major providers)

---

## v0.33.1a-alpha
**Hotfix: Dockerfile Deprecation Warning**

### Fixed
- Removed deprecated `--build-from-source` npm flag from Dockerfile

---

## v0.33.1-alpha
**Dependency Updates & Test Fixes**

### Fixes
- **SignalCollector Tests:** Fixed test file to match actual implementation (correct SIGNAL_TYPES, mock methods)
- **All 211 tests now pass**

### Updated Dependencies
- `supertest`: 6.3.4 → 7.1.4 (fixes deprecated superagent warning)
- `node-cron`: 3.0.3 → 4.2.1 (TypeScript rewrite, API unchanged)
- `testcontainers`: 11.10.0 → 11.11.0
- `@testcontainers/postgresql`: 11.10.0 → 11.11.0
- `jsdom`: 24.1.3 → 27.4.0

---

## v0.33.0-alpha
**Major: AI-Centric Classification Refactor**

This release fundamentally restructures how Classifarr classifies media. Instead of using AI as the primary decision-maker, AI now serves as a **verification layer** that confirms or adjusts signals collected from multiple sources.

### How It Works

**Old Flow:** Media → AI decides → Library assigned  
**New Flow:** Media → Collect signals → Calculate confidence → AI verifies (if needed) → Library assigned

#### Signal Collection
The new `SignalCollector` service aggregates multiple classification signals:
- **Exact Match:** Previously classified TMDb ID, learned patterns
- **Pattern Match:** Title rules, genre patterns, keywords
- **Franchise Match:** Other items from same collection (e.g., all Harry Potter films → same library)
- **Keyword/Genre:** Signal-based matching from TMDb metadata

#### Confidence Calculation
The `ConfidenceCalculator` applies configurable weights to each signal:
- Configure weights in **Settings → Confidence Settings**
- Signals above 100% confidence **skip AI entirely**
- Signals below threshold become **pending items** requiring human decision

#### Pending Queue
Items the AI is uncertain about go to the **Awaiting Decision** queue:
- Visible in Queue page → "Awaiting Decision" tab
- Visible in Dashboard → "Awaiting Decision" widget
- AI generates **policy questions** with library options
- Click an option to resolve and generate a **learned pattern**

### New Features
- **🏷️ Manual Classify:** Button in pending queue bypasses AI entirely
  - Select library → 100% confidence + `manual_classification` method
  - Filtered by media type (movies only show movie libraries)
- **Policy Questions:** AI generates clarifying questions for edge cases
- **Discord Integration:** Policy questions work via Discord buttons
- **SignalCollector Tests:** Unit test suite for the new service

### Fixes
- **OMDb API:** 15s timeout, 2 retries with backoff, graceful degradation
- **MediaServer Test:** Tests selected connection, not saved config

---

## v0.32.3a-alpha
**Hotfix: Root Folder One-to-One Relationship**

### Fixed
- Root folder dropdown now excludes folders already mapped to other libraries
- When editing a mapping, the current folder remains selectable

---

## v0.32.3-alpha
**Library Mappings Enhancement + Auto-Detect Fix**

### Features
- **Classifarr Path Column:** Mappings table now shows Classifarr container path
- **Edit Mapping:** Click "Edit" on existing mappings to modify them
- **📁 Folder Browser:** Browse container filesystem when setting Classifarr path
- **Removed Path Mapping Tab:** Consolidated into Radarr/Sonarr settings

### Fixes
- **Auto-Detect:** Now uses EXACT folder name matching only (no more partial matches)
  - Library "Family" only matches folder ending with `/Family`, not `/local/movies/Christmas`
  - Applies to both Radarr and Sonarr

### Tests
- Added 5 regression tests for auto-detect exact match logic

---

## v0.32.2-alpha
**Issue #74 Fix: Library Mappings Persistence**

### Fixes
- **Issue #74:** Library mappings no longer disappear after media server settings resync
- **Root Cause:** Media server settings UPDATE was creating new DB row instead of updating existing
- **Solution:** POST /api/media-server now preserves server ID by updating in-place

### Tests
- Added regression tests for `mediaServer.js` to prevent future issues

---

## v0.32.1-alpha
**Title: Fix Media Sources Save Bug**

### Fixes
- Fixed issue where saving Radarr/Sonarr configurations would fail with "null value in column 'url' violates not-null constraint"
- Resolved GitHub Issue #72: Media Sources configuration now saves correctly even when some fields are missing
- Improved URL construction logic in PUT endpoints to match POST endpoint behavior

---

## v0.32.0-alpha
**Path Mapping & Reclassification**

### New Features
- **Path Mapping:** Configure path translations between *arr containers and Classifarr (e.g. `/movies` -> `/data/movies`)
- **Path Verification:** Test connectivity and permissions of configured paths
- **Enhanced Reclassification:** File operations now respect path mappings

### Fixes
- **Rollup Build Error:** Fixed missing import in PathMapping component

---

## v0.31.4-alpha
**Statistics Page SQL Fixes**

### Fixes
- **Statistics SQL Error:** Fixed PostgreSQL GROUP BY error in confidence distribution query using subquery approach
- **Zero Stats Values:** Removed exclusion filter that was hiding all `source_library` classification data from statistics

---

## v0.31.3-alpha
**Event Detection Dropdown Fix**

### Fixes
- **Dropdown Selection:** Fixed issue where "None" option couldn't be selected after choosing an event type
- **Removed Duplicate Options:** Eliminated duplicate placeholder/option in Event Detection Type dropdown

---

## v0.31.2-alpha
**Event Detection Rules & Library Assignment**

### New Features
- **Event Detection Library Assignment:** Assign event types directly to libraries via dropdown:
  - 🎄 **Holiday** - Christmas, Halloween, Thanksgiving, Easter, etc.
  - 🏈 **Sports** - NFL, NBA, MLB, NHL, Olympics, Super Bowl, etc.
  - 🥊 **PPV/Combat** - UFC, MMA, Boxing, WWE, WrestleMania, etc.
  - 🎵 **Concert** - Live concerts, music festivals, symphonies
  - 🎤 **Stand-up Comedy** - Comedy specials, Netflix/HBO specials, roasts
  - 🏆 **Awards** - Oscars, Emmys, Grammys, Golden Globes, etc.
- **Smart Rule Builder Event Conditions:** Use `event_type` as a rule condition with `includes` operator
- **Keywords Tooltip:** Hover (i) icon shows all detection keywords for each event type
- **Custom Rule Override Tip:** Tooltip explains using Smart Rule Builder for custom keyword routing

### Improvements
- **Separated Concert & Stand-up:** Now distinct event types instead of combined
- **Database Schema:** Added `event_detection_type` column to libraries table

---

## v0.31.0-alpha
**Classification Methods Standardization & Event Detection Expansion**

### New Features
- **Event Detection Expansion:** Auto-detection now covers 5 content types:
  - 🎄 **Holiday** (95%): Christmas, Halloween, Thanksgiving, Easter, etc.
  - 🏈 **Sports** (92%): NFL, NBA, MLB, NHL, Olympics, Super Bowl, etc.
  - 🥊 **PPV/Combat** (93%): UFC, MMA, Boxing, WWE, WrestleMania, etc.
  - 🎤 **Concert** (90%): Live concerts, comedy specials, music festivals
  - 🏆 **Awards** (88%): Oscars, Emmys, Grammys, Golden Globes, etc.
- **Queue Self-Healing:** Stale queue items now auto-recover missing TMDB IDs and library info from database
- **Periodic Library Sync:** Automatic Plex library sync every 6 hours to keep metadata fresh

### Improvements
- **Classification Methods Standardized:** Renamed methods for consistency:
  - `ai_fallback` → `ai_analysis`
  - `library_rule` / `rule_match` → `custom_rule`
  - `holiday_detection` → `event_detection`
  - `learned_correction` → `manual_correction`
- **Statistics Accuracy:** Dashboard "Total Classifications" now correctly excludes source_library enrichments
- **Activity Page:** "Classified Today" now includes ALL methods (including source_library)
- **Frontend:** All method display mappings updated with legacy backwards compatibility

### Fixes
- **Plex TMDB IDs:** Added `includeGuids=1` parameter to Plex API calls to retrieve TMDB/IMDB/TVDB IDs
- **SQL Query Error:** Fixed PostgreSQL "column 'level' does not exist" error in confidence distribution stats

### Technical
- New `detectEventContent()` function with comprehensive keyword matching
- Database migration (020) to rename legacy method names
- Frontend display mappings updated in Activity.vue, Statistics.vue, History.vue

---

## v0.30.9-alpha
**Bug Fixes: Radarr/Sonarr Config & UI Navigation**

### Fixes
- **Radarr/Sonarr Config Save (#70):** Fixed "null value in column url" error when adding new Radarr/Sonarr instances
  - Backend now constructs URL from protocol/host/port/base_path components when not provided
  - Applies to both POST (create) and PUT (update) operations
- **Configure Media Server Button (#71):** Button on Libraries page now correctly links to `/settings?tab=mediaserver` instead of just `/settings`

---

## v0.30.8-alpha
**Plex Scan Integration & Batch Reclassification**

### New Features
- **Plex Library Scanning:** Plex library scans now trigger automatically after reclassification moves
  - Partial scans (specific paths) attempted first for efficiency
  - Falls back to full library scan if partial fails
  - Both source and destination libraries scanned
- **Batch Reclassification:** Select and reclassify multiple items at once from History page
  - Multi-step workflow: Configure → Validate → Execute
  - Progress tracking with real-time updates
  - Pause-on-error with skip/retry options
  - Checkboxes with select-all in History table
- **UID/GID Validation:** Dry-run now warns if PUID/PGID mismatch detected between source and destination

### Improvements
- **Database Migration Docs:** Added `docs/migrations.md` documenting the schema management system
- **README Updated:** Added CAUTION block about PUID/PGID matching requirements for Docker deployments

### Technical
- New `reclassificationBatchService.js` with database tables for batch tracking
- New `/api/reclassification/batch/*` endpoints for batch operations
- New `BatchReclassifyModal.vue` component with multi-step workflow

---

## v0.30.5-alpha
**Multi-Instance Arr Support & UX Improvements**

### New Features
- **Multi-Instance Radarr/Sonarr Support:** Configure multiple Radarr and Sonarr instances for different quality tiers (e.g., 1080p vs 4K)
- **Add Instance Button:** "Add Radarr Instance" / "Add Sonarr Instance" button appears when existing config exists
- **Instance Management:** Edit and delete individual instances with per-instance library mappings

### Improvements
- **Settings View/Edit Mode:** Clear separation between view mode (read-only summary) and edit mode (full configuration)
- **Inline Library Mappings:** Library mappings now configurable directly within the arr instance edit form
- **Read-Only Summary:** View mode shows library mappings as read-only summary for quick reference
- **Message Clarity:** Empty state messages now differentiate between "no mappings configured" (view mode) and "no libraries found" (edit mode)

### Fixes
- **Library Detection:** Fixed Plex libraries not loading in edit mode (JavaScript hoisting bug with arrow functions)
- **Cancel Button:** "Cancel Editing" button now works correctly to exit edit mode
- **Media Server Dropdown:** Dropdown now properly disabled in view mode, only editable in edit mode

---

## v0.30.4-alpha
**UI Refactor & Bug Fixes**

### New Features
- **Library Mappings Integration:** Library mappings now appear directly in Radarr/Sonarr settings when a media server is linked (removed standalone tab)
- **Path Configuration Guide:** Collapsible guide added to Radarr/Sonarr settings with Docker path mapping help

### Improvements
- **SSL Toggle UX:** SSL verification toggle is now disabled and greyed out when protocol is HTTP, with explanatory text
- **Settings Navigation:** Removed standalone "Library Mappings" and "Path Testing" tabs for cleaner navigation

### Fixes
- **Media Server Dropdown:** Fixed "Associated Media Server" dropdown not populating with configured media servers
- **API Key Test Connection:** Fixed test connection failing after page refresh when API key is masked (now resolves from database)

---

## v0.30.3-alpha
**Queue Settings Fix**

### Fixes
- **Queue Settings:** Fixed JSON parsing error when saving queue settings (GitHub Issue #69)
- **API Client:** Added category-based settings endpoints (`/api/settings/category/:name`) for queue, scheduler, and classification settings
- **API Client:** Added generic HTTP methods (`get`, `post`, `put`, `delete`) to API client for inline calls

### Improvements
- **Queue Settings UX:** Save Settings button moved to separate row after all configuration options
- **Queue Settings UX:** Clear Completed/Failed buttons now show task counts and are disabled when count is 0
- **Queue Settings UX:** Save message now displays next to Save button instead of in Queue Maintenance section
- **Queue Stats:** Added "completed" count to the quick stats banner in Queue Settings

---

## v0.30.2-alpha
**Release Workflow Updates**

### Improvements
- **Release Process:** GitHub CLI now prioritized for creating releases with turbo auto-run

---

## v0.30.1-alpha
**Documentation & Docker Configuration Updates**

### Improvements
- **Docker Volume Configuration:** Updated docker-compose and Unraid template to use read-write media mounts for future direct file moves
- **Release Process:** Updated release.md workflow to not use pre-release for alpha versions

### Fixes
- **Documentation:** Fixed README docker examples to include media volume mount

---

## v0.30.0-alpha
**Re-Classification System Foundation**

> [!NOTE]
> This release adds the infrastructure for re-classification but the Setup Banner is disabled pending bug fixes in a future minor release.

### New Features
- **Re-Classification Service:** New backend service for moving media between *arr root folders
  - `reclassificationService.js` with execute, preview, and rollback support
  - Media type isolation (movies → Radarr only, TV → Sonarr only)
  - Learned corrections integration for future classifications
- **Library Mapping System:** Map Plex libraries to *arr root folders
  - `libraryMappingService.js` with auto-detection from Plex
  - New `/api/mappings` endpoints for CRUD operations
  - `LibraryMappings.vue` UI in Settings → Media Sources
- **Path Testing:** Verify Docker path accessibility for re-classification
  - `pathTestService.js` with health checks and path accessibility tests
  - `PathTest.vue` UI in Settings → System → Path Testing
  - API endpoints for testing path translation
- **Learned Corrections:** User corrections now inform future classifications
  - `checkLearnedCorrections()` added to classification chain (100% confidence)
  - Highest priority after source_library match
- **New API Endpoints:**
  - `POST /api/classification/reclassify` - Execute full re-classification with media move
  - `POST /api/classification/reclassify/preview` - Preview without executing
  - `POST /api/settings/path-test` - Test path accessibility
  - `GET /api/settings/path-test/health` - Re-classification health check

### Database Changes
- New tables: `library_arr_mappings`, `learned_corrections`, `app_settings`
- New columns: `media_server_id` in `radarr_config` and `sonarr_config`

### Technical Changes
- Added `media_server_id` dropdown to Radarr/Sonarr settings
- Classification priority now includes learned_correction method
- Startup service for setup status detection

---

## v0.27.9-alpha
**Plex Sync Fixes, Pattern Suggestions & AI Improvements**

### Fixes
- **AI Suggestions:** Fixed AI suggesting duplicate rules that already exist
  - AI prompt now includes existing rules so it knows what's already applied
  - Added instruction: "Do NOT suggest duplicates, may suggest enhancements"
  - Added server-side fallback filter to remove any duplicates AI might still suggest
- **Library Sync:** Fixed Plex sync wiping enrichment progress (OMDb/Tavily data)
  - UPSERT now merges metadata instead of replacing it entirely
- **Duplicate Classifications:** Fixed same title appearing 81+ times in statistics
  - Added duplicate check before inserting classification_history entries
- **Health Status:** Fixed Activity page showing "Partial" instead of "All Systems OK"
  - Frontend was checking wrong field name (`ollama` vs `ai`)
- **Pattern Suggestions:** Fixed pattern analysis only running for one library
  - Changed `sync_enabled` to `is_active` - column didn't exist
- **Clear & Re-Sync All:** Now properly resets all data including:
  - `library_pattern_suggestions` table
  - Triggers `runPatternAnalysis()` after sync to populate suggestions

### UX Improvements
- **Pattern Suggestions Widget:** Removed dismiss (X) button from library tiles
  - Users must now review patterns in Rule Builder to dismiss individually
  - Prevents accidentally hiding libraries without reviewing available filters
  - Widget count updates automatically as patterns are dismissed or applied

---

## v0.27.0-alpha
**Pattern Suggestions Enhancement**

### New Features
- **Configurable Pattern Suggestions:**
  - **Individual Dismissal:** You can now dismiss specific pattern filters from the Rule Builder that you don't want to see.
  - **Restore Filters:** View and restore previously dismissed filters via the new "Show Dismissed" toggle.
  - **Scheduled Analysis:** Configure how often the system re-scans media metadata for patterns (Hourly, Daily, Weekly, or Never) in Settings > Scheduler.
- **Startup Trigger:** Pattern analysis now runs automatically on server startup to ensure suggestions are always up to date.

### Fixes
- **Dashboard Widget:** Fixed "New Pattern Suggestions" widget navigation to correctly open the Rule Builder.
- **Data Refresh:** Ensured suggestion widget shows accurate counts by respecting dismissed items and running analysis proactively.

### Technical Changes
- Added `dismissed_patterns` table and `pattern_sync_frequency` setting.
- Updated `SchedulerService` to support global maintenance schedules.

---

## v0.26.2-alpha
**Dashboard AI Status Fix**

### Bug Fixes
- **Dashboard Status:** Fixed AI Provider showing "Offline" when it was actually working
- **Consistent Naming:** All UI now shows "AI Provider" instead of "Ollama"

---

## v0.26.1-alpha
**Ollama Connection Fix (Issue #66)**

### Bug Fixes
- **Test Connection Fixed:** Uses input field values instead of cached DB values
- **AI Provider Selection:** Queue respects configured provider - OpenAI works without Ollama

### Improvements
- **Simplified Defaults:** Ollama default is now `localhost`
- **Cleaner Code:** Removed ~60 lines of complex gateway detection

---

## v0.26.0-alpha
**Linux/Unraid Ollama Connection Fix**

### Major Fixes
- **Ollama Connection on Linux/Unraid:** Fixed the "getaddrinfo ENOTFOUND host.docker.internal" error that prevented Ollama connectivity on Linux-based systems (Unraid, Synology, standard Docker on Linux).
  - **Auto-Detection:** The application now automatically detects the Docker gateway IP on Linux by parsing the system routing table.
  - **Auto-Migration:** Existing installations with `host.docker.internal` saved in the database will be automatically updated to use the correct gateway IP on the next container restart.
  - **Fallback Protection:** Added `extra_hosts` mapping to all docker-compose files to make `host.docker.internal` resolve correctly as a backup.
  - **Enhanced Diagnostics:** Connection test errors now provide platform-specific troubleshooting suggestions.

### Improvements
- **Platform-Aware Defaults:** The system intelligently selects the appropriate default host:
  - **Linux:** Auto-detects Docker gateway (typically `172.17.0.1`)
  - **Windows/macOS:** Uses `host.docker.internal` (native support)
- **Unraid Template Updated:** The Community Applications template now includes `--add-host host.docker.internal:host-gateway` for seamless setup.
- **Better Error Messages:** Connection failures now explain the issue and suggest specific fixes based on the error type and platform.

### Technical Changes
- Modified `server/src/services/ollama.js`:
  - Added `getDefaultOllamaHost()` method to detect Docker gateway from `/proc/net/route`
  - Updated `getConfig()` to auto-fix legacy `host.docker.internal` configs on Linux
  - Enhanced `testConnection()` with context-aware error messages
- Updated all docker-compose files with `extra_hosts: - "host.docker.internal:host-gateway"`
- Updated `unraid/classifarr.xml` template with host mapping parameter

### User Impact
- **New Users:** Ollama connection works out-of-the-box on Linux without manual configuration
- **Existing Users:** Auto-fixed on next container restart (logged to console)
- **No Breaking Changes:** Windows/macOS users unaffected, manual configurations still work

---

## v0.25.0-alpha
**Smart "Use This" & Continuous Pattern Analysis**

### New Features
- **Smart "Use This" Builder:**
  - Build classification rules directly from your media metadata (Plex/Emby/Jellyfin)
  - Interactive modal showing all available conditions: Genres, Ratings, Studios, Collections, Tags, Years
  - Live statistics showing exactly how many items match each condition
  - Support for `is_one_of`, `contains`, `equals`, and `not_equals` operators
- **Continuous Pattern Analysis:**
  - Automated system that periodically scans your libraries for new metadata trends
  - **New Dashboard Widget:** "New Pattern Suggestions" alerts you to potential rules based on your media
  - Dismiss notifications for suggestions you don't want to use
- **Updated Scheduler:**
  - New `Pattern Analysis` task type available for scheduling
  - Configure how often libraries are re-scanned for new patterns (default: daily)

### Improvements
- **"Use This" Logic:** Now correctly prioritizes direct library metadata for rule filtering, removing dependency on AI classification for this specific feature. Use AI Suggestions for AI-based rules, and "Use This" for metadata-based rules.
- **Performance:** Optimized query performance for pattern extraction across large libraries.

---

## v0.24.0-alpha
**Database Migration Runner & Persistence Fixes**

### New Features
- **Cloud AI Providers:** Full support for OpenAI, Google Gemini, OpenRouter, LiteLLM, and compatible Custom endpoints.
- **Budget Controls:** Set monthly spending limits (USD) and alerts for paid providers.
- **Hybrid AI Strategy:** Use Ollama as a free fallback when budget is exhausted or for basic classification tasks.
- **Database Migration Runner:** Automated SQL migration system runs on startup, tracking applied migrations in `schema_migrations`.
- **Improved Settings Persistence:** Ollama host/model and other settings now persist correctly across restarts.

### Fixes
- **Ollama Default Host:** Changed default host to `localhost` (from `ollama`) to prevent confusion on unconfigured setups.
- **Model Selection UI:** Fixed issue where saved model didn't appear in dropdown on initial load.
- **Migration Idempotency:** Hardened legacy migrations (003, 011-015) to operate safely on existing databases.

---

## v0.23.1-alpha
**Dashboard Enhancements & Activity Stream Separation**

### New Features
- **Library Enrichment Progress Bar:** Dashboard now shows real-time enrichment progress with visual progress bar, items enriched count, Tavily count, and queue pending indicator.
- **Dashboard/Activity Separation:** Dashboard "Recent Classifications" now only shows true classifications (Overseerr, manual requests), while Activity page shows all activities including source_library enrichments.

### Improvements
- **Enrichment Stats API:** New `/api/queue/live-stats` endpoint includes enrichment progress data (total items, enriched, Tavily count, percentage).
- **Classification History Filter:** Added `excludeMethod` parameter to `/api/classification/history` endpoint.
- **Improved Tavily Logging:** Enhanced debug logging for Tavily API calls to diagnose rate limit (HTTP 432) errors.

### Fixes
- **Classification History Insert:** Fixed "column source_library_id does not exist" error when logging enrichment activities.
- **Dashboard Stats:** "Classified Today" count now excludes source_library enrichments for accurate classification metrics.

---

## v0.23.0-alpha
**AI Learning Overhaul & Enhanced Tavily Integration**

> [!IMPORTANT]
> **After upgrading, you MUST perform a Clear and Re-Sync All:**
> 
> `Settings` → `Queue` (scroll down) → `Advanced Options` → `Clear and Re-Sync All`
> 
> This release includes significant changes to how media data is processed and stored.

### Breaking Changes
- **Clear and Re-Sync Now Fully Clears:** The `Clear and Re-Sync All` function now completely deletes `media_server_items` instead of just resetting metadata. This fixes duplicate entries and stale data issues.

### New Features
- **No AI Analysis for Library Items:** Items already in your Plex libraries now get **100% confidence** automatically from their source library. No AI classification is run, preventing incorrect low-confidence results.
- **Enhanced Tavily Enrichment:** New targeted web searches during metadata enrichment:
  - `tavily_content_type` - Detects documentaries, stand-up specials, animation
  - `tavily_holiday` - Identifies Christmas/holiday/seasonal content
  - Existing: `tavily_imdb`, `tavily_advisory`, `tavily_anime`
- **Smarter AI Suggestions:** Smart Rule Builder now includes Tavily web insights in LLM prompts for better rule recommendations.

### Improvements
- **Rule Builder UX:** "Use This Rule" buttons now auto-save rules immediately.
- **Library Name Display:** Rule Builder shows target library name in read-only field.
- **Enhanced Logging:** Classification logs now include detailed AI metrics (confidence, method, contentType).

### Fixes
- **Toast Notifications:** Fixed `TypeError: y.add is not a function` in SmartRuleForm.
- **Queue Architecture:** Gap analysis now uses `metadata_enrichment` task type instead of `classification` for existing Plex items.
- **Duplicate Entries:** Clear and Re-Sync now properly removes all items before re-syncing from Plex.

---

## v0.22.0-alpha
**Real-Time AI Monitoring & VRAM Optimization**

## v0.21.3-alpha
**Database Consolidation & Documentation Overhaul**

### Improvements
- **Rule Table Consolidation:** Updated `checkLibraryRules` to use `library_rules_v2` with conditions JSON format, deprecating obsolete `library_rules` table.
- **Cleaner Clear & Re-sync:** Now only clears `library_rules_v2` and `library_custom_rules` for simpler rule management.
- **Documentation Overhaul:** Complete rewrite of README.md with:
  - Updated architecture diagram showing actual classification flow
  - Smart Rule Builder documentation
  - Sync Libraries button usage
  - Clear & Re-sync instructions
  - Updated version badges and links

### Technical Changes
- `classification.js`: Rewrote `checkLibraryRules()` to parse conditions JSON from `library_rules_v2`
- `queueService.js`: Removed obsolete `library_rules` table from clearAndResync

## v0.21.2-alpha
**Critical Bug Fixes & UX Improvements**

### New Features
- **Sync Libraries Button:** Added manual "Sync Libraries from Plex" button in Media Server settings to re-import all libraries and content.

### Fixes
- **Library Sync Fix:** Fixed `upsertMediaItem` to update `library_id` on conflict, ensuring items are properly reassociated with libraries after sync.
- **Clear & Re-sync Improvements:**
  - Now triggers automatic library sync before gap analysis to repopulate `library_id` on items.
  - Fixed to properly clear `library_rules` (classification rules) from database.
  - Items now get 100% confidence via `source_library` method after sync.
- **Duplicate Rules Prevention:** Added unique constraint on `library_rules` table `(library_id, rule_type, operator, value)` to prevent duplicate rules.
- **Auto-Learn Disabled:** Removed automatic rule generation feature - it created duplicates and made assumptions incompatible with diverse library naming conventions. Users should create rules manually via Smart Rule Builder.

## v0.21.1-alpha
**Fixes & Database Updates**

### Improvements
- **Database Schema:** Added migration `014` to explicitly allow `source_library`, `holiday_detection`, and `library_rule` classification methods, preventing constraint violation errors.
- **Queue Service:** Enhanced `clearAndResync` to explicitly clear `library_id` from media items, ensuring items are fully disassociated from libraries during reset.
- **Project Config:** Added `.gitattributes` to enforce LF line endings for shell scripts, improving Docker compatibility on Windows.

## v0.21.0-alpha
**Smart Rule Builder & Proactive Intelligence**

### New Features
- **Smart Rule Builder:** Consolidated UI for managing library rules with LLM-powered suggestions.
- **Smart Suggestions:**
    - **LLM Integration:** Analyzes library content (types, genres, ratings) to generate high-confidence classification rules using Ollama.
    - **Data-Driven Rules:** Suggests rules base on dominant patterns (e.g. "80% of items are Anime").
- **Proactive Notifications:**
    - **Discord Alerts:** Sends notifications when new smart suggestions are available (requires 70%+ confidence).
    - **Scheduled Analysis:** Automatically checks libraries every 2 hours for new rule opportunities.
- **Clear & Re-sync:** Added logic to fully purge all classification data (including learned patterns and corrections) for a clean slate.

### Fixes
- **Clear & Re-sync:** Fixed a race condition where active tasks could persist after clearing. Now properly stops the queue worker and clears all associated tables.
- **Form Styling:** Fixed invisible text in Rule Builder dropdowns by enforcing dark backgrounds.

## v0.20.0
**Major UI Improvements & Bug Fixes**

### New Features
- **Settings Page Redesign:** Converted horizontal tabs to vertical sidebar with grouped categories (Application, Media Sources, AI & Data, Notifications, System) for easier navigation
- **Sonarr Settings Tab:** Added missing Sonarr configuration tab to Settings page

### Fixes
- **Rule Application:** Fixed "Failed to apply rule" error caused by duplicate POST route
- **Rule Builder:** Fixed blank page caused by missing `useRoute` import
- **Toast Notifications:** Fixed `toast.add is not a function` error

## v0.19.5-alpha
**Critical Bug Fixes**

### Fixes
- **Rule Application:** Fixed "Failed to apply rule" error caused by duplicate POST route intercepting requests and inserting into wrong table.
- **Rule Builder:** Fixed blank page caused by missing `useRoute` import in SmartRuleForm.vue.
- **Toast Notifications:** Fixed `toast.add is not a function` error by using correct toast methods.
- **Logging:** Removed debug logging added in v0.19.4 as issues are now resolved.

## v0.19.4-alpha
**Bug Fixes & Rule Builder Support**

### fixes
- **Rule Builder:** Fixed blank screen issue by adding header slot support to Card component.
- **Rule Application:** Fixed "Failed to apply rule" error by preventing duplicate rule suggestions.
- **Custom Rules:** Added database support (`library_custom_rules`) for complex rules created via Rule Builder.
- **API:** Updated endpoints to support fetching and creating both simple and custom rules.

## v0.19.3-alpha
**Bug Fixes & Rule Builder Support**

### fixes
- **Rule Builder:** Fixed blank screen issue by adding header slot support to Card component.
- **Rule Application:** Fixed "Failed to apply rule" error by preventing duplicate rule suggestions.
- **Custom Rules:** Added database support (`library_custom_rules`) for complex rules created via Rule Builder.
- **API:** Updated endpoints to support fetching and creating both simple and custom rules.

## v0.19.2-alpha
**Live Dashboard & Smart Learning Update**

### features
- **Live Activity Dashboard:** Real-time monitoring with 2-second refresh, live activity stream, and system health status.
- **Automatic Library Learning:** New scheduler task that automatically generates classification rules for libraries with sufficient analyzed content (runs every 30 mins).
- **Smart Rule Detection:**
  - **Anime Detection:** Recognizes "Anime" in library names or genres + Japanese language dominance.
  - **Keyword Patterns:** Automatically detects Christmas/Holiday and Hallmark content to suggest keyword-based rules.

### fixes
- **Learn from Library:** Fixed `jsonb_typeof` SQL error when analyzing text arrays.
- **Data Schema:** Fixed `original_language` column missing error by determining language from metadata JSONB.
- **Live Stats:** Fixed API 500 errors caused by `confidence_score` vs `confidence` column mismatch.
- **Frontend API:** Added missing API client methods for live dashboard data fetching.

## v0.19.1-alpha (2025-12-22)

### Fixed
- **Config Query Filters (Issue #63):** Added `is_active`/`enabled` filters to prevent stale config entries from being used
  - tavily_config, notification_config, webhook_config now properly filter inactive records
- **Missing DB Import:** Added missing database import to `ruleBuilder.js` that caused runtime errors
- **CI/CD Tests:** Fixed `ruleBuilder.test.js` with proper mocks and test expectations

---

## v0.19.0-alpha (2025-12-22)

### Added
- **Smart Library Rules:** Define per-library classification rules with rating, genre, keyword, language, and year filters
- **Auto-Generate Rules:** Libraries automatically get rules generated based on their names (Kids→ratings, Christmas→keywords, Anime→genre/language)
- **Library Rules API:** Full CRUD endpoints for managing library rules (`/api/libraries/:id/rules`)
- **AI Suggestions:** "Learn from Library" button analyzes existing content and suggests rules based on patterns
- **Source Library Priority:** Items synced from Plex now use source_library method at 100% confidence
- **Holiday Detection:** Christmas/holiday content detection with comprehensive keyword matching
- **Queue Maintenance:** Added "Reprocess Completed" and "Clear & Re-sync All" buttons to Queue settings

### Fixed
- **Classification Method Constraint:** Updated database to allow new classification methods (source_library, holiday_detection, library_rule)
- **Libraries Page Reactivity:** Fixed storeToRefs usage to ensure libraries display consistently
- **Clear & Re-sync API:** Fixed "N.post is not a function" error by adding proper API methods
- **Duplicate Variable:** Fixed SyntaxError from duplicate `ruleMatch` declaration in classification.js

### Changed
- **Classification Priority Order:** Now checks Source Library → Holiday Detection → Library Rules → Existing Media → Rule Match → AI Fallback

---

## v0.18.9-alpha (2025-12-22)

### Fixed
- **Emby Settings Persistence:** Added database transaction wrapper to Emby server configuration saves to prevent partial data writes and ensure settings persist correctly after page reload
- **Jellyfin Settings Persistence:** Added database transaction wrapper to Jellyfin server configuration saves to prevent partial data writes and ensure settings persist correctly after page reload
- **Discord Settings Persistence:** Added database transaction wrapper to Discord notification configuration updates to prevent partial data writes and ensure settings persist correctly after page reload
- **Plex UI State:** Fixed Plex authentication state management to properly reset after saving server configuration, ensuring consistent behavior with other media server types

---

## v0.18.8-alpha (2025-12-22)

### Added
- **Integration Testing:** Added testcontainers-based integration testing with real PostgreSQL Docker containers for production-parity testing
- **Schema Tests:** New comprehensive database schema integration tests verifying all table structures and queries

### Changed
- **Test Infrastructure:** Separated unit tests (`npm test`) from integration tests (`npm run test:integration`) in Jest configuration
- **Jest Config:** Updated to exclude integration tests from default test run to prevent conflicts

### Infrastructure
- **Docker Testing:** Integration tests now spin up real PostgreSQL containers via testcontainers for accurate database testing
- **CI/CD Ready:** Test suite now fully compatible with CI/CD pipelines that support Docker

---

## v0.18.7-alpha (2025-12-21)

### Fixed
- **Global Settings Persistence:** Applied transaction-based saving to **Ollama** and **TMDB** settings to prevent data loss during configuration updates, matching the fix previously applied to the Media Server.
- **Tab State Persistence:** The Settings page now remembers the active tab via URL query parameters (e.g., `?tab=sonarr`), allowing for page refreshes and direct linking without losing context.

## v0.18.6-alpha (2025-12-21)

### Fixed
- **Settings Persistence:** Resolved a critical issue where media server settings were not saving correctly. Implemented database transactions to ensure configuration changes are atomic and prevent data loss.
- **Initial Setup Loop:** Fixed a bug where the application would get stuck in a redirect loop to the Setup Wizard. The mandatory setup is now strictly limited to admin account creation, with other steps being truly optional.
- **Plex Connection:** Improved the Plex Media Server configuration flow by removing auto-selection. Users can now manually select their preferred connection (e.g., local vs remote IP) to ensure connectivity in complex network environments (Docker/Host).

## v0.18.5-alpha (2025-12-21)

### Changed
- **Plex Connection:** Enhanced Plex connection testing to prioritize remote HTTPS connections for better Docker compatibility.
- **UI:** Added visual indicators for recommended connections in the manual server selection list.

### Fixed
- **System Health:** Fixed an invalid query in the `/health` endpoint that caused false negative health checks.
- **Logs:** Corrected a SQL JOIN issue in the `/logs` endpoint that prevented classification history from displaying correctly.

## v0.18.4-alpha (2025-12-21)

### Changed
- **Authentication:** Removed email requirement for admin accounts. Authentication is now strictly username-based.
- **Setup:** Simplified the initial account creation form to only require username and password.

### Infrastructure
- **Database:** Added migration `011_make_email_optional.sql` to remove the email column from the `users` table.

---

## v0.18.3-alpha (2025-12-21)

### Added
- **Plex Auth:** Improved error messaging for Plex authentication failures.
- **API:** Added request interceptor to automatically inject authorization headers, fixing 401 errors.

### Fixed
- **Discord Bot:** Fixed an issue where the bot would attempt to fetch channels before the client was ready.

## v0.18.2-alpha
- Initial alpha release with core functionality.
