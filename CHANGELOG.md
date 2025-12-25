# Changelog

All notable changes to Classifarr will be documented in this file.

This project uses [Semantic Versioning](https://semver.org/) for releases.
Current stage: **Alpha** (v0.x-alpha)


## [0.30.4-alpha] - 2025-12-25

### Added
- **Library Mappings Integration:** Library mappings now embedded in Radarr/Sonarr settings (removed standalone tab)
- **Path Configuration Guide:** Collapsible Docker path mapping guide in *arr settings

### Changed
- **SSL Toggle UX:** Disabled and greyed out when protocol is HTTP with explanatory text
- **Settings Navigation:** Removed standalone "Library Mappings" and "Path Testing" tabs

### Fixed
- **Media Server Dropdown:** "Associated Media Server" dropdown now populates correctly
- **API Key Test Connection:** Test connection now works after page refresh (resolves masked tokens from database)

## [0.30.3-alpha] - 2025-12-25

### Changed
- **Queue Settings UX:** Save Settings button moved to separate row, Clear buttons show counts and are disabled when empty

### Fixed
- **Queue Settings:** Fixed JSON parsing error when saving queue settings
- **API Client:** Added category-based settings endpoints for queue, scheduler, classification

## [0.30.2-alpha] - 2025-12-25

### Improvements
- **Release Process:** GitHub CLI prioritized for creating releases with turbo auto-run

## [0.30.1-alpha] - 2025-12-25

### Improvements
- **Docker Volumes:** Updated media mounts to read-write for future direct file moves
- **Release Process:** Updated release.md to not use pre-release for alpha versions

### Fixes
- **Documentation:** README docker examples now include media volume mount

## [0.30.0-alpha] - 2025-12-25

### New Features
- **Re-Classification System:** Foundation for moving media between *arr root folders
  - `reclassificationService.js` with execute, preview, and rollback support
  - Media type isolation (movies → Radarr only, TV → Sonarr only)
- **Library Mapping System:** Map Plex libraries to *arr root folders
  - `libraryMappingService.js` with auto-detection
  - `LibraryMappings.vue` UI in Settings → Media Sources
- **Path Testing:** Verify Docker path accessibility
  - `pathTestService.js` with health checks
  - `PathTest.vue` UI in Settings → System → Path Testing
- **Learned Corrections:** User corrections inform future classifications
  - `checkLearnedCorrections()` in classification chain (100% confidence)
- **New API Endpoints:**
  - `POST /api/classification/reclassify` - Execute re-classification
  - `POST /api/classification/reclassify/preview` - Preview
  - `POST /api/settings/path-test` - Test path accessibility
  - `GET /api/settings/path-test/health` - Health check

### Database Changes
- New tables: `library_arr_mappings`, `learned_corrections`, `app_settings`
- New columns: `media_server_id` in `radarr_config` and `sonarr_config`

### Notes
- SetupBanner disabled pending bug fixes in future minor release

## [0.27.9-alpha] - 2025-12-25

### Bug Fixes
- **AI Suggestions:** Fixed AI suggesting duplicate rules that already exist
  - AI prompt now includes existing rules so it knows what's already applied
  - Added server-side fallback filter to remove any duplicates AI might still suggest

## [0.27.8-alpha] - 2025-12-25

### UX Improvements
- **Pattern Suggestions Widget:** Removed dismiss (X) button from library tiles
  - Users must now review patterns in Rule Builder and dismiss individually
  - Prevents accidentally hiding libraries without reviewing available filters
  - Widget count updates automatically as patterns are dismissed or applied in Rule Builder

## [0.27.7-alpha] - 2025-12-25

### Bug Fixes
- **Pattern Suggestions Widget:** Fixed "New Pattern Suggestions" widget showing nothing after sync
  - `clearAndResync()` now calls `runPatternAnalysis()` to populate `library_pattern_suggestions`
  - Dashboard widget now shows all libraries with available patterns after Clear & Re-Sync

## [0.27.6-alpha] - 2025-12-25

### Bug Fixes
- **Pattern Suggestions:** Fixed pattern analysis only running for one library
  - Changed `sync_enabled` to `is_active` - column didn't exist, so only first library was analyzed
  - All libraries now show in "New Pattern Suggestions" widget on Dashboard
- **Clear & Re-Sync All:** Now clears `library_pattern_suggestions` table
  - Available Library Filters are now properly reset during full resync

## [0.27.5-alpha] - 2025-12-25

### Bug Fixes
- **Health Status:** Fixed Activity page always showing "Partial" instead of "All Systems OK"
  - Frontend was checking `health.ollama` but backend returns `health.ai`
  - Added safeguard to merge API response with defaults to prevent silent field name mismatches

## [0.27.4-alpha] - 2025-12-25

### Bug Fixes
- **Library Sync:** Fixed Plex sync wiping enrichment progress (OMDb/Tavily data)
  - UPSERT now merges metadata instead of replacing it entirely
  - Existing `omdb`, `tavily_*` fields preserved during re-sync
- **Duplicate Classifications:** Fixed same title appearing 81+ times in statistics
  - Added duplicate check before inserting classification_history entries
  - Re-sync no longer creates duplicate `source_library` records

## [0.27.3-alpha] - 2025-12-25

### Bug Fixes
- **Model Persistence:** Fixed cloud provider model selection disappearing after page refresh
  - Model dropdown now seeds with saved model on load (same pattern as Ollama)
  - Affects OpenAI, Gemini, OpenRouter, LiteLLM, and Custom providers

## [0.27.2-alpha] - 2025-12-25

### Bug Fixes
- **OpenAI API Keys:** Fixed authentication errors when switching to OpenAI from other providers ([#68](https://github.com/cloudbyday90/Classifarr/issues/68))
  - `getEndpoint()` now only uses custom endpoints for LiteLLM/custom providers
  - OpenAI, Gemini, and OpenRouter always use their official hardcoded endpoints
  - Prevents stale endpoint configuration when switching between providers

## [0.27.1-alpha] - 2025-12-25

### Bug Fixes
- **Correction Submission:** Fixed "l.post is not a function" error when submitting corrections in History view ([#67](https://github.com/cloudbyday90/Classifarr/issues/67))
  - Changed incorrect `api.post()` call to use the existing `api.submitCorrection()` method

## [0.26.2-alpha] - 2025-12-25

### Bug Fixes
- **Dashboard AI Status:** Fixed "Offline" indicator showing incorrectly when AI provider was configured and working
- **Consistent AI Naming:** Renamed all Ollama-specific references to generic "AI Provider" throughout the codebase

### Technical Details
- Fixed `queueService.getStats()` to return `aiAvailable` instead of the renamed `ollamaAvailable`
- Updated Dashboard, Queue views, system health endpoint to use `ai`/`aiAvailable` field names

## [0.26.1-alpha] - 2025-12-25

### Bug Fixes
- **Ollama Test Connection:** Test now uses input field values instead of cached DB values (fixes Issue #66)
- **AI Provider Selection:** Queue now respects configured provider - users can switch to OpenAI without Ollama blocking

### Improvements
- **Simplified Defaults:** Ollama default is now `localhost` - removed complex gateway detection logic
- **Cleaner Code:** Removed ~60 lines of platform-specific detection code


## [0.25.0-alpha] - 2025-12-24

### Major Features
- **Smart "Use This" Pattern Builder:** Interactive UI to build rules directly from your library's metadata (Phase 2).
  - Analyzes Genres, Content Ratings, Studios, Collections, and Tags directly from Plex/Emby/Jellyfin.
  - Interactive selection modal with operators (equals, is one of, contains).
  - Shows match confidence and item counts for each pattern.
- **Continuous Pattern Analysis:** Automated system to detect new metadata trends over time (Phase 3).
- **Dashboard Widget:** "New Pattern Suggestions" widget notifies you when new potential rules are detected in your libraries.
- **Scheduler Update:** Added "Pattern Analysis" task type to automatically re-scan libraries for new patterns on a schedule.

### Improvements
- **UI Logic:** "Use This" now correctly prioritizes direct library metadata over AI suggestions.
- **Performance:** Optimized metadata queries to only fetch distinct values for pattern generation.


## [0.24.0-alpha] - 2025-12-24

### Major Features
- **Cloud AI Providers:** Support for OpenAI, Gemini, OpenRouter, LiteLLM.
- **Budget Controls:** Monthly limits and alerts for paid providers.
- **Hybrid AI Strategy:** Intelligent fallback to free local LLMs.
- **Database Migration Runner:** Automated SQL migration system running on startup to ensure consistent database schema.
- **Migration Tracking:** Added `schema_migrations` table to prevent re-running applied migrations.

### Fixes
- **Ollama Default Host:** Changed default host to `localhost` to better support unconfigured setups.
- **Model Persistence:** Seeding model dropdown ensures saved model is displayed on page load.
- **Migration Idempotency:** Fixed legacy migrations (003, 011-015) to use `IF NOT EXISTS` and `DO` blocks.

## [0.17-alpha] - 2025-12-21

### Platform Enhancement Summary
All 8 planned phases complete! This release consolidates:
- Manual Request Submission (Phase 3)
- Enhanced Dashboard (Phase 4)
- Statistics & Analytics (Phase 5)
- Scheduled Classifications (Phase 6)
- Import/Export Rules (Phase 7)
- Various bug fixes and optimizations

---

## [0.16.1-alpha] - 2025-12-21

### Bug Fix
- Fixed duplicate `webhookService` import causing startup crash

---

## [0.16-alpha] - 2025-12-21

### Phase 7: Import/Export Rules
- **Backup & Restore** - Settings → Backup tab
- **Export** - Download rules, patterns, schedules as JSON
- **Import** - Restore with preview and skip/overwrite modes
- Fixed webhook_log index referencing non-existent column

---

## [0.15-alpha] - 2025-12-21

### Phase 6: Scheduled Classifications
- **Scheduler** - Settings → Scheduler tab
- **Auto Scans** - Schedule library scans with intervals
- **Task Types** - Library Scan, Full Rescan
- **Intervals** - 30min, 1h, 2h, 6h, 12h, daily presets
- Run now, pause/enable, delete actions

---

## [0.14-alpha] - 2025-12-21

### Phase 5: Statistics & Analytics
- **Statistics Page** - New sidebar item
- **Summary Cards** - Total, avg confidence, high/low, 24h/7d
- **Daily Chart** - 30-day classification bar chart
- **Breakdowns** - By library, method, media type
- **Top Titles** - Most classified items

---

## [0.13-alpha] - 2025-12-21

### Phase 4: Enhanced Dashboard
- **System Status Row** - Ollama 🟢/🔴, queue pending, stats
- **Two-Column Layout** - Classifications + sidebar widgets
- **Queue Summary** - Pending/processing/completed/failed
- **Classification Methods** - Exact/learned/rule/AI breakdown
- **Quick Actions** - New Request, Libraries, Queue buttons

---

## [0.12.1-alpha] - 2025-12-21

### CI/CD Fix
- Updated docker-metadata-action for alpha tag support
- Changed from strict semver to ref-based tagging

---

## [0.12-alpha] - 2025-12-21

### Phase 3: Manual Request Submission
- **Manual Request Page** - New sidebar item to submit requests directly
- **TMDB Search** - Search movies and TV shows with poster previews
- **One-Click Classify** - Queue any TMDB result for classification
- **Recent Requests** - View status of your manual submissions

---

## [0.11-alpha] - 2025-12-21

### New Features
- **Queue Status UI** - New Settings → Queue tab showing:
  - Ollama availability indicator (green/red)
  - Task counts: pending, processing, completed, failed
  - Pending task list with retry/cancel actions
  - Auto-refresh every 5 seconds

- **Multi-Source Manager UI** - Settings → Webhooks now shows:
  - List of all configured webhook sources
  - Add new source with name and type
  - Set Primary / Delete actions
  - Type icons: Overseerr (🎬), Jellyseerr (🍇), Seer (⭐)

---

## [0.10-alpha] - 2025-12-21

### 🎉 Initial Public Alpha

This is the first consolidated alpha release of Classifarr, an AI-powered media classification platform for the *arr ecosystem.

### Core Features
- **AI Classification Engine** - Multi-stage matching: exact → learned → rule → AI fallback
- **Ollama Integration** - Local LLM for privacy-first classification
- **Embedded PostgreSQL** - Single-container deployment with built-in database
- **Vue 3 Frontend** - Modern dark theme matching *arr ecosystem

### Media Server Support
- Plex (OAuth + manual connection selection)
- Jellyfin (API key authentication)
- Emby (API key authentication)

### Request Manager Support
- Overseerr
- Jellyseerr
- Seer (unified successor)
- Multi-manager support (run multiple simultaneously)

### Queue System
- Database-backed task queue
- Ollama offline resilience (tasks persist until Ollama available)
- Exponential backoff retry: 30s → 1m → 2m → 5m → 10m
- Max 5 retries before permanent failure

### Discord Integration
- Real-time classification notifications
- Interactive correction buttons
- In-app setup wizard

### Additional Features
- JWT-based authentication
- Confidence thresholds with AI clarification
- Learning system that improves from corrections
- TMDB/TVDB metadata integration
- Comprehensive logging with database persistence

---

## Version History

Prior to v0.10-alpha, development releases were numbered v1.0.0 - v1.8.0.
These have been consolidated into this alpha release for clearer versioning.
