# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.37.0-alpha] - TBD

### 🚀 Major: Policy-Driven Classification Engine

This release implements the complete Policy-Driven Classification Engine, replacing rule-centric design with comprehensive policy-based classification using rich content signals.

### Added

#### PolicyEngine Service
- **New service:** `server/src/services/policyEngine.js` - Core classification engine with comprehensive signal evaluation
  - **Main entry point:** `evaluateItem(item)` - Evaluates media items against all active policies
  - **Authoritative signals:** `checkAuthoritativeSignals(item)` - 100% confidence source library matching
  - **Policy management:** `getActivePolicies()` - Fetches active policies with linked presets
  - **Policy evaluation:** `evaluatePolicy(policy, item)` - Scores single policy with weighted components
  - **Preset scoring:** `scorePresets(presets, item)` - Evaluates items against content preset signals
  - **Signal evaluation:** `evaluatePresetSignals(signals, item)` - Processes all signal types with weights
  - **Signal type scorers:**
    - `scoreCertification()` - Rating/certification filtering (include/exclude/max modes)
    - `scoreGenres()` - Genre matching (require_any/require_all/prefer/exclude)
    - `scoreKeywords()` - Keyword detection in title/overview/keywords
    - `scoreStudios()` - Production company matching
    - `scoreReleaseYear()` - Year range filtering
    - `scoreVoteAverage()` - TMDB rating thresholds
    - `scoreRuntime()` - Length filtering in minutes
    - `scoreLanguage()` - Language preference (require/prefer/exclude)
    - `scoreMediaType()` - Movie vs TV filtering (binary)
  - **Pattern scoring:** `scorePatterns(libraryId, item)` - Matches discovered patterns (caps at 95%)
  - **RAG scoring:** `scoreRAG(libraryId, item)` - Semantic similarity via embeddings (caps at 95%, graceful fallback)
  - **History scoring:** `scoreHistory(libraryId, item)` - Historical classification accuracy (caps at 95%)
  - **Result processing:**
    - `rankResults(evaluations)` - Sorts policies by weighted score
    - `determineAction(ranked)` - Decides auto-classify/prompt-confirm/prompt-select/manual
  - **Weighted scoring system:**
    - Preset weight (default 40%): Matches against 168 content presets
    - Pattern weight (default 30%): Discovered patterns from user feedback
    - RAG weight (default 20%): Semantic similarity from embeddings
    - History weight (default 10%): Past classification accuracy
    - All weights configurable per-policy or use global defaults

#### FeedbackAnalysis Service
- **New service:** `server/src/services/feedbackAnalysis.js` - Feedback analysis & pattern learning loop service
  - **Feedback recording:** `recordFeedback(feedbackData)` - Records user classification decisions into policy_feedback_log
  - **Policy analysis:** `analyzePolicy(policyId, options)` - Analyzes feedback to detect patterns and generate suggestions
  - **Failure pattern detection:** `detectFailurePatterns(policyId, feedback)` - Identifies systematic misclassifications
    - False positives: Recurring corrections away from policy (by genre, studio, keyword)
    - Missed positives: Recurring corrections toward policy
    - Threshold issues: High correction rates indicating threshold problems
  - **Signal effectiveness analysis:** `analyzeSignalEffectiveness(policyId, feedback)` - Evaluates signal performance
    - Calculates accuracy rates for preset, pattern, RAG, and history signals
    - Identifies underperforming and high-performing signals
  - **New pattern detection:** `detectNewPatterns(policyId, feedback)` - Discovers recurring patterns in corrections
    - Studios, keywords, genres, collections that appear frequently in user corrections
  - **Threshold analysis:** `analyzeThresholds(policyId, feedback)` - Analyzes score distributions
    - Auto-classification vs prompted decisions
    - Accuracy rates by action type
  - **Suggestion generation:** `generateSuggestions(policyId, analysis)` - Creates actionable tuning recommendations
    - `adjust_weight`: Increase/decrease signal weights based on performance
    - `add_preset`: Add presets for recurring patterns
    - `remove_preset`: Remove underperforming presets
    - `adjust_threshold`: Modify auto_classify_threshold or prompt_threshold
    - `create_pattern`: Add discovered patterns to discovered_patterns table
    - `modify_signal`: Adjust preset signal configurations
  - **Suggestion storage:** `storeSuggestions(policyId, suggestions)` - Persists suggestions to policy_tuning_suggestions
    - Fills in current policy values
    - Calculates recommended values
    - Prevents duplicate suggestions
  - **Learning stats:** `updateLearningStats(policyId)` - Updates policy_learning_stats table
    - Total decisions, auto-classified, AI validated, user prompted, corrections
    - Overall accuracy rate, auto-classification accuracy rate
    - 7-day and 30-day accuracy trends
    - Trend detection (improving/declining/stable)
  - **Suggestion management:**
    - `getPendingSuggestions(policyId)` - Retrieves pending suggestions
    - `applySuggestion(suggestionId, userId)` - Applies suggestion and logs to policy_change_log
    - `rejectSuggestion(suggestionId, userId, reason)` - Marks suggestion as rejected
  - **Full analysis:** `runFullAnalysis()` - Analyzes all active policies
  - **Helper methods:**
    - `groupByMetadataField(feedback, field)` - Groups feedback by metadata attributes
    - `extractSignificantPatterns(groups, type, minCount)` - Filters patterns by significance threshold

