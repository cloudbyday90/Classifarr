# Classifarr Discord + *arr Routing Fixes — Implementation Plan

## Overview
This plan addresses end-to-end issues discovered in the Discord clarification flow and *arr routing.
It includes code changes, database migrations, and test updates to prevent regressions.

## Guidance
- Follow repo-level agent guidance in `OPENAI.md` (mirrored across AGENTS/CLAUDE/GEMINI).
- Before changes, review existing design and code paths; expand/change/remove only where it improves overall design and remains consistent with project patterns.
- All code changes must follow `OPENAI.md` guidelines.
- Target release: **v0.40.5-alpha**.

## Goals
- Discord clarification selections always resolve classifications with a library assignment.
- Routing to Radarr/Sonarr works when `library_arr_mappings` exists, even if `libraries.arr_id` is NULL.
- No database constraint errors (status length, method constraints).
- Policy question handling is resilient to invalid JSON and does not block resolution.

## Acceptance Criteria (API-first, with SQL diagnostics)
- **Discord Resolution Updates Library (API)**
  - Given a classification in `GET /api/classification/pending`
  - When a user selects an option in Discord
  - Then the item disappears from `GET /api/classification/pending` and appears in `GET /api/classification/history/:id` with `library_name` set
- **Routing Works With Mappings (API/Logs)**
  - Given a library mapping exists for the media server (`GET /api/mappings/:mediaServerId`)
  - When a classification is resolved
  - Then routing to Radarr/Sonarr is attempted (logs show `Added movie to Radarr:` or `Added series to Sonarr:`)
- **Mapping Precedence (API)**
  - Given a library with both `libraries.arr_id` and mapping config
  - When routing executes
  - Then the *arr instance selected matches the library config (verify via logs or *arr add target)
- **No Status Length Errors (Logs)**
  - Given `clarification_status = 'awaiting_clarification'`
  - When persisted
  - Then logs do not contain `value too long for type character varying(20)`
- **Method Constraint Compatibility (API/Logs)**
  - Given a manual resolution path (`POST /api/classification/pending/:id/resolve`)
  - When `method = 'manual_classification'` is written
  - Then no constraint errors appear in logs and API returns success
- **Policy Question Resilience (API/Logs)**
  - Given an invalid `policy_question` value in history
  - When resolution runs
  - Then resolution completes and logs do not contain `"['\"]?[object Object]['\"]? is not valid JSON"`
- **Library Sync On Mapping Save (API)**
  - Given a mapping is created/updated via `POST /api/mappings`
  - When the mapping is saved
  - Then `GET /api/libraries/:id` reflects `arr_id`/`root_folder` if they were missing

### API Verification Examples (cURL)
- **Auth note**
  - Protected endpoints use `authenticateTokenOrApiKey` (see `server/src/middleware/apiKeyAuth.js`).
  - Use either `-H "X-API-Key: <key>"` or `-H "Authorization: Bearer <jwt>"`.
  - If a route does not apply auth middleware, headers are not required.
- **Pending list**
  - `curl -s http://<host>:21324/api/classification/pending`
- **Resolve pending (manual)**
  - `curl -s -X POST http://<host>:21324/api/classification/pending/<id>/resolve -H "Content-Type: application/json" -H "X-API-Key: <key>" -d '{"library_id":5,"selected_option":"Manual selection","resolved_by":"admin"}'`
- **History detail**
  - `curl -s http://<host>:21324/api/classification/history/<id>`
- **Mappings**
  - `curl -s http://<host>:21324/api/mappings/<mediaServerId>`
- **Mapping save**
  - `curl -s -X POST http://<host>:21324/api/mappings -H "Content-Type: application/json" -H "X-API-Key: <key>" -d '{"library_id":5,"arr_type":"radarr","arr_config_id":1,"arr_root_folder_id":1,"arr_root_folder_path":"/movies","quality_profile_id":1}'`
- **Library detail**
  - `curl -s http://<host>:21324/api/libraries/5 -H "X-API-Key: <key>"`

