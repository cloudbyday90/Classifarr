# Classifarr Security Review

- **Repository:** `https://github.com/cloudbyday90/Classifarr`
- **Review date:** 2026-02-24
- **Last updated:** 2026-03-22
- **Method:** Manual code review + automated dependency scanning

## Per-Release Security Checklist

See [`docs/SECURITY_CHECKLIST.md`](SECURITY_CHECKLIST.md) for the mandatory pre-release verification checklist derived from this review. All 31 baseline findings are represented as verifiable check items, plus the 3 post-review findings from 2026-03-05. The checklist is referenced in `.agent/workflows/release.md` Step 4 and must be completed and signed off before every release.

## Scope and Method

Manual code review covering auth/session management, sensitive routes, command execution, input parsing, crypto, and container behavior. Supplemented with automated dependency vulnerability scanning (`npm audit`). Also reviewed Docker hardening, CI workflow hardening, and dependency governance.

## Executive Summary

**Completed (2026-02-25):** Baseline findings addressed and post-review regressions fixed.
- **Critical #1-3:** Settings, classification, and media-server routes → `authenticateToken` + `requireAdmin`
- **Findings #14-31 (18 routes):** All Tier 1 (admin-only) and Tier 2 (authenticated) routes now protected
- **High #4:** Webhook secret required, encrypted at rest (`whsec_` prefix)
- **High #5:** CSP enabled with secure directives
- **High #6:** CORS configurable via `CORS_ORIGIN` environment variable
- **High #7:** JWT stored in httpOnly cookies with refresh tokens
- **Medium #8-9:** Dev dependencies updated, `npm audit` shows 0 vulnerabilities
- **Container runtime:** Privileges dropped before app runs (design decision accepted)
- **Debug controls:** Debug endpoint gated with `NODE_ENV !== 'production'`
- **API key handling:** API key no longer logged, view only in UI
- **Post-review hardening (2026-02-25):** Fixed webhook auth bypass in route handler (`await validateAuth`) and hardened constant-time compare for unequal-length inputs
- **Post-review hardening (2026-02-25):** Added CSRF protection for cookie-authenticated mutating requests (`classifarr_csrf_token` + `X-CSRF-Token`), compatible with local HTTP when `FORCE_SECURE_COOKIES=false`
- **Post-review completion (2026-02-25):** Added `SECURITY.md`, integrated `eslint-plugin-security` SAST linting in CI, and added required gitleaks/Trivy security scan workflows

**Post-review hardening (2026-03-22):** Security regression audit identified and resolved one additional finding: `/api/classification/progress` was mounted directly on `app` in `index.js` outside the auth-gated `apiRouter`, with no `authenticateToken` or `requireAdmin` middleware, exposing active task IDs, titles, phases, and progress percentages to unauthenticated callers. Fixed by moving the mount into `api.js` as `router.use('/classification/progress', authenticateToken, requireAdmin, classificationProgressRouter)` immediately before the existing `/classification` Tier 1 mount. Also verified no regressions on all 31 baseline findings; confirmed Unreleased security improvements (Bearer-before-cookie auth order, CORS no-reflect, refresh token rotation fix, non-persistent session invalidation on restart) are all present.

**Post-review hardening (2026-03-05):** Unreleased branch security audit identified and resolved three additional findings: (1) `check_ollama_config.js` was still tracked in git despite the `debug_*.js`/`check_*.js` `.gitignore` cleanup — it executed `SELECT * FROM ollama_config` and `process.exit()` as a root-level debug artifact; removed via `git rm`. (2) `db.healthCheck()` returned raw pg `err.message` (which can contain internal host IPs, port numbers, and database names) — production path now returns `'Database connection failed'` generic string to prevent topology disclosure if the function is ever wired to the unauthenticated `/health/*` endpoints; covered by new test `'healthCheck sanitizes error message in production'` in `database-resilience.test.js`. (3) `logs.txt` (8 800+ lines of Docker startup output) was committed to the repository; removed via `git rm --cached` and `logs*.txt` added to `.gitignore`. No new credential exposure found; no benchmark status changes.