#### FeedbackAnalysis API Routes
- **New routes:** `server/src/routes/feedback.js` - API endpoints for feedback and policy learning
  - `POST /api/feedback` - Record a feedback event (requires authenticated user with valid userId)
  - `GET /api/feedback/policies/:id/suggestions` - Get pending suggestions for a policy (requires authentication)
  - `POST /api/feedback/policies/:id/analyze` - Trigger policy analysis (requires authentication; validates input bounds)
  - `GET /api/feedback/policies/:id/stats` - Get learning statistics for a policy (requires authentication)
  - `POST /api/feedback/suggestions/:id/apply` - Apply a tuning suggestion (requires authentication; userId must be provided and valid; acting user is derived from authenticated context)
  - `POST /api/feedback/suggestions/:id/reject` - Reject a tuning suggestion (requires authentication; userId must be provided and valid; acting user is derived from authenticated context)
  - `POST /api/feedback/analyze-all` - Run analysis for all active policies (requires authentication)
- **Integration:** Registered feedback router in `server/src/routes/api.js`
  - **Note:** These endpoints should be protected with JWT auth middleware and admin-level authorization where appropriate in production deployments

#### Classification Integration
- **Updated:** `server/src/services/classification.js` to integrate PolicyEngine
  - Added as Step 3.5 in decision tree (after high-confidence matches, before legacy signals)
  - Auto-classifies when policy confidence meets threshold (default 85%)
  - Stores policy results for AI verification when confidence is medium (60-84%)
  - Falls back gracefully to legacy signal-based classification if policy evaluation fails
  - Logs policy decisions for observability

#### Testing
- **New test suite:** `server/src/__tests__/integration/policyEngine.test.js` with 27 comprehensive tests
  - **Core functionality:** Policy retrieval, authoritative signals, policy evaluation
  - **Signal scoring:** All 9 signal types tested (certifications, genres, keywords, studios, year, rating, runtime, language, media_type)
  - **Preset evaluation:** Weight handling, signal combination, media type filtering
  - **End-to-end:** Full pipeline evaluation, authoritative matching, action determination
  - **Result processing:** Ranking by score, filtering zero scores, action thresholds
  - All 27 tests passing with PostgreSQL testcontainer integration

### Database Schema (from PRs #105, #106, #107)

#### Database Schema (Migration 042)
- **`library_policies` table:** Core policy definition with multi-policy support per library
  - Policy-level thresholds (auto-classify, prompt, AI validation)
  - Trust settings for patterns, RAG, and history
  - Weight overrides (preset, pattern, RAG, history)
  - Multi-policy combination modes (best_match, weighted_average, consensus)
  - Source library linking (JSONB array of Plex/Emby/Jellyfin library IDs)
  - Notification channel configuration (JSONB)
