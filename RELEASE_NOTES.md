# Classifarr Release Notes

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