**31 baseline findings total** - All addressed: 30 fixed, 1 acknowledged as design decision (#11), plus 2 post-review regressions fixed.

**Positive findings:** The codebase demonstrates good security practices in several areas including password hashing (bcrypt, 12 rounds), JWT implementation, API key encryption at rest, token masking in responses, rate limiting on sensitive endpoints, and container security.

---

## Route Authentication Audit

### Protected Routes (✅)

| Route | Auth Method | Location |
|-------|-------------|----------|
| `/media-server` | `authenticateToken` + `requireAdmin` | api.js |
| `/classification/progress` | `authenticateToken` + `requireAdmin` | api.js |
| `/classification` | `authenticateToken` + `requireAdmin` | api.js |
| `/settings` | `authenticateToken` + `requireAdmin` | api.js |
| `/libraries` | `authenticateTokenOrApiKey` | libraries.js:36 |
| `/logs` | `authenticateToken` | logs.js:38 |
| `/media-sync` | `authenticateTokenOrApiKey` | mediaSync.js:30 |
| `/plex` | `authenticateToken` | plexOAuth.js:27 |
| `/jellyfin` | `authenticateToken` | jellyfinAuth.js:27 |
| `/emby` | `authenticateToken` | embyAuth.js:27 |
| `/queue` | `authenticateTokenOrApiKey` | queue.js:19 |
| `/stats` | `authenticateTokenOrApiKey` | stats.js:17 |
| `/backup` | `authenticateToken` + `requireAdmin` | backup.js:18-19 |
| `/keys` | `authenticateToken` + `requireAdmin` | api.js |
| `/notifications` | `authenticateToken` | api.js |
| `/system` | `authenticateToken` | system.js:105 |

### Recently Protected Routes (✅ FIXED 2026-02-24)

Routes were classified into two tiers based on sensitivity:

#### Tier 1: Admin-Only Routes (`authenticateToken` + `requireAdmin`) ✅

| Route | Endpoints | Primary Risk |
|-------|-----------|--------------|
| `/reclassification` | 11 | Batch media moves in Radarr/Sonarr |
| `/policies` | 13 | Classification rules CRUD |
| `/mappings` | 9 | Library-to-arr routing |
| `/confidence` | 4 | Weight/threshold config |
| `/rag` | 40+ | AI operations, costs |
| `/patterns` | 13 | Pattern approval/rejection |
| `/scheduler` | 6 | Background task management |
| `/settings/path-mappings` | 4 | Filesystem path config |

#### Tier 2: Authenticated User Routes (`authenticateToken`) ✅

| Route | Endpoints | Primary Risk |
|-------|-----------|--------------|
| `/feedback` | 7 | Contribute learning data |
| `/prompts` | 4 | Clarification prompts |
| `/presets` | 4 | Custom presets |
| `/requests` | 3 | TMDB search, submit |
| `/suggestions` | 3 | Tuning suggestions |
| `/migration` | 3 | Migration status |
| `/rating-normalization` | 2 | Rating operations |
| `/sync` | 1 | Sync status |
| `/clarifications` | 2 | Clarification questions |

#### Authentication Strategy

**Why JWT Only (No API Keys for Admin Routes):**
- API keys support `read_only`, `read_write`, `webhook_only`, and `admin`, but Tier 1 admin routes are intentionally JWT-session guarded
- Admin operations require user login for audit trail
- Consistent with user preference to login for all operations
- Future: If needed, add explicit API-key auth support to Tier 1 routes rather than broadening route middleware scope

---

## Severity-Ranked Findings

## Critical

### 1) Unauthenticated access to all settings routes ✅ FIXED

- **Status:** Fixed (2026-02-24)
- **Fix:** Applied `authenticateToken` + `requireAdmin` middleware in `server/src/routes/api.js:63`

- **Evidence:**
  - `server/src/routes/api.js:62` mounts settings router without auth middleware
  - `server/src/routes/settings.js` - No `authenticateToken` middleware applied to router
  - All endpoints in settings router are accessible without authentication

- **Affected endpoints (partial list):**
  - `GET /api/settings` - Returns all settings
  - `PUT /api/settings` - Updates any settings
  - `GET/POST/PUT/DELETE /api/settings/radarr` - Full Radarr config management
  - `GET/POST/PUT/DELETE /api/settings/sonarr` - Full Sonarr config management
  - `GET/PUT /api/settings/tmdb` - TMDB API key configuration
  - `GET/PUT /api/settings/tavily` - Tavily API key configuration
  - `GET/PUT /api/settings/omdb` - OMDb API key configuration
  - `GET/PUT /api/settings/notifications` - Discord bot token configuration
  - `GET/PUT /api/settings/webhook` - Webhook secret configuration
  - `POST /api/settings/radarr/test` - Test Radarr connections
  - `POST /api/settings/sonarr/test` - Test Sonarr connections

- **Impact:**
  Any unauthenticated remote caller can:
  - Read all configuration including API keys (masked in response, but real keys used for operations)
  - Modify all configuration settings
  - Add/delete Radarr/Sonarr instances
  - Reconfigure notification webhooks
  - Test external service connections

- **Remediation:**
  Apply `authenticateToken` middleware to the settings router in `api.js`:
  ```javascript
  const { authenticateToken } = require('../middleware/auth');
  router.use('/settings', authenticateToken, settingsRouter);
  ```

---

### 2) Unauthenticated access to classification routes ✅ FIXED

- **Status:** Fixed (2026-02-24)
- **Fix:** Applied `authenticateToken` + `requireAdmin` middleware in `server/src/routes/api.js:61`

- **Evidence:**
  - `server/src/routes/api.js:60` mounts classification router without auth middleware
  - `server/src/routes/classification.js` - No authentication middleware applied

- **Affected endpoints:**
  - `POST /api/classification/classify` - Manually classify media
  - `GET /api/classification/history` - View all classification history
  - `GET /api/classification/history/:id` - View classification details
  - `POST /api/classification/corrections` - Submit corrections (modifies database)
  - `POST /api/classification/reclassify` - Execute re-classification with media moves
  - `POST /api/classification/reclassify/preview` - Preview re-classification
  - `GET /api/classification/stats` - View statistics
  - `GET /api/classification/pending` - View pending classifications
  - `POST /api/classification/pending/:id/resolve` - Resolve pending items

- **Impact:**
  - Unauthenticated users can view all classification history
  - Unauthenticated users can submit corrections and trigger re-classification
  - Re-classification can move media files in connected Radarr/Sonarr instances
  - Potential for unauthorized media library manipulation

- **Remediation:**
  Apply authentication middleware to classification router:
  ```javascript
  const { authenticateToken } = require('../middleware/auth');
  router.use('/classification', authenticateToken, classificationRouter);
  ```

---

### 3) Unauthenticated access to media server routes ✅ FIXED

- **Status:** Fixed (2026-02-24)
- **Fix:** Applied `authenticateToken` + `requireAdmin` middleware in `server/src/routes/api.js:59`

- **Evidence:**
  - `server/src/routes/api.js:58` mounts mediaServer router without auth middleware
  - `server/src/routes/mediaServer.js` - No authentication middleware applied

- **Affected endpoints:**
  - `GET /api/media-server` - Get media server config (with masked API key)
  - `POST /api/media-server` - Configure media server (Plex/Jellyfin/Emby)
  - `POST /api/media-server/test` - Test media server connection
  - `POST /api/media-server/sync` - Sync libraries from media server
  - `POST /api/media-server/ingest` - Trigger ingestion into classification queue

- **Impact:**
  - Unauthenticated users can reconfigure the media server connection
  - Unauthenticated users can trigger library syncs and ingestion
  - API keys are masked in responses but real keys are used for operations

- **Remediation:**
  Apply authentication middleware to mediaServer router:
  ```javascript
  const { authenticateToken } = require('../middleware/auth');
  router.use('/media-server', authenticateToken, mediaServerRouter);
  ```

---

## High

### 4) Webhook authentication is optional ✅ FIXED

- **Status:** Fixed (2026-02-24)
- **Fix:** Webhook secret_key is now required. Requests rejected with 401 if no secret configured.

- **Changes:**
  - `server/src/routes/webhook.js` - Rejects webhooks if `secret_key` not configured
  - `server/src/services/webhook.js` - `validateAuth` now returns false if no secret

- **Impact (before fix):**
  If webhook secret is not configured, any unauthenticated caller could:
  - Submit classification requests via webhook
  - Potentially trigger media requests in connected *arr applications
  - Fill the classification queue with arbitrary items

---

### 5) Content Security Policy disabled ✅ FIXED

- **Status:** Fixed (2026-02-24)
- **Fix:** CSP now enabled with secure directives in `server/src/index.js`

- **Changes:**
  - `server/src/index.js` - Enabled CSP with directives:
    - `defaultSrc: ["'self'"]`
    - `scriptSrc: ["'self'", "'unsafe-inline'"]` (inline scripts needed for Vue)
    - `styleSrc: ["'self'", "'unsafe-inline'"]` (inline styles needed for Vue)
    - `imgSrc: ["'self'", "data:", "https:", "blob:"]` (poster images)
    - `connectSrc: ["'self'"]` (+ localhost in dev mode)
    - `objectSrc: ["'none'"]`, `frameSrc: ["'none'"]`
    - `frameAncestors: ["'none'"]` (prevents clickjacking)

---

### 6) CORS configured without origin restrictions ✅ FIXED

- **Status:** Fixed (2026-02-24)
- **Fix:** CORS now configurable via `CORS_ORIGIN` environment variable

- **Changes:**
  - `server/src/index.js` - Added configurable CORS:
    - Set `CORS_ORIGIN` env var to restrict origins (comma-separated)
    - Warns in production if not set
    - Allows credentials, specific methods and headers

- **Remediation:**
  Configure allowed origins explicitly:
  ```javascript
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:21324'],
    credentials: true,
  }));
  ```

---

### 7) JWT token stored in localStorage (client-side) ✅ FIXED

- **Status:** Fixed (2026-02-24)
- **Fix:** Migrated to httpOnly cookies with refresh tokens

- **Changes:**
  - Access tokens stored in httpOnly cookies (XSS-proof)
  - Refresh tokens stored hashed in database
  - `client/src/api/index.js` - Cookie-based auth with automatic refresh
  - `client/src/views/Login.vue` - Uses cookies + sessionStorage for refresh token
  - `server/src/middleware/auth.js` - Reads from cookies first, falls back to header

---

### 8) No token refresh or rotation ✅ FIXED

- **Status:** Fixed (2026-02-24)
- **Fix:** Implemented refresh tokens with rotation

- **Changes:**
  - `database/migrations/20260224_140000_add_refresh_tokens.sql` - New table
  - `server/src/services/auth.js` - Refresh token generation/validation/revocation
  - `server/src/routes/auth.js` - `/auth/refresh` endpoint
  - Access tokens now 15 minutes, refresh tokens 7 days
  - Tokens are rotated on each refresh (old token revoked)

---

## Medium

### 9) Client dependency vulnerabilities (development) ✅ FIXED

- **Status:** Fixed (2026-02-24)
- **Fix:** Dependencies updated, `npm audit` now shows 0 vulnerabilities

---

### 10) Server dependency vulnerabilities (development) ✅ FIXED

- **Status:** Fixed (2026-02-24)
- **Fix:** Ran `npm audit fix`, dependencies updated, now shows 0 vulnerabilities

---

### 11) Container runs as root initially ✅ ACKNOWLEDGED

- **Status:** Acknowledged (2026-02-24) - Design decision, risk accepted
- **Rationale:**
  - Privileges ARE dropped before app runs (`exec su-exec classifarr node src/index.js`)
  - PostgreSQL also runs as non-root classifarr user
  - Standard pattern for self-contained containers (Arr stack, etc.)
  - PUID/PGID support required for NAS deployments

- **Mitigations in place:**
  - Entrypoint properly drops privileges
  - No root processes after startup
  - Container runs as classifarr user (UID 1000 by default)

---

## Low

### 12) Debug endpoint in production code ✅ FIXED

- **Status:** Fixed (2026-02-24)
- **Fix:** Gate with `NODE_ENV !== 'production'` check

- **Location:** `server/src/routes/libraries.js:620-640`

```javascript
router.get('/:id/rules/debug-insert', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      error: 'Debug endpoint not available in production'
    });
  }
  // ... debug logic
});
```

---

### 13) Default API key logged to console on first startup ✅ FIXED

- **Status:** Fixed (2026-02-24)
- **Fix:** Key no longer logged to console - view only in UI

- **Location:** `server/src/services/apiKeyService.js:204-217`

- **Implementation:**
  - Key stored encrypted in database
  - Console shows only: "✓ Auto-generated default API key"
  - User views full key in Settings → Security after logging in
  - No key exposure in logs or files

```javascript
async function ensureDefaultApiKey() {
  if (!exists) {
    await createApiKey('Default API Key', 'read_write');
    console.log('✓ Auto-generated default API key');
    console.log('  View in Settings → Security after logging in');
  }
}
```

---

## High (Continued)

### 14) Unauthenticated access to reclassification routes ✅ FIXED

- **Status:** Fixed (2026-02-24)
- **Fix:** Added `authenticateToken` + `requireAdmin` middleware

- **Location:** `server/src/routes/api.js:76`

```javascript
router.use('/reclassification', authenticateToken, requireAdmin, reclassificationRouter);
```

---

### 15) Unauthenticated access to policy routes ✅ FIXED

- **Status:** Fixed (2026-02-24)
- **Fix:** Added `authenticateToken` + `requireAdmin` middleware

- **Location:** `server/src/routes/api.js:77`

```javascript
router.use('/policies', authenticateToken, requireAdmin, policiesRouter);
```

---

### 16) Unauthenticated access to settings/path-mappings routes ✅ FIXED

- **Status:** Fixed (2026-02-24)
- **Fix:** Added `authenticateToken` + `requireAdmin` middleware

- **Location:** `server/src/routes/api.js:83`

```javascript
router.use('/settings/path-mappings', authenticateToken, requireAdmin, pathMappingsRouter);
```
  ```

---

### 17) Unauthenticated access to library mappings routes ✅ FIXED

- **Status:** Fixed (2026-02-24)
- **Fix:** Added `authenticateToken` + `requireAdmin` middleware

- **Location:** `server/src/routes/api.js:78`

```javascript
router.use('/mappings', authenticateToken, requireAdmin, mappingsRouter);
```

---

### 18) Unauthenticated access to confidence routes ✅ FIXED

- **Status:** Fixed (2026-02-24)
- **Fix:** Added `authenticateToken` + `requireAdmin` middleware

- **Location:** `server/src/routes/api.js:79`

```javascript
router.use('/confidence', authenticateToken, requireAdmin, confidenceRouter);
```

---

### 19) Unauthenticated access to RAG routes ✅ FIXED

- **Status:** Fixed (2026-02-24)
- **Fix:** Added `authenticateToken` + `requireAdmin` middleware

- **Location:** `server/src/routes/api.js:80`

```javascript
router.use('/rag', authenticateToken, requireAdmin, ragRouter);
```

---

### 20) Unauthenticated access to patterns routes ✅ FIXED

- **Status:** Fixed (2026-02-24)
- **Fix:** Added `authenticateToken` + `requireAdmin` middleware

- **Location:** `server/src/routes/api.js:81`

```javascript
router.use('/patterns', authenticateToken, requireAdmin, patternsRouter);
```

---

### 21) Unauthenticated access to feedback routes ✅ FIXED

- **Status:** Fixed (2026-02-24)
- **Fix:** Added `authenticateToken` middleware (Tier 2)

- **Location:** `server/src/routes/api.js:90`

```javascript
router.use('/feedback', authenticateToken, feedbackRouter);
```

---

### 22) Unauthenticated access to prompts routes ✅ FIXED

- **Status:** Fixed (2026-02-24)
- **Fix:** Added `authenticateToken` middleware (Tier 2)

- **Location:** `server/src/routes/api.js:91`

```javascript
router.use('/prompts', authenticateToken, promptsRouter);
```

---

### 23) Unauthenticated access to presets routes ✅ FIXED

- **Status:** Fixed (2026-02-24)
- **Fix:** Added `authenticateToken` middleware (Tier 2)

- **Location:** `server/src/routes/api.js:92`

```javascript
router.use('/presets', authenticateToken, presetsRouter);
```

---

### 24) Unauthenticated access to requests routes ✅ FIXED

- **Status:** Fixed (2026-02-24)
- **Fix:** Added `authenticateToken` middleware (Tier 2)

- **Location:** `server/src/routes/api.js:89`

```javascript
router.use('/requests', authenticateToken, requestsRouter);
```

---

### 25) Unauthenticated access to scheduler routes ✅ FIXED

- **Status:** Fixed (2026-02-24)
- **Fix:** Added `authenticateToken` + `requireAdmin` middleware

- **Location:** `server/src/routes/api.js:82`

```javascript
router.use('/scheduler', authenticateToken, requireAdmin, schedulerRouter);
```

---

## Low (Continued)

### 26) Unauthenticated access to suggestions routes ✅ FIXED

- **Status:** Fixed (2026-02-24)
- **Fix:** Added `authenticateToken` middleware (Tier 2)

- **Location:** `server/src/routes/api.js:93`

```javascript
router.use('/suggestions', authenticateToken, suggestionsRouter);
```

---

### 27) Unauthenticated access to migration routes ✅ FIXED

- **Status:** Fixed (2026-02-24)
- **Fix:** Added `authenticateToken` middleware (Tier 2)

- **Location:** `server/src/routes/api.js:94`

```javascript
router.use('/migration', authenticateToken, migrationRouter);
```

---

### 28) Unauthenticated access to rating-normalization routes ✅ FIXED

- **Status:** Fixed (2026-02-24)
- **Fix:** Added `authenticateToken` middleware (Tier 2)

- **Location:** `server/src/routes/api.js:95`

```javascript
router.use('/rating-normalization', authenticateToken, ratingNormalizationRouter);
```

---

### 29) Unauthenticated access to sync routes ✅ FIXED

- **Status:** Fixed (2026-02-24)
- **Fix:** Added `authenticateToken` middleware (Tier 2)

- **Location:** `server/src/routes/api.js:96`

```javascript
router.use('/sync', authenticateToken, syncRouter);
```

---

### 30) Unauthenticated access to clarifications routes ✅ FIXED

- **Status:** Fixed (2026-02-24)
- **Fix:** Added `authenticateToken` middleware (Tier 2)

- **Location:** `server/src/routes/api.js:88`

```javascript
router.use('/clarifications', authenticateToken, clarificationRouter);
```

---

### 32) Unauthenticated access to classification progress routes ✅ FIXED

- **Status:** Fixed (2026-03-22)
- **Fix:** Moved mount into `api.js` under `authenticateToken` + `requireAdmin` (Tier 1)

- **Evidence:**
  - `server/src/index.js` mounted `classificationProgressRouter` directly on `app` at `/api/classification/progress`, outside the auth-gated `apiRouter`
  - `server/src/routes/classificationProgress.js` had bare `router.get('/')` and `router.get('/:taskId')` handlers with no authentication middleware
  - `index.js` never imported `authenticateToken` — confirmed by grep returning zero matches

- **Affected endpoints:**
  - `GET /api/classification/progress` — lists all active classification tasks (IDs, titles, phases, progress %)
  - `GET /api/classification/progress/:taskId` — returns detailed progress for a specific task

- **Impact:**
  Unauthenticated remote callers could enumerate in-progress classification tasks including internal task IDs and media titles.

- **Remediation:**
  Removed direct `app.use` mount from `index.js` and added to `api.js` Tier 1 block before the `/classification` mount:

```javascript
router.use('/classification/progress', authenticateToken, requireAdmin, classificationProgressRouter);
router.use('/classification', authenticateToken, requireAdmin, classificationRouter);
```

---

### 31) Unauthenticated access to rule-builder routes ✅ DEPRECATED

- **Status:** Deprecated (2026-02-24) - Feature removed
- **Fix:** Rule builder routes and service completely removed. Functionality replaced by Policy Engine.

- **Changes:**
  - Deleted `server/src/routes/ruleBuilder.js`
  - Deleted `server/src/services/ruleBuilder.js`
  - Removed `/rule-builder` mount from `api.js`
  - Added `POST /api/libraries/:id/rules/preview` endpoint for rule previewing
  - Removed legacy Smart Rule UI in favor of Policy Builder flows

---

## Summary

All 31 security findings have been addressed:

| Category | Total | Fixed | Acknowledged |
|----------|-------|-------|--------------|
| Critical | 3 | 3 | 0 |
| High | 17 | 17 | 0 |
| Medium | 3 | 2 | 1 |
| Low | 8 | 8 | 0 |
| **Total** | **31** | **30** | **1** |

**Acknowledged items:**
- #11: Container runs as root initially (design decision - privileges dropped before app runs)

**All route authentication fixed:**
- 12 routes: Admin-only (`authenticateToken` + `requireAdmin`)
- 9 routes: Authenticated users (`authenticateToken`)
- 6 routes: Internal auth or public endpoints

---

## Testing Requirements

### Authentication Strategy Summary

| Tier | Routes | Auth Method | Rationale |
|------|--------|-------------|------------|
| **Tier 1** | 8 routes | `authenticateToken` + `requireAdmin` | Admin-only operations (config, media moves, AI ops) |
| **Tier 2** | 9 routes | `authenticateToken` | Any logged-in user can participate |
| **Existing** | 14 routes | Various | Already protected (libraries, queue, stats, etc.) |

**Note on API Keys:** Admin routes currently require JWT login by design. API keys include an `admin` permission tier for API-key-authenticated surfaces, but Tier 1 route mounts intentionally use session auth middleware.

### Unit Tests Required

The following test suites need authentication tests added:

| Test File | Routes to Test | Status |
|-----------|----------------|--------|
| `server/src/__tests__/reclassification-routes.test.js` | All reclassification endpoints | ✅ Covered by route-authentication.test.js |
| `server/src/__tests__/policies-routes.coverage.test.js` | Auth rejection tests | ✅ Covered by route-authentication.test.js |
| `server/src/__tests__/pathMappings.test.js` | Auth rejection tests | ✅ Covered by route-authentication.test.js |
| `server/src/__tests__/mappings-routes.test.js` | All mapping endpoints | ✅ Covered by route-authentication.test.js |
| `server/src/__tests__/confidence-routes.test.js` | Auth rejection tests | ✅ Covered by route-authentication.test.js |
| `server/src/__tests__/rag-routes.test.js` | All RAG endpoints | ✅ Covered by route-authentication.test.js |
| `server/src/__tests__/patterns-routes.test.js` | Auth rejection tests | ✅ Covered by route-authentication.test.js |
| `server/src/__tests__/feedback-routes.test.js` | Auth rejection tests | ✅ Covered by route-authentication.test.js |
| `server/src/__tests__/prompts-routes.test.js` | Auth rejection tests | ✅ Covered by route-authentication.test.js |
| `server/src/__tests__/presets-routes.test.js` | Auth rejection tests | ✅ Covered by route-authentication.test.js |
| `server/src/__tests__/suggestions-routes.test.js` | Auth rejection tests | ✅ Covered by route-authentication.test.js |
| `server/src/__tests__/migration-routes.test.js` | Auth rejection tests | ✅ Covered by route-authentication.test.js |
| `server/src/__tests__/rating-normalization-routes.test.js` | Auth rejection tests | ✅ Covered by route-authentication.test.js |
| `server/src/__tests__/sync-routes.test.js` | Auth rejection tests | ✅ Covered by route-authentication.test.js |
| `server/src/__tests__/clarification-routes.test.js` | Auth rejection tests | ✅ Covered by route-authentication.test.js |
| `server/src/__tests__/requests-routes.test.js` | Auth rejection tests | ✅ Covered by route-authentication.test.js |
| `server/src/__tests__/scheduler-routes.test.js` | Auth rejection tests | ✅ Covered by route-authentication.test.js |

### Test Template

```javascript
describe('Route Authentication', () => {
  describe('GET /api/{route}', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app).get('/api/{route}');
      expect(res.status).toBe(401);
    });

    it('should return 403 with invalid token', async () => {
      const res = await request(app)
        .get('/api/{route}')
        .set('Authorization', 'Bearer invalid_token');
      expect(res.status).toBe(403);
    });

    it('should return 403 for non-admin user (if requireAdmin)', async () => {
      const token = await getUserToken(); // non-admin
      const res = await request(app)
        .get('/api/{route}')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('should return 200 for authenticated admin', async () => {
      const token = await getAdminToken();
      const res = await request(app)
        .get('/api/{route}')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });
});
```

### Integration Test Checklist

- [x] Test all 18 unprotected routes reject unauthenticated requests
- [x] Test all 18 routes reject non-admin requests (where requireAdmin needed)
- [x] Test all 18 routes accept authenticated admin requests
- [x] Test token expiry returns 403
- [x] Test malformed token returns 403
- [x] Test revoked token returns 403

---

## Positive Security Findings

The following areas demonstrate good security practices:

### Authentication & Authorization
- **Password hashing:** bcrypt with 12 salt rounds (`server/src/services/auth.js`)
- **Password validation:** Enforces 8+ chars, uppercase, lowercase, number, special char
- **JWT implementation:** Access token in httpOnly cookie (15m) + rotated refresh token flow (7d)
- **Rate limiting:** Applied to login (5/15min), password change (3/hour), setup (10/hour)

### Credential Management
- **API key encryption:** AES-256-GCM encryption at rest (`server/src/services/apiKeyService.js`)
- **Token masking:** API keys masked in all responses (`server/src/utils/tokenMasking.js`)
- **Masked token detection:** `isMaskedToken()` prevents accidental overwrites with masked values

### Input Validation
- **SQL injection protection:** Parameterized queries throughout
- **Path traversal protection:** Backup routes validate filenames (`server/src/routes/backup.js:115-117`)
- **Integer validation:** Proper `parseInt()` with `Number.isFinite()` checks

### Infrastructure
- **Container security:** Non-root user (UID 1000), multi-stage build, tini init system
- **Health checks:** Built-in health endpoint and Docker HEALTHCHECK
- **Audit logging:** Backup operations logged with user ID and IP

### CI/CD Security
- **Minimal permissions:** `contents: read`, `packages: write`
- **Secret management:** Uses GitHub Secrets for credentials
- **Dependency scanning:** `npm audit --omit=dev` runs in CI pipeline
- **Dependabot:** Configured for npm and GitHub Actions (weekly updates)
- **Package overrides:** Vulnerable transitive deps pinned (undici, glob, minimatch)
- **Secret scanning:** Gitleaks workflow enforced in GitHub Actions (`.github/workflows/gitleaks.yml`)
- **Vulnerability scanning:** Trivy workflow enforced in GitHub Actions (`.github/workflows/trivy.yml`)
- **SAST linting:** `eslint-plugin-security` integrated via `npm run lint:security` in CI

---

## Automated Scan Summary

**Verification snapshot (2026-02-25):**
- `npm --prefix server audit --omit=dev` → 0 vulnerabilities
- `npm --prefix client audit --omit=dev` → 0 vulnerabilities
- `npm --prefix server audit` → 0 vulnerabilities
- `npm --prefix client audit` → 0 vulnerabilities

### npm audit (production dependencies)
| Package | Severity | Status |
|---------|----------|--------|
| Server runtime deps | Clean | No vulnerabilities |
| Client runtime deps | Clean | No vulnerabilities |

### npm audit (development dependencies)
| Package | Severity | Notes |
|---------|----------|-------|
| Server dev deps | Clean | No vulnerabilities |
| Client dev deps | Clean | No vulnerabilities |

### Gitleaks secret scan
- **Status:** Configuration present (`.gitleaks.toml`)
- **CI enforcement:** Required gate via `.github/workflows/gitleaks.yml`

### Trivy filesystem scan
- **Status:** Required gate via `.github/workflows/trivy.yml` (filesystem vuln scan)
- **Configuration:** Tuned for repo scans (`scanners=vuln`, severity `HIGH,CRITICAL`, common build dirs skipped)

---

## Comparison with Huntarr Security Review

| Issue Category | Huntarr | Classifarr |
|---------------|---------|------------|
| Unauthenticated settings write | Critical | **Critical** (Finding #1) |
| Unauthenticated 2FA enrollment | Critical | N/A (no 2FA implementation) |
| Unauthenticated account takeover | Critical | Protected (setup has rate limiting, checks existing users) |
| Zip Slip vulnerability | Critical | Not applicable (no ZIP upload) |
| Path traversal | High | Protected (backup routes have validation) |
| Hardcoded credentials | High | Not found (only in test files) |
| Container runs as root | Medium | Medium (drops to non-root via entrypoint) |
| CSP disabled | N/A | High (Finding #5) |
| CORS unrestricted | N/A | High (Finding #6) |

---

## Follow-up Priority (Post-Remediation)

1. **Low/Optional:** Revisit CIS optional container hardening items (ulimits, pids, AppArmor, Docker secrets)

---

## Recommendations Summary

### Completed
1. Apply authentication middleware to protected API routes
2. Enable Content Security Policy with strict directives
3. Configure CORS with explicit allowlist support (`CORS_ORIGIN`)
4. Migrate auth from localStorage JWT to cookie-based session + refresh tokens
5. Require webhook secrets by default
6. Remediate dependency vulnerabilities in runtime and development toolchains
7. Add `SECURITY.md` disclosure policy at repository root
8. Integrate `eslint-plugin-security` into server lint/CI (`npm run lint:security`)
9. Add required security scan workflows for gitleaks and Trivy in GitHub Actions
10. Document Docker Content Trust, image pinning, and interface binding guidance in deployment docs

### Remaining
1. No high-priority security review remediations remain.
2. Optional hardening/documentation items are tracked in `SECURITY_BENCHMARKS.md`.