- **`content_presets` table:** Reusable content signal definitions
  - System and user-defined presets
  - JSONB signal configuration for flexible schema
  - Category-based organization
  - Usage tracking and display ordering
  - GIN index on signals for efficient querying
- **`policy_presets` table:** Junction table linking policies to content presets
  - Per-preset weight adjustments
  - Unique constraint ensuring no duplicate preset assignments
- **`policy_overrides` table:** Advanced per-policy signal tweaks
  - Signal-type specific override configuration (JSONB)
  - Reason tracking for audit purposes
- **`policy_feedback_log` table:** Decision capture for learning
  - User prompt responses and corrections
  - Original scores and top suggestions
  - Pattern creation tracking (JSONB)
  - Signal analysis storage (JSONB)
  - Response time metrics
  - Indexed on TMDB ID, library, policy, date, and correction status
- **`policy_tuning_suggestions` table:** AI-generated policy improvement recommendations
  - Supporting feedback IDs (integer array)
  - Confidence and impact estimates
  - Status tracking (pending, approved, rejected)
  - Review metadata
- **`policy_learning_stats` table:** Aggregate policy performance metrics
  - Decision counts (total, auto, AI-validated, prompted, corrections)
  - Accuracy rates (overall, auto-only, 7-day, 30-day)
  - Trend indicators
  - Unique constraint on policy_id (one stats record per policy)
- **`source_library_policy_links` table:** Media server library to policy mapping
  - Links Plex/Emby/Jellyfin libraries to classification policies
  - Auto-generation and confidence tracking
  - Unique constraint on source + policy combination
- **`policy_change_log` table:** Audit trail for policy modifications
  - Change type categorization
  - Before/after metrics (JSONB)
  - User attribution
  - Indexed on policy, change type, and date

#### Schema Enhancements
- **Deprecation support in `library_custom_rules`:**
  - Added `deprecated` boolean column (default false)
  - Added `migrated_to_policy_id` foreign key to `library_policies`
  - Index on `deprecated` column for efficient filtering
- **Comprehensive indexes:**
  - Standard B-tree indexes on foreign keys and frequently queried columns
  - GIN indexes on JSONB columns for efficient JSON querying
  - Multi-column indexes for common query patterns
- **Foreign key cascades:**
  - ON DELETE CASCADE for all policy-related tables
  - Ensures data integrity when policies or libraries are deleted

#### Testing
- **New test suite:** `feedback-analysis.test.js` with comprehensive integration tests
  - **recordFeedback:** Validates feedback recording with all metadata fields
  - **updateLearningStats:** Tests accuracy calculations, trend detection, and stats aggregation
  - **detectFailurePatterns:** Tests false positive detection, threshold issue identification
  - **analyzeSignalEffectiveness:** Validates signal accuracy calculations
  - **detectNewPatterns:** Tests pattern discovery from user corrections
  - **generateSuggestions:** Validates suggestion generation for all types
  - **storeSuggestions:** Tests database persistence and duplicate prevention
  - **getPendingSuggestions:** Validates suggestion retrieval
  - **applySuggestion:** Tests threshold adjustments, weight adjustments, and change logging
  - **rejectSuggestion:** Validates suggestion rejection workflow
  - **analyzePolicy:** Tests full policy analysis pipeline
  - **runFullAnalysis:** Tests multi-policy batch analysis
- **New test suite:** `policy-schema.test.js` with 33 comprehensive integration tests
  - Table existence verification for all 9 new tables
  - Column presence and data type validation
  - Index verification (including GIN indexes on JSONB columns)
  - Foreign key constraint validation with CASCADE behavior
  - Unique constraint verification
  - JSONB operations testing (insert and query with complex objects)
  - Array column type verification (integer arrays)
  - Deprecation column validation on existing tables
  - Test data setup in beforeAll hook to ensure test preconditions
- **Test results:** All 33 new tests passing + all 11 existing schema tests passing
- **Integration test setup enhancements:**
  - Migrations automatically applied during test setup
  - Improved error handling to distinguish between critical and expected failures
  - Known optional failures (e.g., pgvector extension) gracefully skipped
  - Critical migration failures now properly abort test suite

