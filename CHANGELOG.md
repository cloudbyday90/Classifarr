# Changelog

All notable changes to Classifarr will be documented in this file.

This project uses [Semantic Versioning](https://semver.org/) for releases.
Current stage: **Alpha** (v0.x-alpha)


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
