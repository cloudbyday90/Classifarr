# Classifarr Release Notes

## [v0.42.0-alpha] - 2026-02-14

**Title: Command Center - One Surface for Everything**

> [!IMPORTANT]
> This release introduces the new Command Center as the default operational surface. Previous Dashboard, Activity, and Queue pages redirect automatically with guidance notices.

### 🎉 What You'll Notice
- **One page, all actions** - No more bouncing between Dashboard, Activity, and Queue
- **Live processing view** - Visual stepper shows exactly where each classification is in the 8-step pipeline
- **Inline decisions** - Resolve policy questions with Confirm/Change/Yes/No without leaving the page
- **Smart notifications** - Bell icon shows unread count, full panel for history, deep-links to relevant sections

### 📊 Quick Visual
```
┌─────────────────────────────────────────────────────────┐
│  COMMAND CENTER                        Live  2:14 PM    │
│  AI Online  │  Worker Active  │  2 Queue  │  0 Action   │
├─────────────────────┬───────────────────────────────────┤
│  PROCESSING         │  NEEDS ATTENTION                  │
│  ──────────────     │  ─────────────────                │
│  Inception (2010)   │  ┌─────────────────────────────┐  │
│  67% ████░░░░       │  │ The Matrix (1999)           │  │
│  ▶ AI Analysis      │  │ 78% confidence              │  │
│  ✓ ✓ ✓ ○ ○ ○ ○ ○    │  │ [Confirm] [Change]          │  │
│                     │  └─────────────────────────────┘  │
│  Up Next (3)        │                                   │
├─────────────────────┴───────────────────────────────────┤
│  Errors −  Enrichment (89%) −  Recently Completed       │
│  Quick Add +  Libraries −  Today's Summary +            │
└─────────────────────────────────────────────────────────┘
```

### ✨ Highlights

**Command Center**
- Split-layout with Processing + Needs Attention always visible
- Visual phase stepper: Queued → Metadata → Policy → RAG → Signal → AI → Decision → Notification
- Collapsible secondary sections expand when you need them
- Mobile bottom sheet for Processing details on small screens

**Notifications**
- Bell icon in header with live unread count
- Panel groups unread first, then read items
- Mark All Read in one click
- Open-target routing lands on exact Command Center section

**Smart Data Layer**
- Adaptive polling: fast when active, slow when idle
- Tab visibility awareness: pauses when hidden
- Freshness indicator shows Live/Updating status
- No page refresh needed after actions

### 🔄 Transition Notes

**Legacy Routes Redirect Automatically:**
- `/dashboard` → Command Center
- `/activity` → Command Center `#processing`
- `/queue` → Command Center `#processing`

A dismissible notice explains the change on first visit.

**Navigation Changes:**
- Activity and Queue removed from sidebar (functionality is in Command Center)
- Migration page removed from primary navigation
- History remains available for audits and reclassification

### 👥 Who This Helps
- **Daily operators:** Resolve everything on one page without context switching
- **Mobile users:** Touch-friendly layout with bottom sheet for details
- **Admins:** Global notifications surface issues before they become problems

### 📚 Want Technical Details?
See `CHANGELOG.md` for full implementation notes, test scope, and migration-level details.

---

## [v0.41.3-alpha] - 2026-02-11

**Title: Smarter Low-Confidence Routing**

> [!IMPORTANT]
> This upgrade is active by default after update. No observation window is required.

### 🎉 What You’ll Notice
- More low-confidence items can now resolve automatically with a smarter second check.
- Better safety: if quality trends regress, Classifarr can automatically switch to a safer diagnostic mode.
- Cleaner operations: less noisy warnings and clearer request error responses.

### 📊 Quick Visual
```text
Classification flow
Pass 1 🧠  →  Targeted Pass 2 🔎  →  Apply only if better ✅
                     ↘ not better / unavailable → keep safe baseline 🛡️

Safety flow
apply 🟢  ──(sustained regression detected)──▶  shadow 🛡️
```

### ✨ Highlights
- Immediate-apply low-confidence enhancement is now on by default.
- New automatic fallback + optional auto-re-enable controls are available in settings.
- Policy preset picker now shows usage context (`Used in X policies`) to make selection easier.

### 🔧 Reliability Improvements
- Invalid JSON requests now return a cleaner, user-friendly 400 response.
- OMDb HALF_OPEN throttle warnings are reduced to prevent log spam.
- Added release-scoped log reset for cleaner post-upgrade baseline visibility.

### 👥 Who This Helps
- **General users:** fewer manual interventions on tricky/ambiguous items.
- **Operators/admins:** safer rollout behavior, clearer fallback diagnostics, and less noisy logs.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full implementation notes, test scope, and migration-level details.

---

## [v0.41.2d-alpha] - 2026-02-07

**Title: Fresh Install Recovery Update**

> [!IMPORTANT]
> If `v0.41.2c-alpha` failed during first-time setup, start fresh on `v0.41.2d-alpha` using a clean data folder/volume.

### ✅ What This Solves
- Fresh installs are now more reliable during database initialization.
- First-login setup flow is fixed (`/login` now correctly routes new installs).
- RAG status display is now consistent and readable.

### 📈 Quick Snapshot
```text
Fresh install reliability   ██████████
Setup flow clarity          █████████░
RAG status clarity          █████████░
```

### 📚 Want Technical Details?
See `CHANGELOG.md` (`v0.41.2d-alpha`) for exact fixes and implementation notes.

---

## [v0.41.2c-alpha] - 2026-02-06

**Title: RAG Settings UX Polish**

### 🎨 What Improved
- RAG Settings now keeps your current tab on refresh.
- Confidence settings naming is clearer and easier to understand.
- Project housekeeping improved (`.tmp/` intermediate files ignored).

### 📈 Quick Snapshot
```text
Settings usability          ████████░░
Navigation consistency      █████████░
Repo cleanliness            ████████░░
```

### 📚 Want Technical Details?
See `CHANGELOG.md` (`v0.41.2c-alpha`) for exact route/UI updates.

---

## [v0.41.2b-alpha] - 2026-02-06

**Title: Smarter Threshold Alignment**

### 🎯 What You’ll Notice
- Discord verification prompts better match your configured policy thresholds.
- Auto-routing now respects policy configuration instead of fixed confidence assumptions.
- CI cleanup behavior is more reliable and easier to run manually when needed.