### Auth Matrix (Full, per existing design)
| Route group | Auth model (per route middleware) | Notes |
|---|---|---|
| `/api/setup/*` | None | Setup flow (see `server/src/index.js`) |
| `/api/auth/*` | Mixed | Login/register public; `/me`, password change, logout require JWT (see `server/src/routes/auth.js`) |
| `/api/system/*` | JWT | `authenticateToken` in `server/src/routes/system.js` |
| `/api/keys/*` | JWT | `authenticateToken` in `server/src/routes/apiKeys.js` |
| `/api/logs/*` | JWT | `authenticateToken` in `server/src/routes/logs.js` |
| `/api/plex/*` | JWT | `authenticateToken` in `server/src/routes/plexOAuth.js` |
| `/api/jellyfin/*` | JWT | `authenticateToken` in `server/src/routes/jellyfinAuth.js` |
| `/api/emby/*` | JWT | `authenticateToken` in `server/src/routes/embyAuth.js` |
| `/api/libraries/*` | API key **or** JWT | `authenticateTokenOrApiKey`; write routes also require `requireReadWrite` |
| `/api/media-sync/*` | API key **or** JWT | `authenticateTokenOrApiKey`; write routes also require `requireReadWrite` |
| `/api/queue/*` | API key **or** JWT | `authenticateTokenOrApiKey`; write routes also require `requireReadWrite` |
| `/api/stats/*` | API key **or** JWT | `authenticateTokenOrApiKey` |
| `/api/classification/*` | None | No auth middleware in `server/src/routes/classification.js` |
| `/api/mappings/*` | None | No auth middleware in `server/src/routes/mappings.js` |
| `/api/settings/*` | None | No auth middleware in `server/src/routes/settings.js` |
| `/api/media-server/*` | None | No auth middleware in `server/src/routes/mediaServer.js` |
| `/api/clarifications/*` | None | No auth middleware in `server/src/routes/clarification.js` |
| `/api/requests/*` | None | No auth middleware in `server/src/routes/requests.js` |
| `/api/scheduler/*` | None | No auth middleware in `server/src/routes/scheduler.js` |
| `/api/backup/*` | None | No auth middleware in `server/src/routes/backup.js` |
| `/api/reclassification/*` | None | No auth middleware in `server/src/routes/reclassification.js` |
| `/api/settings/path-mappings/*` | None | No auth middleware in `server/src/routes/pathMappings.js` |
| `/api/confidence/*` | None | No auth middleware in `server/src/routes/confidence.js` |
| `/api/rag/*` | None | No auth middleware in `server/src/routes/rag.js` |
| `/api/patterns/*` | None | No auth middleware in `server/src/routes/patterns.js` |
| `/api/feedback/*` | None | No auth middleware in `server/src/routes/feedback.js` |
| `/api/prompts/*` | None | No auth middleware in `server/src/routes/prompts.js` |
| `/api/policies/*` | None | No auth middleware in `server/src/routes/policies.js` |
| `/api/presets/*` | None | No auth middleware in `server/src/routes/presets.js` |
| `/api/suggestions/*` | None | No auth middleware in `server/src/routes/suggestions.js` |
| `/api/migration/*` | None | No auth middleware in `server/src/routes/migration.js` |
| `/api/rating-normalization/*` | None | No auth middleware in `server/src/routes/ratingNormalization.js` |
| `/api/sync/*` | None | No auth middleware in `server/src/routes/sync.js` |
| `/api/webhook/*` | None | No auth middleware in `server/src/routes/webhook.js` (relies on webhook payload/config) |

### SQL Diagnostics (Secondary)
- If API checks are inconclusive, verify directly:
  - `SELECT status, library_id, library_name, clarification_status FROM classification_history WHERE id = <id>;`
  - `SELECT arr_id, root_folder, quality_profile_id FROM libraries WHERE id = <library_id>;`
  - `SELECT * FROM library_arr_mappings WHERE library_id = <library_id>;`

## Non-Goals
- Rewriting classification strategy or policy logic.
- Migrating user data outside minimal schema fixes.
- UI redesign.

## Issues (Verified)
1) Discord clarification resolution falls back and does not set `library_id`/`library_name`.
2) `clarification_status` length mismatch (status value longer than column length).
3) Routing uses `libraries.arr_id`, but existing setups store mappings in `library_arr_mappings`.
4) `manual_classification` method rejected by `classification_history.method` check constraint.
5) `policy_question` stored/parsed as invalid JSON, causing resolver failure.

## Proposed Code Changes

### A) Mapping-Aware Routing (Primary Fix)
**Goal:** Use `library_arr_mappings` when `libraries.arr_id` is missing.
- Add a helper to resolve *arr routing settings by `library_id`.
- If `libraries.arr_id` is NULL:
  - Query `library_arr_mappings` for `arr_config_id`, `arr_root_folder_path`, `quality_profile_id`.
  - Build settings object (root folder, quality profile, monitor/search flags).
- Define precedence rules:
  - Prefer explicit `libraries.arr_id`/settings when present.
  - Fallback to `library_arr_mappings` when missing.
- Update routing call sites:
  - `server/src/services/discordBot.js` (routeAfterClarification)
  - `server/src/routes/classification.js` (pending resolution routing)
  - `server/src/services/classification.js` (routeToArr entry)

### B) Discord Clarification Fallback Resolution
**Goal:** Ensure fallback path assigns library when AI question parsing fails.
- In `discordBot.processClarificationResponse`, if policy question resolution fails:
  - Update `classification_history` with `library_id`, `library_name`, `status = 'completed'`,
    and set `method`/`confidence` consistently with manual resolution.
  - Preserve `clarification_response` and `clarification_status = 'resolved'`.

