# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.39.0-alpha] - 2026-01-14

### Added
- **Embedding Provider Expansion**: Configurable embedding provider separate from classification provider
  - Support for dedicated Ollama instance (different host/port/model) for embeddings
  - Cloud provider support: OpenAI, Gemini, Voyage AI, OpenRouter, Cohere for embeddings
  - Per-provider model selection with smart defaults
  - Test connection functionality for all embedding providers
  - Database migration (054) for new embedding provider configuration fields
  - New `embeddingProvider` service for routing embeddings to appropriate provider
  - API endpoints: GET/PUT `/api/settings/embedding-provider`, POST `/api/settings/embedding-provider/test`
  - UI integration in AI settings with provider mode selector and conditional configuration fields
  - Backward compatible - existing 'same as classification' behavior preserved as default

### Changed
- **Embedding Architecture**: Refactored to use new `EmbeddingProvider` service
  - `embeddingRouter` now delegates to `embeddingProvider` for separate_ollama and cloud modes
  - Provider-agnostic embedding interface with support for parallel embedding generation
  - Enhanced embedding configuration UI with mode-specific settings

### Fixed
- **Pending Classifications API Crash**: Fixed `/api/classification/pending` throwing "is not valid JSON" error
  - `policy_question` column is JSONB in PostgreSQL (already parsed as object by pg driver)
  - Code was incorrectly calling `JSON.parse()` on an object, causing "[object Object] is not valid JSON" error
  - Now checks `typeof` before parsing to handle both string (legacy data) and object (current) formats
  - Ensures backward compatibility while preventing crashes on JSONB columns

- **Awaiting Decision Library Assignment**: Fixed items showing assigned library while awaiting user decision
  - Classifications with `awaiting_decision` status now have `library_id` and `library_name` set to NULL in database
  - Library only assigned after user makes decision via Discord buttons or Queue UI
  - Prevents misleading "Classified To: Anime Movies" display in history for pending items
  - UI now clearly shows "Awaiting Decision" status instead of premature library assignment
  - Discord notifications still show AI's suggested library for context, but database doesn't commit until decision made

- **Discord Clarification Prompts Missing**: Fixed items needing clarification not appearing in Discord
  - AI CLARIFY responses were missing `libraries` array in result object
  - Discord `createTieredComponents` couldn't create dropdown menu without libraries array
  - Now includes `libraries` array in CLARIFY responses (both AI clarification and fallback cases)
  - Discord notifications now correctly show clarification buttons AND library dropdown for manual selection

- **Discord Prompt Reliability**: Enhanced notification flow to ensure all clarification items trigger Discord prompts
  - Added comprehensive logging for notification attempts and failures
  - Errors are now properly logged instead of silently dropped
  - Discord notification wrapped in try-catch to prevent classification failures when Discord is unavailable
  - Enhanced `getTierForConfidence` with fallback tiers for all confidence ranges
  - Verified tier configuration covers all confidence ranges (50-100)

- **Awaiting Decision UI**: Platform queue now accurately displays all pending items
  - Queue based purely on database status, independent of Discord notification state
  - Count always matches actual `awaiting_decision` records in database
  - Items display with actionable status regardless of Discord prompt success/failure

- **Embedding Service Stale Configuration Cache**: Fixed embeddings using stale localhost configuration
  - `OllamaService.getConfig()` cached `baseUrl` on first call without invalidation mechanism
  - When user configured remote Ollama host (e.g., 192.168.50.95:11434), embeddings still used cached localhost:11434
  - Added `ollamaService.resetConfig()` call to ai_provider_config update endpoint
  - Cache now properly invalidated when user updates Ollama settings in UI
  - Maintains performance benefits of caching while ensuring configuration changes take effect immediately

### Technical Details
- Route `/api/classification/pending` now safely handles both string and JSONB formats for `policy_question`
- Classification service `logClassification` method conditionally sets `library_id` and `library_name` based on status
- When `status === 'awaiting_decision'`, both fields are NULL; when `status === 'completed'`, fields are populated
- Classification service `parseAIResponse` now includes `libraries` array in CLARIFY result objects
- Ollama service `getConfig()` maintains cache for performance, invalidated via `resetConfig()` when settings updated
- Classification service `sendConfidenceBasedNotification` call wrapped in try-catch with enhanced logging
- Discord notification errors logged with full context (classification_id, title, confidence, error stack)
- `getTierForConfidence` now provides fallback tiers for both low (<70) and high (>=70) confidence ranges
- Platform queue (`/api/classification/pending`) queries directly from `classification_history.status = 'awaiting_decision'`

## [0.38.4-alpha] - 2026-01-14

### Fixed
- **Quality Profile Dropdown Auto-Loading**: Fixed issue where quality profiles didn't load when editing existing Radarr/Sonarr configurations
  - Clicking "Change Settings" on existing configs now automatically loads quality profiles
  - Added `loadingProfiles` state to show loading indicator while fetching profiles
  - Explicitly include `id` in editForm to ensure API lookups work with masked API keys
  - Quality profile dropdown shows saved profile ID as fallback if profile list fails to load
  - Hardcoded static options (availability, series type, monitor) to avoid dependency on test connection
  - Fixed issue where masked API keys prevented profile lookup on edit

- **Low-Confidence Discord Notifications (55%)**: Fixed tier lookup and notification issues
  - `getTierForConfidence()` now rounds confidence values to avoid decimal precision issues
  - Added fallback tier for low-confidence items (50-69%) when no explicit tier found in database
  - Items with 55% confidence now correctly appear on Discord with clarification buttons
  - Enhanced logging in `sendConfidenceBasedNotification` for debugging notification failures
  - Logs tier lookup results, initialization status, and skip reasons