### 📊 Quick Visual
```text
Before: fixed threshold assumptions ⚠️
After : policy-driven routing rules ✅
```

### 📈 Quick Snapshot
```text
Routing consistency         █████████░
Discord prompt quality      ████████░░
CI cleanup reliability      ████████░░
```

### 📚 Want Technical Details?
See `CHANGELOG.md` (`v0.41.2b-alpha`) for threshold and CI behavior specifics.

---

## [v0.41.2a-alpha] - 2026-02-06

**Title: Reliability Hotfix Pack**

> [!IMPORTANT]
> If you depend on remote poster URLs for external image embedding services, review companion service allowlist settings.

### 🛠️ What Improved
- Better resilience for temporary OMDb/network instability.
- Cleaner and clearer RAG status diagnostics.
- CI workflow hardening for more predictable release behavior.
- Important schema/logging fixes to reduce hidden operational issues.

### 📈 Quick Snapshot
```text
Service resilience          ████████░░
Diagnostics clarity         ████████░░
CI stability                ████████░░
```

### 📚 Want Technical Details?
See `CHANGELOG.md` (`v0.41.2a-alpha`) for dependency and fix details.

---

## [v0.41.2-alpha] - 2026-02-06

**Title: Multimodal RAG Launch (Image + Text)**

This release introduced image-aware retrieval for harder classification cases and made configuration safer by default.

### 🖼️ Big Upgrade
- Classifarr can combine **text + image context** during retrieval.
- This improves matching quality for ambiguous titles with similar names.
- Image embedding mode defaults to disabled, so users stay in control of compute/cost.

### 🧭 Platform Improvements
- Cleaner image embedding settings flow (simpler setup path).
- Stronger migration governance with timestamp checks and schema snapshot discipline.
- Better release hygiene and template cleanup.

### 📊 Quick Visual
```text
Retrieval context
Before: text only  📄
After : text + image 📄🖼️

Safety defaults
Image mode default: OFF ✅
```

### 📈 Quick Snapshot
```text
Retrieval quality potential  █████████░
Config safety by default     ██████████
Migration governance         ████████░░
```

### 📚 Want Technical Details?
See `CHANGELOG.md` (`v0.41.2-alpha`) for full schema, API, and testing detail.

---

## [v0.41.1-alpha] - 2026-02-02

**Release Date:** February 2, 2026

This release strengthens core reliability with a new OMDb Circuit Breaker, standardizes on Node.js 24 LTS, vastly improves dependency hygiene, and fixes several stability issues.

---

## 🎯 Highlights

### 🛡️ Major OMDb Reliability Improvements

We've significantly improved metadata enrichment reliability with industry-standard circuit breaker patterns, extended error handling, and fallback prioritization fixes.

- **Circuit Breaker:** Automatically detects OMDb outages and recovers after a cool-off period.
- **Visual Status:** System Health dashboard now clearly shows connection states (OPEN/CLOSED).
- **Better Fallbacks:** OMDb timeouts now trigger Tavily fallback correctly.

### 🔧 Node.js 24 LTS Standardization

All environments (Docker, CI/CD, local development) now use Node.js 24.11.0+ for consistency and modern feature support. This eliminates "works on my machine" issues and future-proofs the stack.

### 📦 Dependency Hygiene

Updated 12+ packages including `axios`, `express`, and `discord.js` with security fixes and performance improvements. Audit clean with 0 vulnerabilities.

### 🧪 Test Script Standardization

We've robustified our development tools:

- Standardized `npm run test` commands across both Client and Server.
- Fixed invalid path references in test scripts.
- Enforced safe execution (sequential) for integration tests to prevent database conflicts.

---

## 🔥 Critical Fixes

### OMDb Circuit Breaker Pattern (PR #293)

**Problem:** OMDb timeouts were returning null instead of throwing errors, preventing fallbacks.
**Solution:**
✅ Industry-standard 3-state circuit breaker (CLOSED → OPEN → HALF_OPEN)
✅ Automatic recovery after 30-second cool-off period
✅ Visual indicators in System Health dashboard (🔴 OPEN, 🟡 HALF_OPEN)
✅ Breaking change: Now throws errors on timeouts to enable Tavily fallback

### Enhanced OMDb Reliability

- **Cloudflare Error Handling:** Extended retry logic to cover all transient Cloudflare errors (520, 521, 522, 523).
- **Rating Normalization:** OMDb (MPAA) is now the #1 priority source for content ratings, ensuring accuracy.

---

## 📊 Statistics

- **Test Coverage:** 1,573 tests passing (848 server, 287 client, 438 integration)
- **Security Scan:** 0 vulnerabilities
- **Dependency Updates:** 12+ packages updated

---

## 🚨 Breaking Changes

- **OMDb Error Handling:** The OMDb service now throws errors instead of returning null on timeouts to enable Tavily fallback.
- **Node.js Version:** Minimum required version is now Node.js 24.11.0+.

---

## [0.41.0-alpha] - 2026-02-01

**Release Date:** February 1, 2026

This release delivers major improvements to system monitoring, documentation, user experience, and automation workflows.

---

## 🎯 Highlights

### 📊 System Health & Monitoring