### C) Policy Question Storage/Parsing Hardening
**Goal:** Invalid JSON should not break resolution.
- Ensure `policy_question` is stored as valid JSONB (object, not stringified twice).
  - Normalize at write-time (parser/service): if it's an object, store as JSONB.
  - If it's a string, only store if valid JSON; otherwise set to NULL.
- In resolver, safely parse and handle invalid JSON (log + continue with fallback).
  - Avoid `JSON.parse` on non-JSON strings like `"[object Object]"`.
  - If parse fails, skip policy-driven resolution and use fallback path.

### D) Auto-Backfill Library *arr Links (Migration-Based)
**Goal:** If `libraries.arr_id`/settings are missing, populate them from `library_arr_mappings`.
- Implement as a **one-time migration** (no startup overhead).
- Backfill:
  - `libraries.arr_id` from `library_arr_mappings.arr_config_id`
  - `libraries.root_folder` from `library_arr_mappings.arr_root_folder_path`
  - `libraries.quality_profile_id` from `library_arr_mappings.quality_profile_id`
  - `libraries.radarr_settings`/`sonarr_settings` if empty
- This ensures older installs auto-heal without manual DB edits.
- Note: This is a one-time alignment for existing installs; future routing should not depend on it.

### E) Keep Libraries in Sync When Mappings Change
**Goal:** New configs stay consistent without additional jobs.
- When `library_arr_mappings` is created/updated, also upsert:
  - `libraries.arr_id`, `libraries.root_folder`, `libraries.quality_profile_id`
  - `libraries.radarr_settings`/`sonarr_settings` if empty
- This prevents future drift between mapping storage and routing expectations.

### F) Quality Profile Fallback (No Manual Fixes)
**Goal:** Routing should not fail when `quality_profile_id` is missing in mappings.
- If `quality_profile_id` is NULL:
  - Attempt to resolve a default profile from cache or *arr API.
  - Log explicit warnings if none found and skip routing safely.

## Database Migrations

### 1) Expand `clarification_status` length
**Problem:** `awaiting_clarification` exceeds 20 chars.
- Alter column length to `VARCHAR(32)` (or similar).

### 2) Update `classification_history.method` constraint
**Problem:** `manual_classification` is used in code but not allowed.
- Drop and re-create constraint to include `manual_classification`.

### 3) One-Time Cleanup of Invalid `policy_question`
**Problem:** Existing rows may contain invalid JSON strings.
- Identify rows where `policy_question` is not valid JSONB.
- Set invalid values to NULL (or re-parse if safely detectable).

### Consolidation (Release v0.40.5-alpha)
- Combine migrations **1–3** and the *arr backfill into a single migration file:
  - `database/migrations/069_discord_arr_fixes.sql`

## Tests (Update + Add)

### Existing Tests to Update
- `server/src/__tests__/classification-routes.test.js`
  - Add case: routing succeeds when `library_arr_mappings` exists and `libraries.arr_id` is NULL.
- `server/src/__tests__/clarification.test.js`
  - Add case: fallback path sets `library_id`/`library_name` and resolves status.
 - `server/src/__tests__/libraryMappingService.test.js`
   - Add case: mapping save also updates `libraries` row fields.

### New Tests to Add
- `server/src/__tests__/discord-clarification-routing.test.js` (or extend existing)
  - Simulate Discord clarification response and ensure routing uses mapping fallback.
- DB constraint tests (if schema tests exist):
  - Ensure `manual_classification` is accepted.
  - Ensure `clarification_status` accepts longer values.
 - Routing fallback test:
   - If mapping `quality_profile_id` is NULL, default profile is used or routing is skipped with a clear error.

### Coverage Targets
- Routing helper logic (mapping lookup + settings resolution).
- Discord fallback resolution update.
- Policy question parsing safety.

## Deployment Steps
1) Apply migrations on startup (existing migration system).
2) Rebuild and deploy container.
3) Validate:
   - Discord clarification resolves and assigns library.
   - *arr routing triggers for mapped libraries (no arr_id).
   - No constraint errors in logs.

## Verification Checklist
- DB: `classification_history` row has `library_id`/`library_name` after Discord selection.
- Logs: No `value too long for type character varying(20)` errors.
- Logs: No `"[object Object]" is not valid JSON` errors.
- *arr: Movie/TV appears in Radarr/Sonarr after resolution.
- Libraries: `arr_id` and settings are populated after mapping changes.

## Release Notes & Changelog
- Update `CHANGELOG.md` with technical changes (DB migrations, routing logic, Discord fallback fixes).
- Update `RELEASE_NOTES.md` with high-level user-facing changes for **v0.40.5-alpha**.

## Rollback Plan
- Revert to previous container tag if issues appear.
- Migrations are additive/forward-only; if rollback needed, preserve backups.

## Decisions
- **Status length best practice**:
  - Store short, stable status tokens (snake_case) and keep them <= 32 chars.
  - Enforce allowed values via CHECK constraint (or enum) and update the constraint when adding new statuses.
  - Keep user-facing long descriptions in a separate field or UI layer, not in `clarification_status`.