### Fixed
- **SQL syntax error:** Corrected UNIQUE constraint placement in `policy_learning_stats` table (moved before REFERENCES)
- **Test reliability:** Added explicit assertions to prevent tests from silently passing when preconditions aren't met
- **Migration error handling:** Enhanced to fail fast on critical errors while allowing expected optional failures

### Changed
- Migration numbering: New migration is `042_policy_driven_schema.sql` (follows `041_formula_engine_weights.sql`)

### Technical Details
- All new tables use `TIMESTAMP WITH TIME ZONE` for proper timezone handling
- JSONB columns for flexible schema evolution
- Idempotent migration using `IF NOT EXISTS` for all DDL statements
- Comprehensive inline documentation via SQL comments
- Follows existing migration patterns and conventions

#### Content Presets Seed Data (Migration 043)
- **46 system content presets** covering all major classification categories:
  - **Audience (4 presets):** family_friendly, kids_only, teen, adult_only
  - **Genre (15 presets):** animated, anime, action_adventure, comedy, horror_scary, drama, romance, scifi, fantasy, documentary, crime_mystery, western, musical, sports, war
  - **Temporal (5 presets):** classic_films, golden_age, 80s, 90s, recent_releases
  - **Quality (2 presets):** highly_rated, hidden_gems
  - **Franchise (7 presets):** marvel_mcu, dc_universe, star_wars, disney, pixar, ghibli, dreamworks
  - **Regional (5 presets):** hollywood, british, bollywood, korean, foreign
  - **Seasonal (2 presets):** christmas_holiday, halloween
  - **TV-Specific (6 presets):** tv_sitcom, tv_drama, tv_reality, tv_animated, tv_anime, tv_miniseries

#### Content Presets Expansion (Migration 044)
- **Expanded from 46 to 168 system content presets** covering all real-world classification scenarios:
  - **Audience (+4 new, 8 total):** kids_older, young_adult, date_night, background
  - **Genre Core (+5 new):** action, thriller, mystery, history, biographical
  - **Genre Subgenres (+25 new):** action_comedy, romantic_comedy, dark_comedy, standup, horror_comedy, slasher, psychological_horror, supernatural, monster, zombie, vampire, psychological_thriller, spy, heist, disaster, martial_arts, noir, cyberpunk, space_opera, post_apocalyptic, dystopian, superhero, courtroom, medical, political
  - **Genre Special Interest (+15 new):** true_crime, nature, science, travel, food, music_doc, art_culture, faith_spiritual, educational, conspiracy, sports_doc, concert, behind_scenes, interview, essay
  - **Franchise (+18 new, 25 total):** illumination, sony_animation, laika, blue_sky, marvel_other, star_trek, harry_potter, lotr, james_bond, fast_furious, jurassic, monsterverse, conjuring, a24, blumhouse, neon, searchlight, focus
  - **Temporal (+7 new, 12 total):** silent_era, new_hollywood, 2000s, 2010s, 2020s, retro, modern
  - **Quality (+8 new, 10 total):** critically_acclaimed, popular, cult_classic, award_winners, indie, blockbuster, underrated, so_bad_good
  - **Seasonal (+6 new, 8 total):** thanksgiving, valentines, easter, new_years, summer, winter
  - **Regional (+20 new, 25 total):** english, australian, canadian, japanese, chinese, hong_kong, taiwanese, indian, spanish, latin_american, mexican, brazilian, french, german, italian, scandinavian, russian, turkish, thai, arabic
  - **TV-Specific (+14 new, 20 total):** tv_procedural, tv_soap, tv_anthology, tv_variety, tv_talk, tv_game, tv_news, tv_kids, tv_dating, tv_cooking, tv_true_crime, tv_late_night, tv_daytime, tv_documentary