- **Health Dashboard Trends (#184):** Visual trend indicators (↗️↘️→) show if services are improving or degrading
- **Last Successful Check:** Track when services were last healthy to diagnose outage duration
- **Per-Instance Monitoring:** Individual health tracking for Radarr/Sonarr instances

### 🔒 Service Awareness

- **Service Lockdown System (#206):** Features auto-disable when required services are unavailable
- **Clear User Guidance:** Tooltips explain requirements and link directly to settings

### 🤖 Smart Automation

- **Discord Verification Learning (#240):** System learns from user feedback to improve future classifications
- **Auto-Enhancement:** Genres, keywords, and studios automatically added to policy preferences
- **Rate Limiting:** Prevents runaway learning with user and library limits

### ⚙️ Configuration Management

- **Unified Confidence Settings (#241):** All thresholds in one intuitive interface
- **Visual Threshold Flow:** See auto-classify, prompt, and manual ranges at a glance
- **Audit Trail:** Track and revert configuration changes

### 💾 Backup & Restore

- **Encrypted Backups (#186):** AES-256-GCM encryption for config backups
- **Replace or Merge:** Choose how to apply backups
- **Complete Audit:** Track all backup operations

### 📚 Documentation

- **Comprehensive API Docs (#188):** Complete API reference with examples
- **Testing Coverage (#227):** 80% line coverage, 75% function coverage enforced
- **Accessibility (#204):** WCAG 2.1 AA compliant dashboard

---

## ✨ New Features

### System & Monitoring

- System Health Dashboard with trend tracking (#184)
- Service lockdown for unavailable dependencies (#206)
- Sync error hygiene with proper 404 handling (#226)

### Automation & Learning

- Discord verification learning from user feedback (#240)
- Auto-learned preferences with conflict detection
- Smart Discord thresholds (85%+ auto-route, 60-84% verify, <60% detailed)

### Configuration

- Unified confidence settings page (#241)
- Backup & restore system with encryption (#186)
- User profile settings page (#187)

### User Experience

- Classification signal breakdown in history (#185)
- Dashboard accessibility improvements (#204)
- Copyright compliance automation (#198)

### Documentation

- Comprehensive API documentation (#188)
- Testing coverage enforcement (#227)
- Migration guides and release notes

---

## 🔧 Improvements

### Error Handling

- Sync endpoints return 404 for missing libraries (#226)
- Consistent error format: `{ "error": "..." }`
- Reduced log noise for expected failures

### Testing & Quality

- 80% line coverage, 75% function coverage (#227)
- Integration tests for all major features
- Logger mocking for clean test output

### Security

- Copyright compliance CI checks (#198)
- Password strength enforcement
- Rate limiting on sensitive endpoints

---

## 🗑️ Removed

### Event Detection System Retirement

- **Database:** Removed event_detection_type and event_sub_type columns (migration 072) (#228)
- **Backend:** Removed detectEventContent() and all event detection code (#229)
- **Frontend:** Removed all event/holiday UI controls (#225)
- **Presets:** Removed 6 event presets (event_holiday, event_sports, event_ppv, event_concert, event_standup, event_awards)

**Migration:** Event detection now handled exclusively through PolicyEngine presets (migrated in v0.37.0)

---

## 📊 Statistics

- **14 Pull Requests Merged**
- **15+ Major Features Added**
- **3 Legacy Systems Retired**
- **100% Critical Test Coverage**
- **WCAG 2.1 AA Accessibility**

---

## 🙏 Contributors

Thank you to all contributors who made this release possible!

- @cloudbyday90
- Copilot coding agent

---

## 📖 Documentation

- [Migration Guide](docs/migration/v0.41.0-alpha.md)
- [API Documentation](docs/api/README.md)
- [Roadmap](docs/roadmap.md)
- [CHANGELOG](CHANGELOG.md)

---

## 🐛 Known Issues

None at this time.

---

## 🔮 What's Next (v0.42.0)

- RAG Similarity Visualization (#185)
- Advanced Policy Analytics
- Performance Optimizations
- Enhanced Policy Setup Experience

See [Roadmap](docs/roadmap.md) for details.

---

## v0.40.5d-alpha

**Title: \*arr Quality Profile Respect Fix**

### Fixes

- **Quality Profile Routing**: Radarr/Sonarr add requests now coerce `qualityProfileId` to a valid numeric ID and fall back to the instance config profile before defaulting, preventing "Any" quality selection when a profile is configured.

## v0.40.5c-alpha

**Title: Discord Verification Fix**

### Fixes

- **User Verification**: Fixed "Failed to process verification" error when clicking "Yes, Correct" or "No, Choose Different" in Discord.
  - Added specific error logging to ephemeral replies for better debugging.
  - Handled cases where `library_id` is missing in AI-classified items to prevent database errors.
- **Post-Migration Constraint Fix**: Added a new migration that expands `classification_history` status values to include `verified` and `reclassified` for existing installs.

## v0.40.5a-alpha

**Title: pgvector CPU Compatibility Hotfix**

### Fixes

- **Non-AVX CPU Safety**: pgvector now ships with generic + AVX variants and auto-selects the best binary at startup (AVX when supported, generic otherwise), preventing PostgreSQL crashes during vector similarity queries.
- **AVX2 Optimization**: Added an AVX2 pgvector variant and prefer it when the CPU supports AVX2 for faster similarity search.
- **Dashboard Visibility**: Added a banner when pgvector is running in generic mode so users can confirm CPU compatibility status.
- **Build Portability**: Generic pgvector builds now follow upstream guidance (`OPTFLAGS=""`) for maximum CPU compatibility.
- **Upgrade Recovery Marker**: Startup now records the previous version and runs a one-time PostgreSQL restart when upgrading from v0.40.5-alpha.
- **Verification Constraint Fix**: `classification_history` now accepts verification/reclassification status values to prevent constraint errors.

## v0.40.5-alpha

**Title: PolicyEngine + AI Pipeline, \*arr Routing, and Webhook Specials Toggle**

### Features

- **AI Analysis Phase**: Added AI analysis as an explicit phase in the classification pipeline with updated progress tracking.
- **Policy Question Enrichment**: Clarification prompts now include policy scores, weights, RAG summary, and AI rationale.
- **Webhook Specials Toggle**: Optional `include_specials` control to keep or exclude season 0 entries from Overseerr payloads.

### Fixes

- **OMDb Resilience**: Cloudflare 520/521/523 errors now retry/skip gracefully.
- **Clarification JSON Handling**: Safe parsing when `classification.metadata` is already JSONB.
- **Source Library Confidence**: Source-library reconciliations now report 100% confidence.
- **ProviderLockService Init**: Configuration loads on explicit startup, avoiding DB access during import.
- **Test Stability**: Logger DB persistence now uses explicit injection; integration tests set a deterministic `API_KEY_ENCRYPTION_KEY`.
- **Node 25 Test Warnings**: Jest runner strips invalid `--localstorage-file` options and disables experimental web storage.
- **Integration Test Noise**: Setup/migration logs are now opt-in via `INTEGRATION_TEST_VERBOSE`.
- **Migration Tracking**: Integration test setup now records applied migrations in `schema_migrations`.
- **Swagger Doc Fix**: API keys OpenAPI docs now parse cleanly (multi-line description block).

### Improvements

- **PolicyEngine Flow**: Policy signals + RAG feed AI analysis before any policy_prompt is generated.
- **\*arr Routing**: Sonarr uses TVDB lookup data, requested season monitoring, and search-on-add settings; Radarr respects quality profile and search-on-add.

---

## v0.40.4-alpha

**Title: Policy-Driven Clarification, Discord Resolution & \*arr Routing**

### Features

- **Policy-Driven Clarification**: Questions now source dynamically from policy presets and candidate libraries.
- **Smart Language Prompts**: Language questions are suppressed unless language presets exist and language is missing/non-English.

### Fixes

- **Discord Clarification Resolution**: Selections now correctly assign libraries and resolve pending items.
- **\*arr Routing**: Mapped libraries route even when legacy `arr_id` fields are missing.
- **Policy Question Stability**: Hardened parsing prevents invalid JSON errors during resolution.

### Improvements

- **Test Stability**: Improved reliability of integration tests by isolating service side effects, preventing random failures during development and CI runs.
- **Discord Prompts**: Clarify-tier prompts now rely on policy questions or manual selection (seeded buttons removed).
- **Auto-Migration**: One-time backfill aligns existing \*arr mappings with library fields.
- **Data Integrity**: Method/status constraints updated to prevent DB errors during manual resolutions.
- **Test Runner Stability**: Node 25 web storage warnings removed and Vue test noise reduced for cleaner CI output.

---

## v0.40.3a-alpha

**Hotfix: Broken Onboarding Link**

### Fixes

- **Dashboard Onboarding**: Fixed "Connect Media Server" button linking to a non-existent page (404). Now correctly directs to the Media Server settings tab.

---

## v0.40.3-alpha

**Title: Polished Branding & Smarter Sync**

> [!IMPORTANT]
> This release includes a fix for media server connection issues. If you previously encountered a "duplicate key" error when changing servers, this update resolves it.

### New Features

- **New Logo & Favicon**: Updated application branding with a modern, flush logo and optimized favicon.
- **Differential Library Sync**: Changing your Media Server IP/URL (for the same server) no longer wipes your classification history. The system now intelligently matches libraries by external ID.

### Fixes

- **Change Server Error**: Fixed a database constraint violation that prevented changing media servers if separate libraries had the same name (e.g. "Movies").
- **Connect & Save Button**: Clarified UI feedback when saving server configurations.

### Improvements

- **Test Suite**: comprehensive test coverage for backend API and frontend components.

---

## v0.40.2a-alpha

**Title: UI Color Opacity Fix**

### Fixes

- **Tailwind v4 Opacity Issue**: Fixed widespread issue where badges, modals, and overlays appeared as solid "blobs" with invisible text.
  - Migrated 30+ instances of legacy `bg-opacity-{value}` utilities to modern slash syntax (e.g., `bg-green-500/20`).
  - Affected components: Badges, Modal Overlays, Policy Builder, Preset Cards, and Security Settings.
  - Text in badges is now visible, and modal backdrops are correctly transparent.

---

## v0.40.2-alpha

**Title: Activity Dashboard Ghost Tasks Fix**

### Fixes

- **Fixed Ghost Tasks in Activity Dashboard**: Resolved critical issue where 793 ghost tasks (empty progress bars) appeared in the Activity page.
  - **Root Cause**: Express route ordering bug - the `/api/classification/progress` endpoint was registered AFTER the `*` catch-all, causing API to return HTML instead of JSON.
  - The frontend iterated over the 794-character HTML string as an array, creating empty task items.
- **Source Library Filtering**: Added SQL and WebSocket filters to hide `source_library` sync tasks from the Activity dashboard.
- **Socket.IO Path Fix**: Fixed socket.io path mismatch (client used default `/socket.io`, server used `/ws`).
- **Dockerfile Build Fix**: Changed pgvector installation from `git clone` to `curl` download to resolve network issues.

### Improvements

- **Event Name Alignment**: Fixed event listener names to match server events (`classification:progress` instead of `task:progress`).
- **Activity Room Subscription**: Added proper subscription to `activity` WebSocket room on connect.
- **Client-Side Validation**: Added rejection of ghost tasks (empty titles) and source_library tasks in the frontend.

---

## v0.40.1a-alpha

**Title: CI/CD Build Fixes**

### Fixes

- **TailwindCSS v4 Compatibility**: Added `@reference` directive to `Sidebar.vue` scoped styles to fix build failures with TailwindCSS v4.
  - Scoped styles using `@apply` now correctly reference the theme CSS file.
- **Password Visibility Toggle**: Fixed JavaScript syntax error in `PasswordInput.vue` where `visible = visible!` was invalid (corrected to `visible = !visible`).

---

## v0.40.1-alpha

**Title: SWR Persistence & Modernization**

> [!IMPORTANT]
> This release includes a major upgrade to **Tailwind CSS v4**. Please ensure your browser cache is cleared if you experience UI issues.

### New Features

- **SWR (Stale-While-Revalidate) Caching for Dashboard and Statistics**:
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
- **Circuit Breaker**: Added strict offline handling for Ollama embeddings to prevent log spam.
- **Tailwind CSS v4**: Migrated client to Tailwind CSS v4 for better performance and modern features.

### Improvements

- **Performance**: Significant frontend performance boost from Tailwind v4.
- **Dependencies**: Updated Core Stack (Vue 3.5, Pinia 3.0, Jest 30, pg 8.17).
- **UI**: Cleaner Dashboard without manual refresh button.
- **Backfill**: Idle backfill now pauses intelligently when provider is offline.

### Fixes

- Fixed integration tests for Dashboard component.
- Fixed `localStorage` environment issues in tests.

---

## v0.40.0-alpha

**Title: Queue Service Refactor, Health Checks, API Keys & UI Enhancements**

### Improvements

- **Queue Service Refactor**: Transitioned QueueService from singleton to factory pattern with Dependency Injection to improve test stability.
- **Cleanup**: Removed deprecated test files.

### Fixes

- **CARSA Headers**: Fixed header handling in CARSA middleware.
- **Service Stability**: Reverted unstable changes in classification service.

---

### ðŸ¥ Health Check Endpoints for Kubernetes/Docker (#183)

**Comprehensive monitoring and health check endpoints for container orchestration**

#### New Endpoints

1. **`/api/system/health/live` - Liveness Probe**
   - Fast response (<10ms)
   - Returns 200 if application is running
   - Does NOT check external services
   - Perfect for Kubernetes liveness checks
   - No authentication required

2. **`/api/system/health/ready` - Readiness Probe**
   - Checks critical services (database only)
   - Returns 200 if ready to serve traffic
   - Returns 503 if not ready
   - Perfect for Kubernetes readiness checks
   - No authentication required

3. **`/api/system/health` - Enhanced Health Status**
   - Overall system health (healthy/unhealthy)
   - Application version
   - System uptime (human-readable format)
   - Database connectivity status
   - Requires authentication

4. **`/api/system/health/services` - Detailed Service Health**
   - Complete breakdown of all services:
     - PostgreSQL database
     - Media server (Plex/Emby/Jellyfin)
     - All Radarr instances
     - All Sonarr instances
     - AI provider (Ollama/OpenAI/etc.)
     - Queue worker status
   - Each service includes:
     - Status: `healthy`, `degraded`, `unhealthy`
     - Response latency (ms)
     - Last check timestamp
     - Error message (if unhealthy)
   - Overall system status with summary counts
   - Requires authentication

#### Features

- **Smart Caching**: Service health checks cached for 30 seconds to reduce load
- **Queue Worker Monitoring**: Monitors task queue for stuck/stale jobs
- **Graceful Degradation**: App stays up even if external services are down
- **Comprehensive Testing**: 12 unit tests ensuring reliability

#### Docker/Kubernetes Integration

**Docker Compose:**

```yaml
services:
  classifarr:
    healthcheck:
      test:
        ["CMD", "curl", "-f", "http://localhost:21324/api/system/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

**Kubernetes Deployment:**

```yaml
livenessProbe:
  httpGet:
    path: /api/system/health/live
    port: 21324
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /api/system/health/ready
    port: 21324
  initialDelaySeconds: 5
  periodSeconds: 5
```

#### Response Examples

**GET /api/system/health**

```json
{
  "status": "healthy",
  "version": "0.39.7b",
  "uptime": "3d 14h",
  "database": "connected",
  "timestamp": "2026-01-17T15:30:00.000Z"
}
```

**GET /api/system/health/services**

```json
{
  "overall": "healthy",
  "services": [
    {
      "name": "PostgreSQL",
      "status": "healthy",
      "latency": 5,
      "timestamp": "2026-01-17T15:30:00.000Z"
    },
    {
      "name": "Plex",
      "status": "healthy",
      "latency": 45,
      "timestamp": "2026-01-17T15:30:00.000Z"
    }
  ],
  "summary": {
    "total": 7,
    "healthy": 7,
    "unhealthy": 0
  },
  "timestamp": "2026-01-17T15:30:00.000Z"
}
```

---

### ðŸ” API Key Management System (#182)

**Secure third-party integrations and automation with API keys**

#### New Features

- **Create API Keys**: Generate secure API keys with custom names and permission levels
  - `read_write`: Full access to all endpoints
  - `read_only`: Restricted to GET endpoints only
- **Security Settings Page**: New Settings â†’ Security page for managing API keys
- **Dual Authentication**: All API routes now support both JWT tokens (web UI) and API keys (integrations)
- **Encrypted Storage**: Keys stored using AES-256-GCM encryption (can be retrieved by authenticated users)
- **Key Retrieval**: View full API keys again when logged in (unlike passwords, keys can be revealed)
- **Usage Tracking**: Monitor last used timestamp and IP address for each key
- **Active/Inactive Toggle**: Temporarily disable keys without revoking them
- **Auto-Generated Default Key**: First startup creates a default read-write API key (shown in logs)

#### Security Features

- Keys use `clf_` prefix with 32-character base64url-encoded suffix
- Encrypted storage allows secure retrieval (not one-way hashed like passwords)
- Permission enforcement middleware protects write operations
- Rate limiting on key management endpoints
- Activity tracking with IP address logging

#### UI Features

- Create, view, and revoke keys through Settings â†’ Security
- Copy keys to clipboard with one click
- Reveal full keys using eye icon (keys are encrypted, not hashed)
- Inline name editing (double-click)
- Active/inactive status toggle
- Last used timestamp and IP display

#### Usage Example

```bash
# Create a read-only key in Settings â†’ Security

# Use it for monitoring
curl -X GET http://localhost:21324/api/libraries \
  -H "X-API-Key: clf_your_key_here"

# Create a read-write key for automation

# Use it for triggering syncs
curl -X POST http://localhost:21324/api/libraries/1/sync \
  -H "X-API-Key: clf_your_key_here" \
  -H "Content-Type: application/json"
```

#### Protected Routes

- **Libraries**: GET (read-only), POST/PUT/DELETE (read-write)
- **Queue**: GET (read-only), POST/DELETE (read-write)
- **Stats**: GET (read-only)
- **Media Sync**: GET (read-only), POST (read-write)

---

### ðŸ“Š Enhanced UI for Sync Status and CARSA Warnings

**Title: Enhanced UI for Sync Status and CARSA Warnings**

### What's New

- **Real-time Sync Progress**: The Libraries page now shows live sync status and progress
  - See which library is currently being synced
  - Visual progress bar shows completion percentage
  - "Sync Libraries" button is disabled during active syncs to prevent conflicts
  - Button displays current sync status (e.g., "Syncing... 45%")

- **Improved CARSA Warning Dialog**: Replaced basic confirmation with a comprehensive dialog that explains:
  - Exactly what will be deleted (classification history, embeddings, library data)
  - What will be preserved (policies, AI settings, Discord config, ARR connections)
  - What will be auto-restored (Radarr/Sonarr library mappings)
  - Note about RAG embedding rebuild

- **Post-CARSA Notifications**: New warning banner appears if library mappings couldn't be restored
  - Shows prominently on Libraries and Settings pages
  - Quick links to configure Radarr and Sonarr settings
  - Can be dismissed once reviewed

### How It Helps

- **Better Visibility**: No more wondering if sync is running or stuck - see real-time progress
- **Informed Decisions**: Clear warning before CARSA helps prevent accidental data loss
- **Faster Recovery**: If mappings fail to restore, you'll know immediately with guidance on what to check

### For Users

After updating:

1. Navigate to Libraries page - you'll see the new sync status display
2. Try running "Sync Libraries" - watch the progress bar update in real-time
3. Go to Settings â†’ Queue â†’ Advanced Operations
4. Click "Clear & Re-sync All" to see the new comprehensive warning dialog
5. If any library mappings can't be restored after CARSA, you'll see a warning banner with quick links to fix them

---

## Previous Release

**Title: Smart Preservation of Radarr/Sonarr Library Mappings During CARSA**

### What's Fixed

- **Broken library mappings after CARSA** (Issue #177): Radarr and Sonarr library mappings are now automatically preserved and restored after running "Clear and Re-sync All"
- **Manual reconfiguration eliminated**: No more need to manually remap libraries to Radarr/Sonarr instances after CARSA

### What's New

- **Intelligent Mapping Restoration**: System automatically remaps libraries using:
  - **Priority 1**: Media server library ID (most reliable - works even if library renamed)
  - **Priority 2**: Library name + media type (fallback if server ID changes)
- **Multi-Instance Support**: Works with multiple Radarr and Sonarr instances (e.g., Radarr 4K, Radarr 1080p)
- **User Notifications**: If any mappings can't be restored automatically, you'll see a notification with details
- **Quality Profile Preservation**: Quality profiles and root folder paths remain intact

### How It Works

When you run Clear and Resync:

1. ðŸ” **Snapshot**: System captures all library info BEFORE clearing (including media server IDs)
2. ðŸ—‘ï¸ **Clear**: All data is deleted as usual
3. ðŸ”„ **Re-sync**: Fresh libraries are synced from your media server with NEW IDs
4. ðŸ”— **Remap**: System matches old libraries to new ones and updates all mappings
5. âœ… **Notify**: You're notified of successful remaps and any that failed

**Example**: Your "Movies 4K" library had ID 100, mapped to Radarr instance 1. After CARSA, it gets NEW ID 200, but your Radarr mapping is automatically updated to point to 200 instead of 100. No manual work needed!

### For Users

After updating:

1. Run Clear and Resync as usual
2. Your Radarr/Sonarr library mappings will be preserved automatically
3. If any mappings couldn't be restored, you'll see a notification explaining why
4. Check Settings â†’ Radarr/Sonarr to verify mappings (should match what you had before)

**Note**: This only works for mappings in the `library_arr_mappings` table. If you have custom settings elsewhere, they may need manual verification.

---

## Previous Release

**Title: Fix CARSA to Use Fresh Library Sync (Prevents Stale ID References)**

### What's Fixed

- **"Library not found" errors after CARSA**: Fixed the system attempting to sync using OLD library IDs that were just deleted
- **Clear and Resync (CARSA)** now properly deletes ALL tables with references to media server/library/classification data
- **Stale library references**: The system now performs a **fresh sync from the media server** instead of querying deleted library IDs
- Fixed orphaned embeddings and collections that were not being cleaned up

### What's New

- **Fresh Sync Method**: Added `syncAllLibraries()` which creates NEW library entries from the media server (not reusing old IDs)
- **Cache Clearing**: In-memory caches are now cleared before re-sync for a truly fresh start
- **Complete Reset**: System now behaves as if freshly installed after CARSA

### How It Works Now

After running Clear and Resync:

1. All library data is deleted (including the libraries themselves)
2. In-memory caches are cleared
3. **NEW** libraries are created by fetching from your media server (Plex/Emby/Jellyfin)
4. Library content is synced using the **NEW** library IDs
5. Gap analysis runs using fresh data

**Example**: If your old libraries had IDs 100, 101, 102, after CARSA they'll have completely NEW IDs like 200, 201, 202. No stale references anywhere!

### What Changed

The Clear and Resync function now deletes these additional tables:

- **Classification Embeddings**: Previously orphaned embeddings are now properly deleted
- **Library Profiles**: Auto-generated library statistics are now cleared
- **Collections**: Media server collections are now cleared
- **Libraries**: The libraries table itself is now cleared (previously skipped)

All deletions now happen in dependency-safe order to prevent foreign key constraint violations.

### For Users

If you experienced "Library not found" errors or orphaned data after running Clear and Resync, this update resolves those issues. After updating, run Clear and Resync again for a complete fresh start. The system will create brand new library entries from your media server.

---

## v0.39.7b-alpha

**Title: Remove Non-Working Preload Logic**

### Removed

- **preloadModel()**: Removed from `ollama.js` - the `/api/load` endpoint doesn't exist in Ollama's API
- **Model preloading logic**: Removed from `idleBackfillService.js`

### Note for Users

For optimal performance with multiple models (e.g., classification + embedding), configure your Ollama environment:

- `OLLAMA_KEEP_ALIVE=-1` - Keeps models loaded indefinitely
- `OLLAMA_MAX_LOADED_MODELS=2` - Allows both models to stay loaded simultaneously

---

## v0.39.7a-alpha

**Title: Logger Import Hotfix**

### Fixes

- **PROFILE_SCORE Weight**: Fixed profile score calculation in signal-based confidence
- **Fallback Status**: Fixed classification fallback status handling when AI is unavailable
- **Logger Error Handling**: Fixed `logger.error is not a function` error in IdleBackfillService
  - Added try-catch around database persistence in `logger.error()` and `logger.warn()`
  - Console and file logging now complete synchronously before async DB persistence

### New Features

- **AI Retry Mechanism**: Classifications that fail due to AI unavailability are now queued for automatic retry
  - New `pending_retry` status and `queued_for_retry` method
  - Migration 065: Added `retry_after`, `retry_count`, `max_retries` columns
  - Retry queue processed every 5 minutes

### Removed

- **Smart Suggestions from Discord**: Removed deprecated `sendSmartSuggestionNotification()` from Discord bot
  - Discord no longer links to deprecated rule-builder
  - All classification flows now use PolicyEngine

### Added

- **Logger Tests**: 15 new tests for logger resilience when database fails
- **IdleBackfillService Tests**: 11 new tests for model preloading, configuration, and lifecycle
- Total test count increased from 577 to 603

---

## v0.39.6-alpha

**Title: Intelligent Model Swapping & RAG Optimization**

### New Features

- **Intelligent Model Swapping**: Reduces overhead when sharing a GPU between classification and embedding tasks by preventing unnecessary model reloads.
- **Smart Preloading**: Idle backfill now proactively loads the embedding model into VRAM before starting batch processing.
- **Model Affinity Tracking**: The system now tracks which model is currently active, optimizing lock acquisition strategies.

### Improvements

- Added `keep_alive` support to Ollama embedding requests for better batch performance.
- Increased default provider lock wait time from 60s to 120s to prevent timeouts during heavy load.
- Improved classification preemption logic to interrupt embedding tasks more reliably.

### Fixes

- Fixed an issue where classification requests could timeout waiting for long-running embedding operations.

---

## v0.39.5b-alpha

**Hotfix: RAG Pending Count & Migration Fix**

### Bug Fixes

- **RAG Overview Pending Count**: Overview "Pending" now correctly shows items without embeddings (was always showing 0)
  - `getStats()` now queries actual items needing embeddings instead of retry queue
  - Matches the count shown in Manual Backfill
- **Database Migration 064**: Fixed schema error in `064_backfill_library_associations.sql`
  - Removed invalid `updated_at = NOW()` reference (column doesn't exist in classification_history)
  - All integration tests now passing (309/309)

### Added

- **Database Resilience Tests**: New `database-resilience.test.js` to prevent regression of Exit 255 crash bug
  - Verifies `process.exit` is not in database config
  - Tests pool error handler gracefully handles ECONNRESET and connection terminated errors

---

## v0.39.5a-alpha

**Hotfix: Database Connection Crash**

### Critical Bug Fix

- **Container Crash on Database Errors**: Removed `process.exit(-1)` from database pool error handler
  - Transient database connection errors were killing the entire application (Exit 255)
  - Now logs errors and allows connection pool to recover naturally
  - Fixes container crashes on Unraid and other Docker deployments

---

## v0.39.5-alpha

**Critical Bug Fixes - Sync Reconciliation & RAG Embedding Issues**

### Critical Bug Fixes

#### CRITICAL: Sync Reconciliation Database Error ðŸ”¥

- **Previous Bug**: Sync reconciliation failing with `column "updated_at" of relation "classification_history" does not exist`
- **Error ID**: `026eef91-2e2c-45f4-9316-bd5dc15f1185`
- **Root Cause**: PR #164 added `updated_at = NOW()` to UPDATE queries for tables that don't have this column
- **Fix**:
  - Removed `updated_at = NOW()` from classification_history UPDATE query
  - Removed `updated_at = NOW()` from learned_corrections UPDATE query
- **Impact**: Library syncs now complete successfully without database errors

#### RAG Pending Count Inconsistency ðŸ“Š

- **Previous Bug**: Different pending counts shown in Overview (0) vs Backfill tab (4489)
- **Root Cause**: Inconsistent query patterns and library_id filtering
- **Fix**:
  - Standardized all pending count queries to use NOT EXISTS pattern
  - Removed `library_id IS NOT NULL` filter to count ALL items without embeddings
  - Updated overview, manual backfill, idle backfill, and scheduled backfill services
- **Impact**: Consistent pending counts across all RAG tabs

#### Backfill Progress Display Issues ðŸ“ˆ

- **Previous Bug**: Progress showing impossible values (1200/1160) and negative ETA (-1s)
- **Root Cause**:
  - Total set once at start, never updated when new items added during backfill
  - No handling for edge cases where processed > total
- **Fix**:
  - Made getStatus() async to dynamically query current pending count
  - Total now calculated as `max(initialTotal, processed + currentPending)`
  - Progress clamped to never exceed 100%
  - ETA uses Math.max(0, ...) to prevent negative values
- **Impact**: Accurate progress display even when items added during backfill

#### Idle Backfill Not Processing Items â¸ï¸

- **Previous Bug**: Idle backfill creating runs with total=0 and processing nothing
- **Root Cause**: Idle backfill didn't calculate or set total when creating backfill_runs record
- **Fix**:
  - Added getPendingCount() method to idle backfill service
  - Idle backfill now sets total when creating backfill_runs record
- **Impact**: Idle backfill now correctly processes pending items

### Files Changed

- `server/src/services/mediaSync.js` - Removed invalid updated_at references
- `server/src/routes/rag.js` - Standardized pending count queries, made getStatus calls async
- `server/src/services/manualBackfillService.js` - Dynamic total calculation, async getStatus
- `server/src/services/idleBackfillService.js` - Added getPendingCount, set total on start
- `server/src/services/scheduledBackfillService.js` - Standardized pending count query

## v0.39.4-alpha

**Comprehensive Bug Fix & Stability Release**

### Critical Bug Fixes

#### Integration Test Stability ðŸ§ª

- **Previous Bug**: Integration tests failing due to missing `pgvector` extension and database mocking conflicts
- **Fix**: Upgraded test container to `pgvector/pgvector:pg15` and refactored `rag-api` tests
- **Impact**: Ensures reliable verified builds and prevents regression

#### Wrong AI Model Selection ðŸ¤–

- **Previous Bug**: Classification always used hardcoded `qwen3:14b` model instead of configured model
- **Root Cause**: Code read from deprecated `ollama_config` table instead of `ai_provider_config.ollama_model`
- **Fix**: Updated classification service to read from correct config table
- **Impact**: Classifications now use your configured model (e.g., `gemma3:12b`)
- **Fallback**: Defaults to `llama3.2` when no model configured (instead of `qwen3:14b`)

#### Library Profile Generation Failure ðŸ“Š

- **Previous Bug**: Profile regeneration failed with `function jsonb_typeof(text[]) does not exist` error
- **Root Cause**: Code used JSONB functions on TEXT[] array columns
- **Fix**: Changed to use `unnest()` for PostgreSQL TEXT[] arrays
- **Impact**:
  - Profile regeneration now works correctly
  - Genre distribution statistics display properly
  - Movies no longer misclassified due to broken profile scoring
  - All items no longer stuck at 55% confidence

#### RAG Performance Optimization âš¡

- **Previous Behavior**: RAG semantic search ran 10-12+ times per classification (once per library)
- **Fix**: Added caching to call RAG once per classification and reuse results
- **Impact**:
  - 10-12x performance improvement for classifications
  - Reduced load on embedding provider
  - Faster classification response times

#### Dashboard Awaiting Decision Display ðŸ“‹

- **Previous Bug**: "Awaiting Decision" count showed 0 even when items were pending
- **Root Cause**: Incorrect API response parsing (missing `.data` property)
- **Fix**: Corrected to access `pendingRes.data.count`
- **Impact**: Dashboard now shows accurate count of items needing user input

#### Dashboard Library Name Display ðŸ·ï¸

- **Previous Bug**: Items awaiting decision showed "â†’ " with no library name
- **Root Cause**: `library_name` is NULL for awaiting items (by design), but UI didn't handle this
- **Fix**: Show "â³ Awaiting Decision" for items with `status='awaiting_decision'`
- **Impact**: UI now clearly indicates which items need decisions

#### Plex Sync Reconciliation ðŸ”„

- **Previous Bug**: Manually moving files to correct Plex library didn't update classification history
- **Behavior**:
  - User moves file to correct library in Plex
  - Plex scans and shows item in new library
  - Classifarr syncs and updates `media_server_items.library_id`
  - BUT classification history still shows `status='awaiting_decision'`
- **Fix**: Added reconciliation logic after sync completes:
  - Finds items that were awaiting decision but now exist in a Plex library
  - Updates classification history to `status='completed'`
  - Creates learned corrections for future classifications
- **Impact**:
  - Manual Plex library placements now automatically resolve classification questions
  - Future classifications of same content use learned preference
  - No more manual cleanup of classification history needed

### Testing

- Added comprehensive unit test suite covering all bug fixes
- All tests passing with 100% coverage of fixed code paths

### Files Changed

- `server/src/services/classification.js` - AI model selection fix
- `server/src/services/libraryProfileService.js` - Genre distribution fix
- `server/src/services/policyEngine.js` - RAG caching optimization
- `server/src/services/mediaSync.js` - Plex sync reconciliation
- `client/src/views/Dashboard.vue` - Dashboard display fixes
- `server/src/__tests__/bug-fixes.test.js` - Comprehensive test suite

### Verified Already Fixed

- **Discord Bot Initialization**: Configuration save correctly sets `enabled=true`
- **Rating Normalization**: Database UPDATE correctly applied after normalization

---

## v0.39.3

**Fix: Data Consistency, RAG UI Display & Post-Upgrade System**

### Critical Bug Fixes

#### library_name Data Consistency ðŸ”§

- **Previous Bug**: When classifications were corrected via Discord or reclassification service, the `library_name` column was not updated, leaving it NULL or stale
- **Impact**: Embeddings were missing library context, making RAG similarity searches less accurate
- **Fix**: Updated all 3 correction locations to set both `library_id` AND `library_name`:
  - Classification corrections API endpoint
  - Discord bot correction handler
  - Reclassification service
- **Data Backfill**: Migration automatically populates missing `library_name` values for existing data
- **Result**: RAG embeddings now include complete library context for better classification accuracy

#### RAG Overview Statistics Display ðŸ“Š

- **Previous Bug**: Total Embeddings and Pending counts showed "0" even when embeddings existed in database
- **Root Cause**: Field name mismatch between backend (`total`, `pendingRetries`) and frontend (`totalEmbeddings`, `pendingCount`)
- **Fix**: Backend now returns both field names for backward compatibility
- **Impact**: RAG Overview tab now displays accurate embedding counts

### New Features

#### Post-Upgrade Task System âœ¨

- **What**: Reusable system for version-specific one-time maintenance operations
- **Why**: Eliminates need for new migrations for each release's maintenance tasks
- **How It Works**:
  - Tasks defined in configuration (not database migrations)
  - Tracks executed tasks in `post_upgrade_tasks` table
  - Runs automatically on server startup after migrations
  - Tasks are idempotent (safe to run multiple times)
- **Available Task Types**:
  - `clear_logs` - Fresh log start for new version
  - `clear_embedding_queue` - Clear retry queue
  - `rebuild_embeddings` - Mark all embeddings as stale
  - `backfill_library_name` - Populate missing library names
  - `clear_stale_retry_queue` - Remove orphaned retry queue entries
- **Future Versions**: Just add tasks to config, no new migrations needed

#### Stale Retry Queue Cleanup ðŸ§¹

- **Previous Bug**: "Pending" count in RAG Overview showed incorrect number (e.g., 6,740 instead of 0) even when all embeddings existed
- **Root Cause**: Retry queue entries were never removed when embeddings succeeded, accumulating orphaned entries
- **Fix**:
  - Added `clear_stale_retry_queue` post-upgrade task to remove orphaned entries on upgrade
  - Added cleanup in `storeEmbedding()` to remove retry queue entry when embedding succeeds
- **Impact**: RAG Overview "Pending" count now accurately reflects actual pending items

#### Settings Page Responsive Layout ðŸ“±

- **Previous Bug**: Settings sidebar scroll was cut off, and mobile users couldn't access the right side content
- **Fix**:
  - Desktop: Sidebar now has independent scroll with proper sticky positioning
  - Mobile: Settings tabs display as horizontal scrollable chips above content
  - Main content area now has `overflow-x-auto` for wide content
- **Impact**: Settings page is now fully accessible on all screen sizes

### Previously Fixed in 0.39.3-alpha

#### Provider Status Now Accurate ðŸ“Š

- **Previous Bug**: Provider Status card always showed "Offline" even when provider was online
- **Fix**: Corrected variable reference (`stats.providerOnline` instead of `providerOnline`) and added `providerOnline` field to API response
- **Impact**: You can now accurately see your embedding provider status

#### Test Connection Shows Dimensions ðŸ”¢

- **Previous Bug**: Test connection showed "undefined dimensions" on success
- **Fix**: Test connection now actually generates a test embedding to get real dimensions
- **Impact**: You can verify your embedding model is working and see its dimension count (e.g., 768, 1024, 1536)

#### Page Data Loading Fixed ðŸ”„

- **Previous Bug**: RAG Overview page never loaded data (showed defaults)
- **Fix**: Fixed function call in component mount hook (`loadStats()` instead of `loadOverview()`)
- **Impact**: Page now properly loads your configuration and statistics on load

#### Model Change Clears Embeddings âš ï¸

- **New Behavior**: Changing embedding models now automatically clears existing embeddings
- **Why**: Different models have different vector dimensions (768 vs 1024 vs 1536)
- **Impact**: Prevents database errors and ensures RAG continues working correctly after model changes
- **Note**: You'll see a warning in logs when embeddings are cleared

#### Configuration Errors Don't Trip Circuit Breaker ðŸ”§

- **Previous Bug**: Missing API keys or misconfigured providers would trip the circuit breaker, showing "Circuit breaker open"
- **Fix**: Configuration errors are now distinguished from transient network errors
- **Impact**: Circuit breaker only trips for actual network/server failures, not configuration issues
- **Better Error Messages**: Clear guidance on what needs to be configured for each provider mode:
  - "Same as Classification" â†’ requires AI provider configured
  - "Separate Ollama" â†’ requires Ollama host configured
  - "Cloud" â†’ requires cloud provider and API key configured

---

---

> [!NOTE]
> Older release notes have been moved to [RELEASE_NOTES_backup.md](RELEASE_NOTES_backup.md) to keep this file concise.