### Added
- **Incomplete Configuration Warnings**: New warning system for missing required fields
  - New `ArrConfigWarning.vue` component displays warning banner on Dashboard
  - Warning shown when Radarr/Sonarr configs missing `quality_profile_id`
  - Banner includes direct "Configure Now" button linking to settings page
  - New API endpoint `GET /api/settings/arr-config-status` to check for incomplete configs
  - Warning can be dismissed by user (session-only, reappears on refresh if still incomplete)

### Technical Details
- Radarr availability options hardcoded: `announced`, `inCinemas`, `released`, `preDB`
- Sonarr series type options hardcoded: `standard`, `daily`, `anime`
- Sonarr monitoring options hardcoded: `all`, `future`, `missing`, `existing`, `first`, `latest`, `none`
- Confidence rounding uses `Math.round()` to handle float precision issues
- Fallback tier structure: `{ tier: 'clarify', action: 'clarify_questions', description: 'Requires clarification', min_confidence: 50, max_confidence: 69 }`
- Enhanced Discord logging includes: title, confidence, tier, initialization status, channel details
- ArrConfigWarning component auto-polls `/api/settings/arr-config-status` on Dashboard mount

## [0.38.3-alpha] - 2026-01-14

### Added
- **Rating Normalization System**: Comprehensive system to standardize age-based and international ratings to MPAA/TV standards
  - New `ratingNormalizer.js` utility with priority-based rating selection
  - Priority system: 1) OMDb rated field (most reliable), 2) TMDB US certification, 3) Normalized age-based rating, 4) "NR" for unknowns
  - Support for age-based ratings: 13→PG-13, 14→PG-13, 15→R, 16→R, 17→R, 18→NC-17
  - Support for UK ratings: U→G, PG→PG, 12A→PG-13
  - Support for Australian ratings: M→PG-13, MA15+→R, R18+→NC-17
  - Support for German FSK ratings: FSK 0→G, FSK 6→G, FSK 12→PG-13, FSK 16→R, FSK 18→NC-17
  - Separate TV rating mappings: 13→TV-14, 16→TV-MA, etc.
  - Original ratings preserved in new `original_rating` column
  - Database migration 052 adds `original_rating` column with indexes

- **Rating Normalization Queue Processing**: New task type `rating_normalization`
  - Processes items asynchronously through queue system
  - Updates `content_rating` to normalized value while preserving original
  - Priority 5 tasks (medium priority)
  - Logs normalization changes for audit trail

- **Automatic Rating Updates from OMDb**: Metadata enrichment now updates ratings
  - When OMDb enrichment succeeds, `content_rating` is updated to OMDb's rated field
  - Original rating preserved in `original_rating` column
  - Only updates if OMDb rated field is valid (not "N/A")
  - Ensures most reliable rating source (OMDb from IMDb) takes precedence

- **Rating Normalization Admin UI**: New Settings panel under Metadata section
  - Real-time statistics: items needing normalization, already normalized, in queue, failed
  - Progress bar showing normalization completion percentage
  - "Normalize X Ratings" button to queue all items needing normalization
  - "Refresh Status" button for manual stats update
  - "Regenerate Profiles" button after completion
  - Auto-polling every 5 seconds when processing
  - Rating mapping examples showing transformations (13→PG-13, FSK 16→R, etc.)
  - Success/error message toasts

- **Rating Normalization API Endpoints**: Three new REST endpoints
  - `GET /api/rating-normalization/stats`: Returns normalization statistics
  - `POST /api/rating-normalization/backfill`: Queues all items needing normalization
  - `POST /api/rating-normalization/finalize`: Checks completion and regenerates library profiles

- **Automatic Rating Normalization on Startup**: Server startup auto-queues first 1000 items
  - Runs after database migrations and service initialization
  - Identifies items with age-based or non-standard ratings without `original_rating` set
  - Only queues items needing normalization (skips already-standard ratings)
  - Logs total count and queued count for visibility

- **Daily Rating Normalization Check**: Scheduler runs daily at 3 AM
  - Checks for new items needing normalization (from new media syncs)
  - Auto-queues any items found
  - Prevents manual intervention for ongoing library additions
  - Logs activity for audit trail

### Changed
- **Metadata Enrichment**: Now normalizes ratings when OMDb data is available
  - OMDb rated field takes precedence over existing content_rating
  - Original rating preserved before update
  - Ensures library items get most authoritative rating (from IMDb via OMDb)

### Technical Details
- New database column `original_rating` stores pre-normalization ratings
- Index on `original_rating` for efficient queries
- Conditional index on `content_rating WHERE original_rating IS NULL` for finding items needing normalization
- Queue processing handles items in batches to prevent server overload
- Rating normalizer uses mapping tables for consistent transformations
- Standard ratings (G, PG, PG-13, R, NC-17, TV-Y, TV-Y7, TV-G, TV-PG, TV-14, TV-MA) pass through unchanged
- Unknown/unmapped ratings default to "NR" (Not Rated)
- Vue component uses reactive polling for real-time progress updates
- Integration tests cover stats endpoint, backfill queuing, and finalization

## [0.38.2-alpha] - 2026-01-14

### Fixed
- **PolicyEngine Now Uses Library Profiles**: Added `profile` scoring to PolicyEngine evaluation
  - Library profiles (statistical snapshots of library content) now contribute to classification confidence
  - New `scoreProfile()` method calls `libraryProfileService.getProfileScore()`
  - Profile weight defaults to 25% of total score
  - Profiles provide base confidence ("item fits what's already in library")
  - Presets provide boost confidence ("item matches defined criteria")
  - Example: Library with 99% Comedy content will now score new Comedy items highly

- **Classification Pipeline: SignalCollector Not Running**: Fixed critical bug where `SignalCollector.collectAll()` was never invoked during classification
  - Library profile scoring was being skipped entirely
  - Custom rules evaluation was not happening
  - Existing media checks were bypassed
  - Collection/franchise signals were not collected
  - Now properly invokes full signal collection pipeline with all detectors