- **Rich JSONB signal configuration** for each preset:
  - Certifications (ratings): mode-based filtering (include/exclude/max) with G, PG, R, TV-MA, etc.
  - Genres: prefer, require_any, require_all, exclude with configurable weights
  - Keywords: prefer, require_any, exclude for content matching
  - Studios: studio-based filtering (Marvel Studios, Pixar, BBC, etc.)
  - Release year ranges: min/max year filtering with weights
  - Vote average (TMDB ratings): min/max rating thresholds
  - Runtime: episode/movie length filtering (min/max minutes)
  - Language: ISO 639-1 codes (en, ja, ko, hi, etc.) with prefer/require/exclude
  - Media type: movie vs TV filtering
- **Idempotent migration** using `ON CONFLICT (key, user_id) DO UPDATE` for safe re-runs
- **GIN index optimization** for efficient JSONB queries on signals column
- **Display ordering** by category with logical grouping (1-4, 10-24, 40-44, etc.)

#### Testing
- **Updated test suite:** `content-presets.test.js` now validates 168 system presets
  - All 74 tests passing (30 original + 2 updated for new display_order ranges)
  - Verification of 168 total system presets (46 original + 122 new)
  - Category-wise preset count validation updated:
    - Audience: 8 (4 original + 4 new)
    - Genre: 60 (15 original + 45 new across core, subgenres, and special interest)
    - Temporal: 12 (5 original + 7 new)
    - Quality: 10 (2 original + 8 new)
    - Franchise: 25 (7 original + 18 new)
    - Regional: 25 (5 original + 20 new)
    - Seasonal: 8 (2 original + 6 new)
    - TV: 20 (6 original + 14 new)
  - Display order range validation updated (1-8 for audience, 10-70 for genre)
  - All JSONB signal validation, query operations, and idempotency tests continue to pass

### Related
- Closes #91 (Policy-Driven Schema Implementation)
- Closes #95 (Content Presets Seed Data)
- Part of #82 (v0.37.0 Formula-Based Classification Engine Epic)
- Related to #92 (Policy Engine will consume these presets)

## [0.36.3a-alpha] - 2026-01-07

### Fixed
- **CI/CD Pipeline:** Fixed test failures in `mediaServer.test.js` caused by missing mock for `DELETE FROM classification_history`
- **Test Mocks:** Updated test mocks to align with cascading delete sequence implemented in v0.36.3-alpha
- No production code changes—only test infrastructure updates

## [0.36.3-alpha] - 2026-01-07

### Fixed
- **CI/CD Pipeline:** Fixed 77+ consecutive test failures in `mediaServer.test.js`
- **Test Mocks:** Updated test mocks to match cascading delete query sequence from v0.36.1 and v0.36.2
- **Classification History FK (Insert):** Fixed violation when library is deleted during task processing (Queue tasks verify library exists)
- **Classification History FK (Delete):** Fixed violation when clearing libraries during sync (Clear history before libraries)
- All 377 tests now passing (added 1 new regression test)

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

[0.36.3-alpha]: https://github.com/cloudbyday90/Classifarr/compare/v0.36.2-alpha...v0.36.3-alpha
[0.36.2-alpha]: https://github.com/cloudbyday90/Classifarr/compare/v0.36.1-alpha...v0.36.2-alpha
[0.36.1-alpha]: https://github.com/cloudbyday90/Classifarr/compare/v0.36.0-alpha...v0.36.1-alpha
[0.36.0-alpha]: https://github.com/cloudbyday90/Classifarr/compare/v0.35.0-alpha...v0.36.0-alpha
[0.35.0-alpha]: https://github.com/cloudbyday90/Classifarr/compare/v0.34.0-alpha...v0.35.0-alpha
[0.34.0-alpha]: https://github.com/cloudbyday90/Classifarr/compare/v0.33.0-alpha...v0.34.0-alpha
[0.33.0-alpha]: https://github.com/cloudbyday90/Classifarr/compare/v0.32.0-alpha...v0.33.0-alpha
[0.32.0-alpha]: https://github.com/cloudbyday90/Classifarr/compare/v0.31.0-alpha...v0.32.0-alpha
[0.31.0-alpha]: https://github.com/cloudbyday90/Classifarr/releases/tag/v0.31.0-alpha
