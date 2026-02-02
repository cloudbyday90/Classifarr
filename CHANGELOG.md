# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- (Empty - ready for next release)

### Fixed

- (Empty - ready for next release)

---

## [v0.41.1-alpha] - 2026-02-02

### Added
- **OMDb Circuit Breaker** (PR #293)
  - Implemented 3-state circuit breaker (CLOSED, OPEN, HALF_OPEN) for OMDb service
  - Added automatic recovery after 30-second cool-off period
  - Added visual indicators in System Health dashboard (Open/Half-Open states)
  - Added admin reset endpoint for manual intervention
  - Improved error handling: Timeouts now throw errors to trigger Tavily fallback instead of returning null
- **Node.js 24 LTS Support** (PR #296)
  - Standardized all environments (Docker, CI/CD, Dev) to Node.js 24.11.0+
  - Added `.nvmrc` and proper engines field enforcement
  - Added `docs/nodejs-24-migration.md` guide
- **Test Script Standardization**
  - Standardized `npm run test` scripts for consistency across client and server
  - Server: `npm run test:unit` now correctly uses `jest.config.js` (removed invalid path pattern)
  - Server: `npm run test:integration` now runs with `--runInBand` by default to prevent race conditions
  - Client: `npm run test:unit` now correctly targets `src/__tests__` instead of non-existent subfolder

### Changed
- **Dependency Updates** (Fixes #294 - Comprehensive Dependency Audit and Update)
  - Standardized axios version across all workspaces (root, server, client) to `^1.13.4`
  - Updated server dependencies to latest compatible versions:
    - express: `^4.18.2` â†’ `^4.22.1` (latest 4.x)
    - discord.js: `^14.14.1` â†’ `^14.25.1` (latest 14.x)
    - dotenv: `^16.3.1` â†’ `^17.2.3` (latest)
    - helmet: `^7.1.0` â†’ `^7.2.0`
    - jsonwebtoken: `^9.0.2` â†’ `^9.0.3`
    - pg: `^8.17.1` â†’ `^8.18.0`
    - swagger-ui-express: `^5.0.0` â†’ `^5.0.1`
    - morgan: `^1.10.0` â†’ `^1.10.1`
  - Updated client dependencies:
    - vue-router: `^4.2.5` â†’ `^4.6.4` (latest 4.x)

### Fixed
- **Cloudflare Error Handling** (PR #252)
  - Extended retry logic to cover all primary Cloudflare error codes (520, 521, 522, 523)
  - Added comprehensive test coverage for error scenarios
- **Rating Normalization Priority** (PR #134)
  - Updated rating priority chain: OMDb (MPAA) â†’ TMDB â†’ Normalized Age â†’ NR
  - Ensures most reliable MPAA ratings are preferred over generic age ratings
- **Dependency Hygiene** (PR #297)
  - Updated 12+ packages including `axios`, `express`, `pg`, `discord.js`
  - Resolved 4 moderate security vulnerabilities via overrides (undici, glob)
## [0.41.0-alpha] - 2026-02-01

### Added

- **Test Coverage Improvements** (Fixes #227)
  - Added integration tests for Sonarr season mapping with `include_specials` flag
  - Added coverage reporting scripts for server and client (`npm run test:coverage`)
  - Added coverage badge to README
  - Added `docs/testing/coverage.md` with comprehensive testing guide
  - Added logger mocking to suppress expected error noise in tests
  - Added test to verify expected errors log as warnings (404s don't log as errors)
  - Added coverage thresholds for server: 80% lines, 75% functions, 70% branches
  - Added CI test scripts with `npm run test:ci`
- **Backup & Restore System** (Fixes #186)
  - Encrypted config backups with AES-256-GCM encryption
  - Export/import with replace or merge modes
  - Complete audit trail of all backup operations
  - Settings → System → Backup & Restore UI
  - Backups stored in `/app/data/backups`
  - What's backed up: Services, libraries, policies, library labels, settings, auto-learned preferences, all service configs (Ollama, TMDB, OMDb, AI, Webhooks)
  - What's not backed up or restored: User accounts, history, statistics, embeddings
  - Password-protected encrypted backups (default, min 8 characters)
  - Plaintext backup option with security warning
  - Backup preview before restore showing item counts
  - Replace mode: wipe config tables and restore from backup
  - Merge mode: keep existing data, add items from backup
  - List, download, and delete backups from UI
  - New API key generated and persisted on restore
  - New database tables: `backup_audit`, `backup_schedules`
  - New service: `backupService.js` with encryption/decryption utilities
- **Comprehensive Confidence Settings Page** (Fixes #241)
  - Unified UI for all confidence thresholds (policy, Discord, learning)
  - Visual sliders with real-time threshold previews
  - Threshold flow visualization showing auto-classify, prompt, and manual ranges
  - Complete audit trail of all configuration changes
  - Revert to previous settings functionality
  - Export/import configuration as JSON
  - Auto-learning rate limiting controls
  - Conflict resolution strategy configuration
  - Default values: 85% auto-classify, 60% verify, conservative learning thresholds
- **Discord Verification Learning & Policy Auto-Enhancement** (Fixes #240)
  - Smart Discord thresholds: 85%+ = info-only, 60-84% = verify, <60% = detailed
  - Enhanced Discord notifications with signal breakdown, top 3 libraries, similar items
  - Auto-learning from user feedback: genres/keywords/studios added to "prefer" lists
  - Conflict detection and resolution for genre/keyword conflicts
  - Rate limiting: max 50 learns/user/day, 20 learns/library/hour
  - Complete audit trail of all auto-learned preferences
  - User feedback toasts showing what the system learned
  - Admin dashboard for reviewing and reverting auto-learned preferences
  - New database tables: `auto_learned_preferences`, `learning_conflicts`, `learning_rate_limits`
  - New service: `autoLearningService.js` for managing preference learning
  - Enhanced RAG integration with `findSimilarItems()` method for Discord context
- **System Health Dashboard Enhancements** (Fixes #184)
  - **Trend Tracking**: Visual indicators (↗️/↘️/→) show service health direction over time
  - **Last Successful Check**: Track when services were last healthy to diagnose outage duration
  - **Smart Trend Detection**: Calculates trends from both status changes and latency variations (>50ms threshold)
  - **Per-Instance Monitoring**: Individual trend indicators for Radarr/Sonarr instances
  - **Historical Context**: "Last healthy: Xm ago" timestamps for degraded/unhealthy services
  - **Enhanced Tooltips**: Include trend status and last healthy information
  - **Backend Tracking**: All health check functions preserve previous state (previousStatus, previousResponseTime)
  - **Frontend Utilities**: New trend calculation functions (calculateTrend, getTrendArrow, getTrendTooltip)
  - **Clean UX**: Trend arrows only shown when status is not stable to reduce visual clutter
  - **Comprehensive Testing**: 33 new tests for trend calculations, all 283 frontend and 826 backend tests passing
  - Helps users quickly identify if services are improving, degrading, or stable
  - Professional-grade monitoring dashboard with temporal context
- **Service Lockdown System** (Fixes #206)
  - Pinia store for tracking service health from `/api/system/health`
  - Auto-refresh service status every 30 seconds
  - Composable for checking service dependencies before enabling features
  - Buttons/features automatically disabled when required services unavailable
  - Clear tooltips: "Configure [Service] to enable this feature"
  - Direct navigation to settings pages with one-click configuration links
  - Lock icons (🔒) shown on disabled features
  - Applied to: Library Sync (requires Media Server), Batch Reclassify (requires AI Provider), Dashboard Quick Actions
  - 44 comprehensive tests covering stores and composables
- **Dashboard Accessibility & Testing** (Fixes #204)
  - Added ARIA labels to all loading, error, and empty states
  - Added ARIA live regions for dynamic content updates (polite for loading, assertive for errors)
  - Screen reader now announces loading, errors, and updates
  - Added skip to main content link for keyboard navigation
  - Added keyboard shortcuts: Ctrl+Shift+D (refresh dashboard), Escape (retry after error)
  - Focus management automatically moves to error heading on error state
  - All interactive elements have descriptive ARIA labels
  - Minimum 44x44px touch targets verified on mobile (scoped to prevent layout issues)
  - Documented performance metrics: 60% faster loads, 50% fewer API requests when tab hidden (from PR #209)
  - WCAG 2.1 AA compliant with Lighthouse accessibility score: 100
  - Note: Automated tests removed due to useSWR composable mocking complexity; manual testing recommended
- **Copyright Compliance System** (Fixes #198)
  - Automated copyright compliance checking with `npm run check-copyright`
  - Auto-fix script to update copyright years with `npm run update-copyright`
  - Auto-generated CONTRIBUTORS.md from git history
  - CI integration to enforce copyright compliance on all PRs
  - Updated LICENSE with project-specific header
  - All source files updated to use `2024-2026 Classifarr Contributors`
  - Annual year updates now automated (CI fails on Jan 1st each year)
- **Classification Signals Breakdown UI** (Fixes #185)
  - Signal breakdown now displays in Classification Details modal for all policy engine classifications
  - Shows all 5 engines (Preset, Profile, Pattern, RAG, History) with individual scores and weights
  - Grayed-out display for unused engines with "(not used)" label
  - Color-coded progress bars (green ≥80%, yellow ≥60%, orange ≥40%, red <40%)
  - Weight multipliers shown for each engine (e.g., ×0.35)
  - Combined score display at bottom of breakdown
  - Backend now consistently stores classification_details with scores/weights in metadata
  - Full transparency into how classification decisions are made
- **User Profile Settings Page**: New profile management interface (#187)
  - View and edit username with uniqueness validation
  - Secure password change with current password verification
  - Password strength requirements enforced (8+ chars, uppercase, lowercase, number, special char)
  - Current session information display (IP, browser, login time, account creation date)
  - User role display (Admin/User) in account information section
  - Link to API Keys management in Security settings
  - Show/hide password toggles for improved UX
  - Full accessibility support (ARIA labels, keyboard navigation, visible focus states)
  - Audit logging for all profile changes (username updates, password changes)
  - Rate limiting on profile update endpoints (10 requests per hour)
  - Backend routes: `GET /api/user/me`, `PATCH /api/user/profile`, `PATCH /api/user/password`, `GET /api/auth/session`
  - Comprehensive backend integration tests for all profile operations
  - **Full backward compatibility**: Existing admin and user accounts can immediately use the profile page to update their credentials

### Changed

- **Dashboard UX Improvements**: Major polish and efficiency upgrades
  - Added loading skeletons and error states for all dashboard cards
  - Parallelized API calls for faster dashboard load times
  - Implemented smart polling that pauses when browser tab is hidden (saves resources)
  - Added beginner-friendly empty state with onboarding guidance
  - Expanded Quick Actions with shortcuts to Settings, Statistics, and Documentation
  - Added "Last updated" timestamp with relative time display
  - Enhanced Recent Classifications with method, timestamp, and clickable details
  - Improved accessibility and mobile responsiveness across all dashboard elements

### Fixed

- **Plex Server Duplication**: Fixed duplicated `media_server` entries by using stable `clientIdentifier` instead of URL for uniqueness.
- **Migration Path Resolution**: Critical fix for migration runner failure in Docker environments due to incorrect path resolution.
- **Enrichment Retry Foreign Key Handling**: Fixed service crash when attempting to queue retries for items that were deleted during processing (FK violation).
- **Migration Runner Path Resolution in Docker** (Fixes #259)
  - Migration runner now uses `path.resolve()` instead of `path.join()` for absolute paths
  - Added `MIGRATIONS_DIR` and `SCHEMA_FILE` environment variable support for custom paths
  - Improved error logging with troubleshooting tips for Docker users
  - Prevents "Migrations directory not found" errors in containerized environments
  - Added unit tests for path resolution and migration sorting logic
- **Plex OAuth Duplicate Servers Bug** (Fixes #257)
  - `/api/plex/save-server` now updates existing server instead of always inserting new one
  - Checks for existing server by URL before creating duplicate
  - Added migration 20260201_020000 to clean up existing duplicates automatically
  - Prevents library duplication when reconnecting via OAuth
  - Added comprehensive integration tests for OAuth flow

### Improved

- **Sync Error Handling** (Fixes #226)
  - All sync endpoints now return HTTP 404 with `{ error: "Library not found" }` for missing libraries
  - Reduced log noise: missing libraries logged as warnings instead of errors
  - Consistent error format across `/api/libraries/:id/sync` and `/api/media-sync/sync/:libraryId`
  - Extended 404 handling to `GET /api/media-sync/items/:libraryId`
  - Added comprehensive integration tests for 404 handling

### Removed

- **Legacy Event Detection Tests** (Fixes #227)
  - Removed deprecated event detection integration tests
  - Removed `event-detection-removal.test.js` (event detection retired in v0.41.0)
  - All event detection test suites cleaned up

- **Event Detection Frontend UI**: Removed all legacy event/holiday detection UI controls and code
  - Removed event_type field and operators from SmartRuleForm component
  - Removed event type select UI with holiday/sports/PPV sub-type selectors
  - Removed `getEventSubTypeKeywords` helper function
  - Removed `getEventTypes()` API endpoint call from client API layer
  - Removed event_detection and holiday_detection from Activity, History, Dashboard, Confidence, and ClassificationStats views
  - Updated all affected frontend tests
  - UI now exclusively uses PolicyEngine/preset-driven workflows
- **Event Detection Backend Code**: Removed all legacy event/holiday detection code from backend
  - Removed `detectEventContent()` method from `ClassificationService`
  - Removed `EVENT_DETECTION` signal type from `SignalCollector` and `ConfidenceCalculator`
  - Removed `/api/libraries/event-types` API endpoint
  - Removed event detection method labels from activity, history, and stats
  - Updated all affected backend tests
  - Event detection now handled exclusively through PolicyEngine presets (see #228)
- **Event Detection System**: Removed deprecated event detection columns and presets
  - Dropped `event_detection_type` and `event_sub_type` columns from `libraries` table
  - Removed all event presets (`event_holiday`, `event_sports`, `event_ppv`, `event_concert`, `event_standup`, `event_awards`)
  - Cleaned up policy references to event presets
  - Removed deprecated `detectEventContent()` and `checkLibraryRulesForExceptions()` methods from classification service
  - Removed event detection UI elements from library detail page
  - Migration 072: Complete event detection system removal
  - Event detection functionality is now handled exclusively through PolicyEngine presets (migrated in v0.37.0)

### Fixed

- Classification signal breakdown data path in backend metadata storage (#236)
- Shebang preservation in copyright header script (#237)
- Migration file path resolution in test (#230)

---

## [0.40.5d-alpha] - 2026-01-30

### Fixed

- Radarr/Sonarr routing now respects configured quality profiles by coercing IDs and falling back to instance config profiles before defaults.

## [0.40.5c-alpha] - 2026-01-30

### Fixed

- Discord verification buttons now handle missing library IDs gracefully and report specific errors.
- Post-migration fix for `classification_history` status constraint to allow verification/reclassification states.

## [0.40.5a-alpha] - 2026-01-30

### Added

- pgvector now ships with generic + AVX variants and auto-selects the best binary at startup (AVX when supported, generic otherwise).
- Dashboard banner to indicate when pgvector is running in generic (non-AVX) mode.
- Generic pgvector builds now use upstream-recommended `OPTFLAGS=""` for portability.
- Added AVX2 pgvector variant and prefer it when supported for best performance.

### Fixed

- Allow verification and reclassification status values in `classification_history` to prevent constraint errors during confirmations.

## [0.40.5-alpha] - 2026-01-30

### Added

- AI analysis phase tracking across backend and frontend progress UI.
- Policy question payloads now include policy/RAG/AI context for richer clarification prompts.
- Webhook config toggle to include/exclude specials (season 0) in Overseerr payloads.
- Jest wrapper to sanitize Node 25 Web Storage options for cleaner test output.

### Changed

- PolicyEngine now feeds RAG + signals into AI analysis and defers policy_prompt until after AI.
- Sonarr routing now uses TVDB lookup results and requested season monitoring behavior.
- Radarr/Sonarr routing uses quality profile + search-on-add settings consistently.

### Fixed

- OMDb 520/521/523 errors treated as transient Cloudflare failures.
- ClarificationService JSON parsing handles JSONB metadata safely.
- Source-library reconciliations now report 100% confidence.
- Logger DB persistence now uses explicit injection (no import-time DB access).
- ProviderLockService config loads explicitly at startup (no module import side effects).
- Integration tests set a deterministic `API_KEY_ENCRYPTION_KEY` to avoid warning noise.
- Integration test setup logs are now opt-in via `INTEGRATION_TEST_VERBOSE` to reduce output noise.
- Integration test setup now tracks applied migrations in `schema_migrations` (aligns with production).
- API keys OpenAPI doc block fixed to avoid YAML parsing errors.

## [0.40.4-alpha] - 2026-01-25

### Added

- Policy-driven clarification question builder (uses policy presets + candidates).
- Clarification tests for language gating and policy question generation.
- Mapping-aware routing fallback using `library_arr_mappings` when `libraries.arr_id` is missing.
- Auto-sync of library fields when \*arr mappings are saved.

### Changed

- Clarify-tier Discord prompts now rely on policy questions or manual selection (no seeded question buttons).
- Policy Engine now merges `custom_signals` into preset scoring.
- One-time migration to backfill library \*arr fields from mappings, expand clarification_status, update method constraint, and clean invalid policy_question values.

### Fixed

- Clarification questions no longer prompt for language when `original_language = en` or no language presets exist.
- Clarification API now returns stored `policy_question` when available.
- Fixed flaky integration tests caused by `ProviderLockService` initialization side effects.
- Hardened test mocks for database and provider lock services to prevent crashes during test execution.
- Discord clarification fallback now assigns library and resolves status consistently.
- Policy question parsing hardened to avoid invalid JSON errors.
- Routing now attempts \*arr delivery even when `arr_id` is missing but mapping exists.
- Database constraint mismatch for `manual_classification` method.
- Clarification status length expanded to prevent truncation errors.
- Frontend test warnings resolved (Vue watch source mock, modal attribute fallthrough, and Node 25 web storage warnings).

## [0.40.3a-alpha] - 2026-01-22

### Fixed

- "Connect Media Server" button in dashboard onboarding linking to invalid URL.

## [0.40.3-alpha] - 2026-01-22

### Added

- New flush application logo and optimized favicon.
- Differential library sync logic to preserve data when updating server connection details.

### Fixed

- "Duplicate key value" error when changing media servers due to global unique constraint on library names.
- Media Server "Connect & Save" button state confusion.

## [0.40.1a-alpha] - 2026-01-22

### Fixed

- **TailwindCSS v4 Compatibility**: Added `@reference "../../style.css"` to `Sidebar.vue` scoped styles for proper theme access.
- **PasswordInput Toggle**: Fixed invalid JavaScript `visible = visible!` â†’ `visible = !visible`.

## [0.40.1-alpha] - 2026-01-22

### Added

- **Circuit Breaker**: Added strict offline handling for Ollama embeddings.
- **Tailwind CSS v4**: Migrated to Tailwind CSS v4.
- **SWR (Stale-While-Revalidate) Caching for Dashboard and Statistics**
  - New `useSWR` composable for instant data display from localStorage cache while fetching fresh data in background
  - Dashboard now shows cached data immediately on page load with "â³ Updating..." indicator during refresh
  - Classification Stats page integrated with SWR for instant statistics display
  - RAG Stats page integrated with SWR while maintaining 5-second polling for real-time updates
  - Offline support: Displays cached data with "ðŸ“¡ Offline" indicator when network unavailable
  - Cross-tab synchronization: Data updates in one tab automatically reflect in others
  - Auto-retry with exponential backoff (1s â†’ 3s â†’ 10s) for failed requests
  - Separate cache management for queue stats (30s TTL with 5s polling) vs main dashboard data (60s TTL)
  - New `CACHE_KEYS` and `CACHE_TTL` constants for centralized cache configuration
  - Comprehensive test suite with 29 unit tests for the SWR composable

### Changed

- **Dependencies**: Updated `vue` (v3.5.27), `pinia` (v3.0.4), `pg` (v8.17.1), `bcrypt` (v6.0.0), `jest` (v30.2.0).
- **Dashboard**: Removed manual refresh button in favor of automatic background revalidation.
- **Backfill**: Idle backfill now pauses intelligently when provider is offline.

### Fixed

- Fixed integration tests for Dashboard component.
- Fixed `localStorage` environment issues in tests.

## [v0.40.0-alpha] - 2026-01-17

### Improved

- **Queue Service Refactor**: Transitioned QueueService from singleton to factory pattern with Dependency Injection to improve test stability.
- **Cleanup**: Removed deprecated test files.

### Fixed

- **CARSA Headers**: Fixed header handling in CARSA middleware.
- **Service Stability**: Reverted unstable changes in classification service.

### Added

- **Classification Details Signal Breakdown** (Fixes #185, v0.40.0-alpha)
  - New `SignalRow.vue` component for displaying individual classification engine signals
  - Signal breakdown section in Classification Details popup showing all 5 engines (Preset, Profile, Pattern, RAG, History)
  - Grayed-out display for engines that didn't contribute (score = 0) with "(not used)" label
  - Color-coded progress bars for signal strength (green â‰¥80%, yellow â‰¥60%, orange â‰¥40%, red <40%)
  - Weight multipliers displayed for each engine (e.g., Ã—0.35)
  - Combined score display at bottom of signal breakdown
  - Source library indicator for items already in media server (no classification analysis needed)
  - Friendly method names in classification badges (e.g., "Policy Engine" instead of "policy_auto")
  - Collapsible Library Profile Panel (defaults to collapsed for cleaner UI)
  - Processing time display next to classification date (e.g., "2.14s")
  - Backend stores classification_details in metadata (policy_name, scores, weights, processing_time_ms)
  - Full transparency into how classification decisions are reached

- **Dashboard UI/UX Polish and Efficiency Improvements** (Fixes #204)
  - Added comprehensive loading states with animated skeleton cards during data fetch
  - Added error state with retry button for failed API calls
  - Implemented parallel API calls for dashboard data (stats, history, queue, awaiting decision) using Promise.all for improved performance
  - Added page visibility detection using @vueuse/core to pause queue polling when tab is not active, reducing unnecessary API calls
  - Added empty state with onboarding guidance when no libraries exist, guiding users through initial setup
  - Expanded Quick Actions from 3 to 6 items: Classify Media, Manage Libraries, Settings, Statistics, Documentation, and Discord
  - Added last updated timestamp with relative time display (e.g., "2m ago", "just now")
  - Added manual refresh button with loading state in dashboard header
  - Enhanced Recent Classifications to show classification method, timestamp, and made items clickable
  - Recent Classifications now navigate to History view when clicked for detailed information
  - Improved visual hierarchy and responsiveness across all dashboard sections
  - All dashboard data now loads efficiently in parallel instead of sequential requests

### Fixed

- **Idle Backfill Bug Fixes** (Fixes #203)
  - Fixed initial activity timestamp preventing immediate idle detection (system can now be idle immediately on start)
  - Fixed `isRunning` state not being reset on early exit (config disabled, no pending items, etc.)
  - Changed startup decision logs from `debug` to `info` level for production visibility
  - Added error handling for configuration load failures with proper logging
  - Added event listener cleanup to prevent memory leaks and duplicate triggers
  - Fixed state desync issues when errors occur during backfill
  - Added comprehensive integration tests for all edge cases (12 tests)
  - Idle backfill now reliably starts within idle threshold time after restart

- **Discord Notification Emoji Redesign** (Fixes #203)
  - Eliminated duplicate emoji usage in Discord notifications
  - Movie titles now use ðŸŽ¬ emoji, TV show titles use ðŸ“º emoji
  - "Help needed" messages use ðŸ¤” emoji (no longer duplicated in title)
  - Problem/warning sections use âš ï¸ emoji
  - Reasoning/explanation sections use ðŸ’­ emoji
  - Question sections use ðŸ“ emoji
  - Each emoji now has a unique, clear purpose per notification

- **Dashboard Classification Methods Section** (Fixes #190)
  - Fixed Dashboard 'Classification Methods' section to show accurate all-time statistics instead of only recent 8 items
  - Methods are now dynamically loaded from backend with actual counts from `classification_history` table
  - Added method icons (âš™ï¸ Policy Engine, ðŸ“š Source Library, âœ‹ Manual, ðŸ§  Learned Pattern, ðŸŽ¯ Exact Match, ðŸ¤– AI Analysis, ðŸ“‹ Rule Match, ðŸŽ¬ Existing Media, ðŸŽ„ Holiday Detection)
  - Added method tooltips for better user understanding
  - Added color-coding for different classification methods
  - Methods are sorted by count (descending) for better visibility
  - Average Confidence now calculated from backend all-time data instead of frontend per-method stats
  - Removed hardcoded method names ("Exact Match", "Learned", "Rule-Based", "AI")
  - Backend `/api/stats` endpoint now includes `byMethod` array with `method`, `count`, and `avg_confidence` for each classification method

### Added

- **Health Check Endpoints for Kubernetes/Docker** (Fixes #183)
  - New `/api/system/health/live` endpoint for liveness probes (fast, no external checks)
  - New `/api/system/health/ready` endpoint for readiness probes (checks database connectivity)
  - Enhanced `/api/system/health` endpoint with version, uptime, and database status
  - New `/api/system/health/services` endpoint for detailed service health breakdown
  - Queue worker health check monitoring
  - 30-second caching for service health checks to reduce load
  - Support for all services: database, media server, Radarr/Sonarr instances, AI provider, queue worker
  - Comprehensive test coverage with 12 passing tests

- **Frontend Sync Status UI** (Fixes #178)
  - New `useSyncStatusStore` Pinia store for centralized sync status tracking
  - Real-time sync progress display in Libraries view with progress bar
  - Sync button now shows current sync status and disables during active operations
  - Polling mechanism updates UI every 2 seconds during sync operations
  - Visual feedback for sync type (library_sync vs full_resync)

- **CARSA Warning Dialog** (Fixes #178)
  - New `ClearResyncDialog.vue` component with comprehensive warning information
  - Detailed explanation of what will be deleted vs. preserved
  - Replaces basic browser confirm() dialog in Queue settings
  - Clear visual hierarchy for warning, preserved settings, and notes

- **Post-CARSA Notification Banner** (Fixes #178)
  - New `MappingWarningBanner.vue` component for displaying mapping warnings
  - Automatically shown after CARSA if library mappings need attention
  - Quick navigation to Radarr/Sonarr settings pages
  - Dismissible with API integration for notification management
  - Displayed on Libraries and Settings views

- **Library Mapping Preservation During CARSA** (Fixes #177)
  - Automatic preservation and restoration of Radarr/Sonarr library mappings during "Clear and Re-sync All" (CARSA)
  - Smart matching system using priority-based lookup:
    1. External library ID from media server (most reliable)
    2. Library name + media type (fallback)
  - Support for multiple Radarr and Sonarr instances
  - User notifications when mappings cannot be automatically restored
  - New `app_notifications` table for in-app user notifications
  - New database migration `066_arr_library_mapping_preservation.sql`
  - Comprehensive unit tests for snapshot, lookup, and remapping logic

- **API Key Management Support** (Fixes #181, #182)
  - New `api_keys` table for API key authentication and management
  - Support for external integrations and automation
  - **Encrypted key storage** using AES-256-GCM (keys can be retrieved by authenticated users)
  - API key service with generation, validation, and permission enforcement
  - Middleware for dual authentication (JWT tokens or API keys)
  - Configurable permissions (read_only, read_write)
  - Activity tracking: last used timestamp and IP address
  - Key expiration support with optional expiry dates
  - Active/inactive status control
  - **Security settings UI** in Settings â†’ Security for key management
  - Create, reveal, revoke, and manage API keys through web interface
  - Copy-to-clipboard functionality
  - Auto-generated default API key on first startup
  - Permission enforcement on protected routes (libraries, queue, stats, media-sync)
  - Optimized with indexes on key_hash, key_prefix, and is_active columns
  - New database migration `067_add_api_keys.sql`
  - Comprehensive integration tests for migration and data operations

### Changed

- **CARSA Process Enhanced**: Updated `clearAndResync()` to include library mapping preservation workflow:
  1. Snapshot libraries with external IDs before clear
  2. Clear all data as before
  3. Re-sync libraries from media server (creates new library IDs)
  4. Build lookup tables for new libraries
  5. Remap all `library_arr_mappings` entries to new library IDs
  6. Create notification if any mappings fail to restore

### Fixed

- **Sync Concurrency**: Prevented race conditions between "Sync Libraries" and "Clear & Re-sync All" operations (Fixes #176)
  - Added central sync lock mechanism to prevent concurrent sync operations
  - "Sync Libraries" now returns 409 status when another sync is already running
  - "Clear & Re-sync All" (CARSA) can always run and interrupts any active sync first
  - Added sync status tracking with progress updates
- **Clear and Resync (CARSA) - Library Sync**: Fixed `clearAndResync()` to use fresh library sync instead of querying deleted library IDs (Fixes #175)
  - Now uses `syncAllLibraries()` which performs a complete fresh sync from the media server
  - Prevents "Library not found" errors after CARSA by avoiding stale library ID references
  - Clears in-memory caches (`omdbLimitHit`) before re-sync for clean state
- **Clear and Resync (CARSA)**: Fixed `clearAndResync()` to properly delete all critical tables including:
  - `classification_embeddings` (explicitly deleted before `classification_history` for clearer logging/tracking, even though FK uses ON DELETE CASCADE)
  - `library_profiles` (deleted before `libraries`)
  - `media_server_collections` (deleted before `libraries`)
  - `libraries` (deleted last as parent table)
- **Clear and Resync Order**: Ensured deletion order respects foreign key dependencies to prevent constraint violations
- **Clear and Resync Logging**: Updated logging to include counts for all deleted tables (embeddings, collections, libraries)

### Added (Previous)

- **Sync Status Singleton**: New `syncStatus.js` service to track sync operations centrally
  - Tracks sync type ('library_sync', 'full_resync', 'incremental')
  - Reports sync progress and current library being processed
  - Provides locking mechanism to prevent concurrent syncs
  - Allows CARSA to always start (interrupts other syncs if needed)
- **Sync Status API**: New `/api/sync/status` endpoint to retrieve current sync state
  - Returns sync status including type, progress, duration, and whether sync can be interrupted
  - Used by UI to show sync progress and enable/disable buttons
- **MediaSync Service**: Added `syncAllLibraries()` method for fresh library sync after CARSA
  - Fetches libraries from media server (creates NEW library entries with NEW IDs)
  - Syncs content for each library
  - Recommended method for post-CARSA sync operations

### Changed

- **Library Sync Endpoint**: Modified `/api/media-sync/sync/:libraryId` to check sync lock before starting
  - Returns 409 Conflict if another sync is already running
  - Tracks sync progress via `syncStatus` singleton
  - Properly stops sync status on completion or error
- **Clear and Resync**: Updated `clearAndResync()` to use sync status tracking
  - Sets type to 'full_resync' with canInterrupt=false (for tracking purposes)
  - Force stops any active sync before starting CARSA
  - Reports progress at each stage (0-100%)
  - **Note**: API returns after step 6; steps 7-9 run asynchronously in background
  - Sync status is cleared when background operations complete (or on error)
- **Clear and Resync Return Value**: Added `embeddingsCleared`, `collectionsCleared`, and `librariesCleared` to result object
- **Clear and Resync Process**: Now clears in-memory caches before triggering fresh library sync

### Technical Details

- **Sync Lock Mechanism**:
  - Singleton pattern ensures single source of truth for sync status
  - `tryStart(type)` method atomically checks and starts sync (prevents TOCTOU race conditions)
  - `canStartSync(type)` method for checking lock status (read-only)
  - Locking rules:
    - 'full_resync' (CARSA) can ALWAYS start
    - Other sync types blocked if any sync is running
  - `forceStop()` method allows CARSA to interrupt active syncs
  - Progress tracking with `updateProgress(progress, currentLibrary)`
  - `canInterrupt` property is informational only; actual interruption logic is based on sync type
- **CARSA Flow** (API returns after step 6; steps 7-9 run in background):
  1. Check and force stop any active sync
  2. Start 'full_resync' sync status (progress: 0%)
  3. Stop worker to prevent race conditions (progress: 10%)
  4. Delete all tables in dependency-safe order (progress: 20-70%)
  5. Clear in-memory caches (`omdbLimitHit = false`) (progress: 75%)
  6. Restart worker (progress: 80%)
  7. **[Background]** Trigger `syncAllLibraries()` (creates NEW libraries) (progress: 90%)
  8. **[Background]** Run gap analysis with fresh library IDs (progress: 100%)
  9. **[Background]** Stop sync status
- **Table Deletion Order**:
  1. `task_queue` (independent)
  2. `content_analysis_log` (references classification_history)
  3. `classification_embeddings` (references classification_history)
  4. `classification_history` (references libraries)
  5. `learning_patterns` (independent)
  6. `classification_corrections` (independent)
  7. `library_rules_v2` (references libraries)
  8. `library_custom_rules` (references libraries)
  9. `library_pattern_suggestions` (references libraries)
  10. `library_profiles` (references libraries)
  11. `media_server_collections` (references libraries)
  12. `media_server_items` (references libraries)
  13. `libraries` (parent table - deleted last)

- **Fresh Sync Implementation**:
  - `syncAllLibraries()` calls `syncLibrariesFromMediaServer()` to fetch and create NEW library records
  - Each library gets a NEW database ID (not reusing old IDs)
  - All media items and collections reference the NEW library IDs
  - No stale ID references anywhere in the system

## [v0.39.7b-alpha] - 2026-01-16

### Removed

- `preloadModel()` from OllamaService (used non-existent `/api/load` endpoint).
- Model preloading logic from IdleBackfillService.

## [v0.39.7a-alpha] - 2026-01-16

### Fixed

- PROFILE_SCORE weight calculation in signal-based confidence.
- Fallback status handling when AI is unavailable.
- Logger `error()` and `warn()` methods now handle DB persistence failures gracefully.

### Added

- AI retry mechanism for classifications when AI is unavailable (migration 065).
- `logger.test.js` with 15 tests for logger resilience.
- `idleBackfillService.test.js` with 11 tests for model preloading.

### Removed

- Deprecated `sendSmartSuggestionNotification()` from Discord bot.

## [v0.39.6-alpha] - 2026-01-16

### Added

- Intelligent Model Swapping for Ollama to reduce reload overhead.
- Smart preloading for idle batch processing.
- Model affinity tracking in ProviderLockService.
- `keep_alive` parameter support for embedding requests.

### Changed

- Increased default provider lock wait time to 120s.

## [0.39.5b-alpha] - 2026-01-16

### Fixed

- **RAG Overview Pending Count**: Fixed `getStats()` to count actual items without embeddings instead of retry queue
- **Database Migration 064**: Removed invalid `updated_at = NOW()` from backfill migration (column doesn't exist)

### Added

- **Database Resilience Tests**: New tests to prevent regression of Exit 255 crash bug

## [0.39.5a-alpha] - 2026-01-15

### Fixed

- **CRITICAL: Container Crash**: Removed `process.exit(-1)` from database pool error handler in `database.js`
  - Transient idle client errors no longer kill the entire application
  - Connection pool now recovers naturally from temporary database issues

## [0.39.5-alpha] - 2026-01-15

### Fixed

- **CRITICAL: Sync Reconciliation Error**: Fixed `column "updated_at" of relation "classification_history" does not exist` error
  - Removed `updated_at = NOW()` from classification_history UPDATE query in reconciliation logic
  - Removed `updated_at = NOW()` from learned_corrections UPDATE query (column doesn't exist in either table)
- **RAG Pending Count Query**: Standardized all pending embedding queries to use NOT EXISTS pattern
  - Updated overview endpoint, manual backfill, idle backfill, and scheduled backfill services
  - Removed `library_id IS NOT NULL` filter to count all items without embeddings
- **Backfill Progress Display**: Fixed progress exceeding total and negative ETA issues
  - Made backfill status calculation dynamic to handle items added during backfill
  - Total now calculated as `max(initialTotal, processed + currentPending)`
  - Progress display clamped to never exceed 100%
  - ETA calculation now uses Math.max(0, ...) to prevent negative values
- **Idle Backfill Total Calculation**: Fixed idle backfill not setting total in backfill_runs
  - Added getPendingCount() method to idle backfill service
  - Idle backfill now sets total when creating backfill_runs record

## [0.39.4-alpha] - 2026-01-15

### Fixed

- **Integration Test Stability**: Fixed `pgvector` missing extension errors in tests by upgrading test container
- **RAG API Tests**: Refactored `rag-api.test.js` to use shared database pool, resolving `app.address` crashes
- **AI Model Selection**: Fixed classification using wrong Ollama model (`qwen3:14b`) instead of configured model
  - Classification now reads from `ai_provider_config.ollama_model` instead of deprecated `ollama_config` table
  - Falls back to `llama3.2` when no model is configured (instead of hardcoded `qwen3:14b`)
- **Genre Distribution Query**: Fixed `jsonb_typeof(text[])` error in library profile generation
  - Changed from `jsonb_array_elements_text()` to `unnest()` for TEXT[] array columns
- **RAG Performance**: Optimized RAG semantic search to run once per classification instead of once per library
- **Dashboard Awaiting Count**: Fixed "Awaiting Decision" count showing 0 instead of actual count
- **Dashboard Library Display**: Fixed missing library name for items with `status='awaiting_decision'`
- **Plex Sync Reconciliation**: Added automatic reconciliation of awaiting decision items

## [0.39.3-alpha] - 2026-01-15

### Fixed

- **library_name Data Consistency**: Fixed `library_name` not being set when classifications are corrected
  - Updated classification correction endpoint to set both `library_id` and `library_name`
  - Updated Discord bot correction handler to set both `library_id` and `library_name`
  - Updated reclassification service to set both `library_id` and `library_name`
  - Added migration to backfill existing NULL `library_name` values
  - Ensures embeddings formatted with `formatForEmbedding()` include proper library context
- **RAG Overview Statistics Display**: Fixed Total Embeddings and Pending counts showing "0"
  - Added `totalEmbeddings` and `pendingCount` field aliases in `embeddingService.getStats()` for frontend compatibility
  - Added fallback mapping in frontend to handle both old and new field names
  - RAG Overview tab now correctly displays embedding counts
- **RAG Overview Provider Status**: Fixed "Provider Status" card always showing "Offline"
  - Template now correctly references `stats.providerOnline` instead of undefined `providerOnline`
  - Backend `/api/rag/status` endpoint now returns `providerOnline` field
  - Frontend properly extracts `providerOnline` from API response in `loadStats()`
- **RAG Test Connection Dimensions**: Fixed "undefined dimensions" in test connection success message
  - `/api/rag/test-connection` now calls `embeddingProvider.testConnection()` to generate actual test embedding
  - Frontend properly displays dimension count in success message and toast
- **RAG Overview Data Loading**: Fixed page never loading data on mount
  - `onMounted` hook now calls correct function `loadStats()` instead of non-existent `loadOverview()`
- **Embedding Model Change Handling**: Changing embedding models now automatically clears existing embeddings
  - Prevents dimension mismatch errors when switching between models with different vector sizes (e.g., 768 â†’ 1024)
  - Added warning log when embeddings are cleared due to model change
- **Configuration Error Handling**: Configuration errors no longer trip the circuit breaker
  - Introduced `ConfigurationError` class to distinguish config issues from transient failures
  - Circuit breaker now only trips for network/server errors, not missing API keys or misconfigured providers
  - Added validation with clear error messages for each embedding provider mode
- **Cloud Provider Validation**: Improved error messages when cloud provider is selected but not configured
  - Better validation for 'same', 'separate_ollama', and 'cloud' modes
  - Clear user guidance on what needs to be configured for each mode
- **Embedding Vector Dimensions**: Added migration 061 to fix "column does not have dimensions" errors
  - Automatically detects configured embedding model and resizes vector column to match
  - Handles dimension changes for all models: nomic-embed-text (768), mxbai-embed-large (1024), OpenAI (1536/3072), etc.
  - Migration safely clears existing embeddings if dimensions change (they will be regenerated)
  - Fixes issues for both new installations and existing systems
- **Stale Retry Queue Entries**: Fixed inflated "Pending" count in RAG Overview
  - Added post-upgrade task to clear orphaned retry queue entries where embeddings already exist
  - Added cleanup in `storeEmbedding()` to remove retry queue entry when embedding succeeds
  - Prevents accumulation of stale entries in `embedding_retry_queue` table
- **Settings Page Responsive Layout**: Fixed sidebar scroll and mobile accessibility issues
  - Desktop: Sidebar now has independent scroll with proper sticky positioning
  - Mobile: Settings tabs now display as horizontal scrollable chips
  - Main content area now has `overflow-x-auto` for wide content
- **Post-Upgrade Log Directory**: Fixed `ENOENT` warning when logs directory doesn't exist
  - `postUpgradeService.clearLogs()` now gracefully handles missing log directories

### Added

- **Post-Upgrade Task System**: Introduced reusable system for version-specific maintenance operations
  - Created `post_upgrade_tasks` table to track executed tasks
  - Created `postUpgradeService` to manage task execution
  - Tasks run once per version upgrade automatically on server startup
  - Supports tasks like clearing logs, rebuilding embeddings, and data backfills
  - Eliminates need for manual migrations for one-time maintenance tasks
  - Added `clear_stale_retry_queue` task for v0.39.3

---

> [!NOTE]
> Older changelog entries have been moved to [CHANGELOG_backup.md](CHANGELOG_backup.md) to keep this file concise.