- **RAG/Semantic Search Silent Failures**: Added comprehensive debug logging to RAG retriever
  - Logs when RAG search is initiated with title and threshold
  - Logs when no results are returned
  - Logs when results are below similarity threshold
  - Logs embedding count and RAG enabled status
  - Helps diagnose why RAG isn't contributing to classifications

- **AI Prompt Anime Bias**: Neutralized anime-specific examples in AI classification prompt
  - Replaced "Japanese animation with anime keywords" example with generic "Action movie with mainstream studio" 
  - Replaced "Anime vs Kids conflict" clarification example with "Genre ambiguity" example
  - Prevents LLM from being primed to suggest Anime for unrelated content

- **Fallback Library Selection**: Fixed fallback defaulting to highest-priority library (often specialty libraries like Anime)
  - Now looks for general-purpose library matching media type (e.g., "Movies" for movies)
  - Falls back to lowest-priority library (most general) instead of highest-priority
  - Prevents specialty libraries from catching all uncertain classifications

### Changed
- **PolicyEngine Weights**: Adjusted default weights to accommodate profile scoring
  - Preset: 35% (was 40%)
  - Profile: 25% (NEW)
  - Pattern: 15% (was 25%)
  - RAG: 15% (was 20%)
  - History: 10% (was 15%)
  - Total still equals 100%

- **Signal Collection Logging**: Enhanced logging in SignalCollector to show collection summary with total signals and signal types collected

### Technical Details
- Library profiles are statistical snapshots showing rating distribution, genre distribution, studio distribution, and exclusions
- Profile scoring returns 0-100 where 50 is neutral, >50 is positive match, <50 is negative match
- PolicyEngine now evaluates 5 signal types: preset, profile, pattern, rag, history
- All formula-based scores remain capped at 95% (only authoritative signals return 100%)
- Root cause: Decision tree created SignalCollector but only manually added a few signals instead of running full `collectAll()` pipeline
- PolicyEngine was evaluating but with minimal signal context (only getting 31% confidence for obvious mainstream content)
- AI was receiving biased prompt examples and defaulting CLARIFY responses to wrong library

## [0.38.1-alpha] - 2026-01-14

### Changed
- **Unified Policy Configuration Modal**: Consolidated `PolicyBuilderModal` and `PresetSelectionModal` into single modal
  - Preset selection UI (suggestions, categories, search, grid) now inline in policy modal
  - Removed nested modal experience
  - Modal title now shows "[Library Name] Policy" instead of "Edit Policy" / "Create Policy"
  - Save button shows "Create Policy" or "Save Policy" based on state
  - Policy name and description auto-generated from library and presets if not provided
  - Removed Basic Information section (Policy Name, Description inputs, Library dropdown)
  - Replaced with read-only library header with lock icon
- **PolicyCard Button Rename**: Replaced "Add Presets" and "Edit" buttons with single "Configure" button
  - Both empty and filled policy cards now use "Configure" for consistency
- **Advanced Settings Collapsible**: Scoring Weights and Combination Mode sections now collapsed by default
  - Reduces visual clutter while still providing access to advanced features

### Removed
- **Nested PresetSelectionModal**: No longer opens as separate popup from PolicyBuilderModal (UI integrated inline)
- **Unused state in PolicyList.vue**: Removed legacy preset selector code (no longer needed)

## [0.38.0-alpha] - 2026-01-13

### Added
- **Preset Viewer UX Improvements**: Reimagined system preset viewing experience
  - New `PresetSummaryModal.vue` component displaying clean read-only summary (badges/chips instead of disabled form inputs)
  - "Customize" button to clone system presets as custom presets
  - Modal title shows "(Custom Preset)" suffix when customizing
  - "Used in X policies" count displayed in preset summary header
  - Auto-switch to Custom Presets tab after saving customization
  - Success toast notification on preset creation
  - Backend API endpoint: `GET /api/policies/presets/:presetId/usage` for usage count

- **Policy Card Empty State Redesign**: New visual design for policies without presets
  - Dashed border container with centered plus icon
  - "No presets configured" messaging
  - Library header with icon display
  - Auto-generated policy naming from library name
  - Footer showing thresholds even in empty state

- **Preset Selection Modal Enhancements**: Improved UX for adding presets to policies
  - Read-only library field with lock icon (🔒) indicator
  - Suggested presets section with match percentages and blue left border
  - Green checkmark (✓) selection indicators replacing blue highlight
  - Plus (+) icon for unselected preset cards
  - Updated category filter pills with blue selected state, gray unselected
  - "Add All" button for suggested presets
  - Enhanced selected preset summary with green styling

- **Custom Presets Manager UI**: New dedicated view for managing presets
  - Tabbed interface for System Presets (read-only) and Custom Presets (editable)
  - Grid view with preset cards showing icon, name, category, and signal summary
  - Search and category filtering
  - Create, edit, and delete custom presets
  - New route: `/presets`
  - Navigation: Added "Presets" to Classification section in sidebar
  - New components: `PresetsManager.vue`, `PresetCard.vue`

- **Emoji Dropdown Selector**: Replaced free-text emoji input with curated dropdown
  - 60+ curated emojis organized into 8 categories
  - Categories: Movies, TV Shows, Genres, Themes/Seasonal, Quality/Awards, General, Regional, Special Interest
  - Consistent with emojis used in system presets
  - Better UX: one-click selection vs manual emoji input
  - Updated default emoji from 📦 (package) to 🎬 (clapperboard)

### Changed
- **Color Consistency**: Standardized on primary blue (#3b82f6) and success green (#22c55e)
- **Modal Styling**: Updated close button with blue accent for better visual hierarchy
- **Category Pills**: Updated from background-light to gray-700 for unselected state
- **Search Input**: Enhanced with explicit text color and placeholder styling

## [0.37.8e-alpha] - 2026-01-13

### Fixed
- **Classification Status Constraint**: Added `awaiting_decision` and `pending` status values to `classification_history_status_check` constraint

## [0.37.8d-alpha] - 2026-01-12

### Fixed
- **Classification Method Constraint**: Added all current and legacy methods to `classification_history_method_check` constraint
- **Learned Corrections Query**: Fixed `ORDER BY updated_at` to use `created_at` (column doesn't exist)
- **Ollama Timeout**: Extended initial timeout from 60s to 120s for model loading, with 60s heartbeat for subsequent chunks

### Removed
- **Deprecated Code Paths**: Removed `checkLibraryRules()` and `matchRules()` - PolicyEngine now handles all rule-based classification
- **Legacy Signal Collection**: Removed `custom_rule` signal types from classification flow

### Changed
- **Hard Timeout**: Extended from 3 minutes to 5 minutes for complex classifications

## [0.37.8c-alpha] - 2026-01-12

### Changed
- **Overseerr/Jellyseerr Webhook Payload**: Enhanced JSON payload template with explicit TMDb ID, TVDB ID, media status, and request details
- **Webhook Parser**: Updated `parsePayload()` to handle new explicit field format while maintaining backward compatibility

### Improved
- **Metadata Enrichment**: Direct TMDb/TVDB ID lookup for faster, more accurate classification
- **Request Tracking**: Better user information capture from request payload

## [0.37.8b-alpha] - 2026-01-12

### Fixed
- **Discord Configuration Persistence Issue**:
  - Backend: Modified `loadConfig()` method in `discordBot.js` to accept `ignoreEnabledStatus` parameter
  - Backend: Updated `getChannelDetails()`, `getServers()`, `getChannels()`, and `testConnection()` to fetch config regardless of enabled status
  - Frontend: Improved save sequencing to wait for database commit before fetching channel details
  - Frontend: Added better success feedback showing configuration saved status
  - Frontend: Enhanced test connection to display success message in edit mode
  - Resolves issue where Discord configuration would revert to "Unknown" and show "Connection Failed" after saving
  - Server and channel names now display correctly after save

### Changed
- **Discord API Configuration Loading**: `loadConfig()` now supports fetching bot token for API authentication even when bot is disabled
- **Frontend Discord Settings**: Save now shows success status with channel and server information
- **Test Connection Feedback**: Now displays clear success message with test notification delivery status in edit mode

### Added
- **ConnectionStatus Component**: Added support for 'warning' status to display non-critical issues

### Changed
- **Build Tooling**: Upgraded Vite from v5.0.8 to v7.3.1
- **Vue Plugin**: Upgraded @vitejs/plugin-vue from v4.5.2 to v6.0.3
- **Test Infrastructure**: Integration tests now use cross-platform temp file paths for Windows compatibility

## [0.37.8a-alpha] - 2026-01-12

### Fixed
- **Discord Channel Details Error Handling**:
  - Backend: Added 10-second timeout to Discord client login to prevent indefinite hangs
  - Backend: Changed `/api/settings/discord/channel/:channelId` route from returning 500 errors to 400 with fallback data
  - Backend: Added detailed logging at key points in `getChannelDetails()` for debugging
  - Frontend: Improved error handling in `Discord.vue` to use fallback data and show warning status
  - Frontend: Display clear error messages when channel details cannot be fetched
  - Prevents "Unknown" from appearing for server and channel names after saving configuration

### Changed
- **Discord Error Responses**: API now returns structured error response with fallback data instead of generic 500 errors
- **Discord Logging**: Added debug logging for channel fetch operations (`[Discord]` prefix)

## [0.37.8-alpha] - 2026-01-12

### Added
- **Discord Integration Enhancements**:
  - Test connection now sends actual notification to verify bot setup
  - Permission validation for all required Discord bot permissions (Send Messages, Embed Links, Attach Files, Read Message History, Use External Emojis, Add Reactions)
  - Comprehensive integration test suite (`discord-integration.test.js`) with 19 test cases
  - Enhanced API endpoint `/api/settings/discord/test` to accept `channel_id` parameter

### Fixed
- **Discord Health Status**: Now shows 'not configured' instead of 'error' when Discord is not set up
- **Discord Channel/Server Display**: Fixed issue where server and channel names displayed as "unknown" after saving configuration
- **Discord Test Connection**: Now sends actual test notification embed to Discord channel for verification

### Changed
- **Discord Bot Service**: `testConnection()` method enhanced with permission checking and test notification sending

## [0.37.7-alpha] - 2026-01-12

### Added
- **Startup Profile Generation**: Library profiles auto-generate on server startup for all libraries with items

### Changed
- **Test Coverage**: Enhanced tests documenting startup and 404 fallback profile generation behaviors
- **Discord Settings UI**: Improved error messaging to display specific permission issues and notification delivery status

## [0.37.6-alpha] - 2026-01-12

### Fixed
- **Library Profile Auto-Generation**: Profiles now auto-generate on first page load instead of requiring manual refresh
- Fixed 404 handling in LibraryProfile.vue to trigger profile generation

### Changed
- **Test Coverage**: Enhanced regression test for library profile 404 response with JSDoc documentation

## [0.37.5a-alpha] - 2026-01-12

### Changed
- **Dependencies**: Upgraded supertest from 7.1.4 to 7.2.2 in server

## [0.37.5-alpha] - 2026-01-11

### Added
- **Library Profiles**: New statistical system replacing Pattern Discovery.
  - Generates profiles based on rating, genre, and studio distributions.
  - Automatically identifies exclusions (what's *not* in your library).
  - New API endpoints for profile generation and retrieval.
- **Profile Visualization**: Added `LibraryProfile` component to view library statistics.
- **Policy Engine**: Integrated `PROFILE_SCORE` signal type for better accuracy.
- **API Health Monitoring**: Added health check endpoints for external API services.
  - `GET /api/settings/omdb/health` - OMDb API health with SSL status and rate limit info.
  - `GET /api/settings/tmdb/health` - TMDB API health with SSL status.
  - `GET /api/settings/tavily/health` - Tavily API health with SSL status.

### Changed
- **Scoring**: `FormulaEngine` now uses library profiles instead of patterns.
- **Frontend**: Replaced "Learned Patterns" widget with "Library Profile" in Library Detail view.

### Fixed
- **Stats Alerts 500 Error**: Added defensive error handling to `/api/stats/alerts` endpoint.
- **OMDb SSL Errors**: OMDb service now gracefully handles SSL certificate expiration.
- **Integration Tests**: Fixed preset scoring tests to match actual scoring implementation.

### Deprecated
- **Pattern Experience**: The "Pattern Discovery" system is deprecated and replaced by Library Profiles.
- **Routes**: Removed `/patterns` and `/rule-builder` routes.
- **Database**: `discovered_patterns` table is now considered legacy.

## [0.37.2-alpha] - 2026-01-11

### Added
- **Inline Preset Customization:** Customize preset signals directly in the Policy Builder without leaving the modal
  - "Customize" button expands each selected preset to show editable signals
  - Remove base preset signals with ✕ button (crossed-out with ↩ to restore)
  - Add custom signals (content ratings, genres, keywords) with + dropdowns
  - Multiple presets can be expanded and edited simultaneously
- **Combined Signals Summary:** See the merged result of all selected presets
  - Appears when 2+ presets are selected
  - Shows union of: Content Ratings, Preferred Genres, Excluded Genres, Preferred Keywords, Excluded Keywords, Required Keywords
  - Respects signal removals and custom additions
- **Library Dropdown Grouping:** Libraries now grouped by media type in Policy Builder
  - 🎬 Movies section
  - 📺 TV Shows section
  - 📁 Other section
- **Database Support for Custom Signals:** Migration `047_policy_preset_custom_signals.sql`
  - Adds `custom_signals` JSONB column to `policy_presets` table
  - Stores signal customizations including additions and removals

### Fixed
- **PresetCard Checkbox:** Fixed checkbox not triggering toggle when clicked directly (was only working on card click)
- **Pattern Mining Library Name Bug:** Fixed `library_name` null error when upserting discovered patterns
  - Now looks up library name from `libraries` table if missing from classification history
  - Prevents "null value in column library_name violates not-null constraint" errors

## [0.37.1-alpha] - 2026-01-11

### Fixed
- **Media Sync FK constraint fix:** Fixed `upsertMediaItem` and `upsertCollection` failing when library was deleted during re-sync
  - Added library existence check before insert to prevent FK violation on `media_server_items.library_id`
  - Gracefully skips items/collections if library no longer exists (logs warning instead of error)
- **Scheduler import fix:** Fixed `schedulerService.runPatternAnalysis is not a function` error in queue clear
  - `runGapAnalysis` is in `scheduler.js`, `runPatternAnalysis` is in `schedulerService.js`
  - Now imports both modules and calls correct methods on each
- **Tavily result parsing fix:** Fixed enrichment retry service not extracting IMDb data correctly
  - Tavily API returns `{ results: [...] }` object, not an array
  - Now correctly accesses `searchResult.results` before passing to `extractImdbData`

### Added
- **Regression tests:** `v037.1-regression.test.js` - Tests for all v0.37.1 fixes
  - Scheduler module import verification (runGapAnalysis vs runPatternAnalysis)
  - Tavily result parsing with extractImdbData
  - Media sync library existence method verification

## [0.37.0-alpha] - TBD

### 🚀 Major: Policy-Driven Classification Engine

This release implements the complete Policy-Driven Classification Engine, replacing rule-centric design with comprehensive policy-based classification using rich content signals.

### Added

#### AI Optimization - Skip AI for Confident PolicyEngine Results (#98)
- **Smart AI bypass:** AI calls are now skipped when PolicyEngine has high confidence
  - **auto_classify (≥85%):** Skip AI entirely, trust PolicyEngine result
  - **prompt_confirm (60-84%):** Skip AI, prompt user via Discord with PolicyEngine breakdown
  - **prompt_select (<60%):** Use AI to help choose (existing behavior)
- **Performance benefits:**
  - 70-80% reduction in AI API calls
  - 2-5 second latency improvement per classification
  - Lower costs and reduced rate limiting concerns
- **New classification methods:**
  - `policy_auto`: PolicyEngine auto-classified with high confidence (≥85%)
  - `policy_prompt`: PolicyEngine suggests confirmation needed (60-84%)
- **Enhanced logging:** "AI skipped" log messages show when AI bypass is used
- **Breakdown in prompts:** Discord prompts include PolicyEngine signal breakdown and confidence explanation
- **Integration tests:** `server/src/__tests__/integration/ai-skip-logic.test.js`
  - Tests for high confidence (≥85%) AI skip
  - Tests for medium confidence (60-84%) user prompting
  - Tests for low confidence (<60%) AI usage
  - Threshold boundary condition tests
  - PolicyResult propagation verification

#### Event Detection Migration to PolicyEngine Presets (#98)
- **Event presets:** Event detection migrated from hardcoded `detectEventContent()` to 6 PolicyEngine presets
  - `event_holiday`: Christmas, Halloween, and seasonal content (95% base confidence)
  - `event_sports`: Sports events, documentaries, athletics (92% base confidence)
  - `event_ppv`: UFC, MMA, boxing, wrestling events (93% base confidence)
  - `event_concert`: Concerts, music festivals, live music (90% base confidence)
  - `event_standup`: Stand-up comedy specials (90% base confidence)
  - `event_awards`: Award shows, galas, red carpet events (88% base confidence)
- **Automatic migration:** Libraries with `event_detection_type` get corresponding presets auto-attached
- **Database migration:** `database/migrations/046_event_detection_presets.sql`
  - Creates 6 event presets in 'events' category
  - Auto-attaches presets to libraries with event_detection_type
  - Creates policies for libraries if none exist
  - Sets high weight (1.5) for event presets
- **Deprecated:** `detectEventContent()` method marked deprecated, no longer called in classification flow
- **Integration tests:** `server/src/__tests__/integration/event-presets.test.js`
  - Tests for all 6 event preset creation
  - Tests for event preset signal matching (holiday, sports, PPV, etc.)
  - Tests for PolicyEngine integration with event presets
  - Tests for backward compatibility
- **Benefits:**
  - Unified classification system (events use same flow as other content)
  - Configurable via UI (adjust keywords, weights, thresholds)
  - Extensible (easy to add new event types)
  - Transparent (full scoring breakdown in logs)

#### Comprehensive Documentation (#98)
- **Architecture documentation:** `docs/architecture/policy-engine.md`
  - Complete PolicyEngine architecture overview
  - Component diagrams and data flow
  - Signal type reference with examples
  - Scoring algorithm explanation
  - AI optimization rationale
  - Event detection migration details
- **Preset documentation:** `docs/presets/README.md`
  - Event preset reference with all 6 presets
  - Signal configuration examples
  - Usage and configuration guide
  - Migration from detectEventContent()
  - Troubleshooting guide
- **Migration guide:** `docs/migration/v037.md`
  - Step-by-step migration instructions
  - Breaking changes documentation
  - Testing and verification procedures
  - Rollback instructions
  - Troubleshooting common issues

#### Legacy Rule Migration Service (#103)
- **New service:** `server/src/services/legacyMigration.js` - Migrates legacy `library_custom_rules` to policy system
  - **Migration status:** `getMigrationStatus()` - Returns counts of pending/migrated rules
  - **Library listing:** `getLibrariesWithLegacyRules()` - Lists libraries with unmigrated rules
  - **Rule retrieval:** `getLegacyRules(libraryId)` - Fetches legacy rules for a library
  - **Rule analysis:** `analyzeRule(rule)` - Analyzes rules and suggests equivalent presets or overrides
    - Genre-based matching: Searches content_presets for matching genre signals
    - Certification matching: Matches rating/certification requirements
    - Keyword matching: Detects keyword-based rules
    - Confidence scoring: Calculates match confidence (0-100%)
    - Fallback to override: Suggests policy override when no preset matches
  - **Rule conversion:** `ruleToOverride(rule)` - Converts legacy rule to policy override format
  - **Single migration:** `migrateRule(ruleId, migrationChoice, userId)` - Migrates individual rule
    - Supports preset attachment or override creation
    - Auto-creates policy if none exists
    - Marks rule as migrated with timestamp and user tracking
    - Transactional with rollback on error
  - **Bulk migration:** `migrateLibrary(libraryId, userId, autoSuggest)` - Migrates all library rules
    - Auto-suggest mode: Automatically applies top suggestion for each rule
    - Manual mode: Returns suggestions for user review
- **New API routes:** `server/src/routes/migration.js`
  - `GET /api/migration/status` - Migration status summary (pending/migrated counts)
  - `GET /api/migration/libraries` - Libraries with legacy rules (sorted by rule count)
  - `GET /api/migration/libraries/:id/rules` - Legacy rules for specific library
  - `GET /api/migration/rules/:id/analyze` - Analyze rule and get migration suggestions
  - `POST /api/migration/rules/:id/migrate` - Migrate single rule with selected suggestion
  - `POST /api/migration/libraries/:id/migrate-all` - Bulk migrate all library rules
- **New views:**
  - `client/src/views/MigrationDashboard.vue` - Main migration interface
    - Migration status overview with progress bar
    - Deprecation notice with timeline (v0.37 → v0.38 → v0.39 removal)
    - Library cards showing rule counts
    - Wizard and auto-migrate options
- **New components:**
  - `client/src/components/migration/MigrationLibraryCard.vue` - Library card with migration actions
  - `client/src/components/migration/MigrationWizard.vue` - Step-by-step migration wizard
    - Rule-by-rule analysis
    - Suggestion selection with confidence indicators
    - Preview migration options (preset vs override)
    - Batch migration support
  - `client/src/components/LegacyRuleWarning.vue` - Warning banner for libraries with legacy rules
- **Database migration:** `database/migrations/045_legacy_migration_tracking.sql`
  - Added `migrated_at`, `migrated_by`, `migration_type` columns to `library_custom_rules`
  - Indexes for efficient querying of unmigrated rules
- **Integration tests:** `server/src/__tests__/integration/legacy-migration.test.js`
  - Migration status tracking
  - Library listing and filtering
  - Rule analysis and preset matching
  - Preset and override migration
  - Bulk migration
  - Transaction rollback on errors
- **Navigation integration:** Added "Migration" route to router
- **Deprecation timeline:**
  - **v0.37 (current):** Legacy rules functional, migration tools available
  - **v0.38:** UI warnings for libraries with unmigrated rules
  - **v0.39+:** Legacy rule system removed, policies required

#### Policy Stats Dashboard (#113)
- **New view:** `client/src/views/PolicyStatsDashboard.vue` - Live policy statistics dashboard
  - **Overview cards:** Display global metrics (total decisions, average accuracy, auto-classify rate, improving policies)
  - **Policy performance grid:** Individual policy cards with trend indicators and key metrics
  - **Live activity feed:** Real-time stream of decisions, discovered patterns, and tuning suggestions
  - **Alerts system:** Automatic detection and display of abnormal metrics
  - **Time range filtering:** View stats for 7 days, 30 days, or all time
  - **Auto-refresh:** Updates every 30 seconds for real-time monitoring
- **New components:**
  - `client/src/components/stats/StatCard.vue` - Reusable metric display card with trend indicators
  - `client/src/components/stats/PolicyStatsCard.vue` - Policy-specific stats card with click-to-expand
  - `client/src/components/stats/LiveFeed.vue` - Activity feed with decision, pattern, and suggestion events
  - `client/src/components/stats/AlertsBanner.vue` - Dismissible alerts for declining accuracy and pending suggestions
  - `client/src/components/stats/PolicyStatsModal.vue` - Detailed policy stats modal with charts and comparisons
  - `client/src/components/stats/AccuracyChart.vue` - SVG-based accuracy trend chart
- **Extended API routes:** `server/src/routes/stats.js`
  - `GET /api/stats/overview` - Global stats overview (total policies, decisions, accuracy, trends)
  - `GET /api/stats/policies` - List all policies with their learning stats
  - `GET /api/stats/policies/:id` - Detailed stats for specific policy with time-series and breakdowns
  - `GET /api/stats/live-feed` - Recent activity feed across all policies
  - `GET /api/stats/alerts` - Abnormal metrics alerts (declining accuracy, high corrections, pending suggestions)
  - `GET /api/stats/policies/:id/compare` - Period comparison (this week vs last week)
- **Navigation integration:** Added "Policy Stats" link to sidebar with chart icon
- **Integration tests:** `server/src/__tests__/integration/stats-api.test.js` - Comprehensive API endpoint testing

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

#### Policy Builder UI
- **New Vue components:**
  - `client/src/views/PolicyList.vue` - Main policy management page showing all policies grouped by library
  - `client/src/components/policies/PolicyCard.vue` - Individual policy card with threshold and weight display
  - `client/src/components/policies/PolicyBuilderModal.vue` - Complete policy creation/editing modal with preset selection
  - `client/src/components/policies/PresetCard.vue` - Preset selection card with expandable signal details
- **New API routes:** `server/src/routes/policies.js`
  - `GET /api/policies` - List all policies with preset counts
  - `GET /api/policies/:id` - Get policy with attached presets
  - `POST /api/policies` - Create new policy with presets
  - `PUT /api/policies/:id` - Update policy and presets
  - `DELETE /api/policies/:id` - Delete policy
  - `GET /api/policies/:id/presets` - Get policy's presets
  - `POST /api/policies/:id/presets` - Attach preset to policy
  - `DELETE /api/policies/:id/presets/:presetId` - Remove preset from policy
  - `GET /api/policies/presets/all` - List all 168 available presets with category/search filtering
  - `GET /api/policies/presets/categories` - List preset categories with counts
- **Features:**
  - Select from 168 comprehensive content presets across 8 categories
  - Configure policy thresholds (auto-classify, prompt)
  - Adjust scoring weights (presets, patterns, RAG, history)
  - Choose combination modes (best_match, average, weighted_average, require_all)
  - Search and filter presets by category
  - Per-preset weight adjustment
  - Real-time weight validation (ensures 100% total)
  - Expandable preset details showing signal configurations
- **Integration tests:** `server/src/__tests__/integration/policies-api.test.js`
  - Full CRUD operation coverage
  - Preset attachment/removal testing
  - Category filtering and search validation

#### Policy Tuning Dashboard UI
- **New Vue components:**
  - `client/src/views/TuningSuggestionsDashboard.vue` - Main tuning suggestions dashboard with filtering and summary stats
  - `client/src/components/suggestions/SuggestionCard.vue` - Individual suggestion card displaying type, confidence, and impact estimate
  - `client/src/components/suggestions/RejectModal.vue` - Modal for rejecting suggestions with reason
- **New API routes:** `server/src/routes/suggestions.js`
  - `GET /api/suggestions` - List all tuning suggestions with status and policy filtering
  - `GET /api/suggestions/:id` - Get suggestion details with supporting feedback evidence
  - `POST /api/suggestions/:id/apply` - Apply suggestion and track before/after accuracy
  - `POST /api/suggestions/:id/reject` - Reject suggestion with reason
  - `GET /api/suggestions/:id/impact` - Get impact metrics (before/after accuracy, improvement)
  - `GET /api/suggestions/policy/:policyId/summary` - Get summary statistics for policy suggestions
- **Enhanced FeedbackAnalysis service:**
  - `getImpactMetrics(suggestionId)` - Retrieves before/after accuracy and improvement for applied suggestions
- **Database migration:** `database/migrations/044_add_tuning_suggestion_tracking.sql`
  - Added `applied_at`, `applied_by`, `before_accuracy` columns to `policy_tuning_suggestions` table
  - Enables tracking when suggestions are applied and measuring their impact on policy accuracy
- **Features:**
  - View pending, applied, and rejected suggestions
  - Filter by status (pending/applied/rejected) and policy
  - Summary cards showing counts by status
  - Detailed view with supporting feedback evidence showing which classifications led to the suggestion
  - Apply suggestions with confirmation
  - Reject suggestions with optional reason
  - Impact tracking showing accuracy improvement after applying suggestions
  - Confidence scoring (high/medium/low) with color coding
  - Supporting evidence display showing user corrections and feedback
- **Navigation:**
  - Added "Tuning" menu item to sidebar with LightBulb icon
  - Route: `/tuning-suggestions`
- **Integration tests:** `server/src/__tests__/integration/suggestions-api.test.js`
  - Full API endpoint coverage
  - Apply/reject suggestion testing
  - Impact metrics validation
  - Summary statistics testing

#### PromptBuilder Service
- **New service:** `server/src/services/promptBuilder.js` - Context-rich prompt generation for Discord and web UI
  - **Main entry point:** `buildPrompt(item, evaluationResult)` - Generates intelligent prompts with explanations
  - **Prompt type determination:** `determinePromptType(evaluationResult)` - Selects appropriate prompt type based on context
  - **Prompt types:**
    - `buildLowConfidencePrompt()` - Explains uncertainty with matching/conflicting/missing signals
    - `buildAIRejectionPrompt()` - Shows AI validation reasoning and alternative suggestions
    - `buildCloseRacePrompt()` - Compares multiple similar candidates with key differences
    - `buildNewDiscoveryPrompt()` - Handles unknown studios/collections with best guesses
    - `buildConfirmationPrompt()` - Explains learned patterns and future impact
    - `buildStandardPrompt()` - Default prompt for general cases
  - **Batch operations:** `buildBatchSummary(items)` - Groups multiple pending items by confidence level
  - **Tuning suggestions:** `buildTuningSuggestionPrompt(suggestion)` - Formats policy tuning recommendations
  - **Output formatting:**
    - `formatForDiscord(prompt)` - Discord embed format with action buttons and select menus
    - `formatForWeb(prompt)` - Web UI format with interactive elements
  - **User interaction:**
    - `buildReasonOptions(item, evaluation)` - Generates contextual reason checkboxes (genre, studio, rating, keywords, collection, custom)
    - `buildPatternOptions(item, evaluation)` - Creates pattern learning options (remember studio, keyword, collection)
  - **Signal analysis:** Analyzes and categorizes signals as matching, conflicting, or missing
  - **Key differences:** Identifies differentiating factors between close candidates
  - **Impact description:** Explains how user choices affect future classifications

#### PromptBuilder API Routes
- **New routes:** `server/src/routes/prompts.js` - API endpoints for prompt queue and response handling
  - `GET /api/prompts/pending` - Get pending classification prompts queue with pagination
  - `GET /api/prompts/:id` - Get specific prompt details with rich context and explanations
  - `POST /api/prompts/:id/respond` - Submit prompt response with reasons and pattern actions
    - Records feedback to policy_feedback_log
    - Updates classification_history status
    - Creates discovered_patterns from user pattern actions
    - Determines if response was a correction
  - `GET /api/prompts/batch` - Get batch summary grouped by confidence level and prompt type
- **Integration:** Registered prompts router in `server/src/routes/api.js`

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
- **New test suite:** `server/src/__tests__/integration/prompt-builder.test.js` - Comprehensive tests for prompt generation
  - **Prompt type determination:** Tests for all 6 prompt types (low_confidence, ai_rejection, close_race, new_discovery, confirmation, standard)
  - **Prompt building:** Tests for each prompt type with realistic data
  - **Batch operations:** Tests batch summary grouping by prompt type
  - **Formatting:** Tests Discord and web UI formatting
  - **User interaction:** Tests reason options and pattern options generation
  - Validates contextual option generation based on item metadata
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
- **PolicyEngine verification tests:** Added comprehensive test coverage for v0.37.0 (#117)
  - `FORMULA_CONFIDENCE_CAP` constant verification (must equal 95)
  - Default weight validation: preset (0.40), pattern (0.25), rag (0.20), history (0.15)
  - Weight sum validation (must equal 1.0)
  - Confidence cap enforcement across all scoring methods (scorePresets, scorePatterns, scoreRAG, scoreHistory)
  - Authoritative signal handling (must return exactly 100%, not capped)
  - Formula score boundary testing (must never exceed 95%)
  - Edge cases and boundary conditions

### Fixed
- **Migration 046 ON CONFLICT fix:** Fixed `046_event_detection_presets.sql` migration failing with "no unique or exclusion constraint matching the ON CONFLICT specification"
  - Changed `ON CONFLICT (key)` to `ON CONFLICT (key, user_id)` to match the unique constraint on `content_presets` table
  - Added `updated_at = NOW()` to the UPDATE clause for consistency with other preset migrations
- **Media Sync FK constraint fix:** Fixed `upsertMediaItem` and `upsertCollection` failing when library was deleted during re-sync
  - Added library existence check before insert to prevent FK violation on `media_server_items.library_id`
  - Gracefully skips items/collections if library no longer exists (logs warning instead of error)
- **Scheduler import fix:** Fixed `schedulerService.runPatternAnalysis is not a function` error in queue clear
  - `runGapAnalysis` is in `scheduler.js`, `runPatternAnalysis` is in `schedulerService.js`
  - Now imports both modules and calls correct methods on each
- **SQL syntax error:** Corrected UNIQUE constraint placement in `policy_learning_stats` table (moved before REFERENCES)
- **Test reliability:** Added explicit assertions to prevent tests from silently passing when preconditions aren't met
- **Migration error handling:** Enhanced to fail fast on critical errors while allowing expected optional failures
- **PolicyEngine default weights:** Fixed default weights to match v0.37.0 specification (#117)
  - `pattern_weight`: Corrected from 0.30 to 0.25 (25%)
  - `history_weight`: Corrected from 0.10 to 0.15 (15%)
  - Ensures weights sum to 1.0: Preset (40%) + Pattern (25%) + RAG (20%) + History (15%)
- **Formula confidence cap:** Added missing confidence cap to `scorePresets()` method (#117)
  - All formula-based scores now properly capped at 95%
  - Only authoritative signals (source_library, manual_correction, existing_media, exact_match) return 100%
  - Introduced `FORMULA_CONFIDENCE_CAP` constant for consistency
- **Legacy feature deprecation warnings:** Added UI warnings for deprecated features (#117)
  - Rule Builder now displays prominent deprecation notice guiding users to Migration Wizard or Policy Builder
  - Library Detail view shows deprecation warning for Event Detection, guiding users to Event Presets
  - Both features follow v0.37.0 deprecation timeline (functional in v0.37, removed in v0.39)
  - Classification Rules section reordered below Learned Patterns to prioritize modern features
  - Classification Rules title updated to include "(Deprecated)" marker
- **Policy Stats UI theme fixes:** Corrected Policy Stats Dashboard to use dark theme
  - Fixed `StatCard.vue` - changed white background to dark (`#1f2937`), updated text colors
  - Fixed `LiveFeed.vue` - changed white background to dark, updated borders and text colors
  - Updated hover states and correction badge colors for dark theme consistency
- **Sidebar reorganization:** Restructured sidebar into 5 logical sections with headers
  - **Dashboard** - Home/Dashboard link
  - **Media** - Libraries, Request, Activity
  - **Classification** - Policies, Patterns, Tuning
  - **Analytics** - History, Statistics, Policy Stats
  - **Admin** - Migration, Queue, Settings, System
  - Added uppercase section headers with muted styling
  - Reduced nav item padding for more compact layout
  - Added scroll support for overflow on smaller screens
  - Improved workflow by grouping related features together

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
