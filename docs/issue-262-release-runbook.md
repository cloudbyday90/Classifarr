# Issue 262 Release Runbook

Date: 2026-02-12  
Release target: `v0.42.0-alpha`  
Primary specs:
- `docs/issue-262-implementation-plan.md`
- `docs/issue-262-interface-design.md`
Task list:
- `docs/issue-262-task-list.md`
Best-practices log:
- `docs/issue-262-best-practices.md`

## Scope
Operational checklist to activate Issue 262 (Command Center consolidation) with controlled cutover and rollback safety.

## Cutover Semantics
- `command-center-default`: `/` resolves to Command Center.
- `legacy-compatible`: `/dashboard`, `/activity`, `/queue` may remain reachable during stabilization, but are not primary navigation destinations.
- `consolidated`: duplicated legacy widgets removed after parity gates pass.
- rollback is routing/navigation and feature-surface rollback; schema rollback is not required for additive changes.

## Ordered Rollout Checklist
1. Run pre-flight integrity audits in staging.
2. Apply Issue 262 migrations in staging (if any) and verify schema parity.
3. Run API/contract gates for Command Center data + notifications.
4. Validate UI parity gates (desktop + mobile) in staging.
5. Run action parity walk-through (Needs Attention, Errors, Processing, Quick Add, Libraries).
6. Run sidebar/route deprecation gates (`Activity`, `Queue`, `Migration`, Smart Rule Builder v2 exposure).
7. Run rollback drill in staging.
8. Activate production with `command-center-default` and legacy-compatible guardrails.
9. Monitor stabilization Operational Visibility and complete legacy consolidation only after thresholds pass.

## Pre-flight Integrity Audits
Run these in staging before activation:

```sql
-- Ensure core config row exists
SELECT COUNT(*) AS cfg_rows
FROM ai_provider_config
WHERE id = 1;

-- Ensure libraries exist by media type
SELECT media_type, COUNT(*) AS active_count
FROM libraries
WHERE is_active = true
GROUP BY media_type
ORDER BY media_type;

-- Pending status distribution (detect pending vs awaiting_decision drift)
SELECT status, COUNT(*) AS count
FROM classification_history
WHERE status IN ('pending', 'awaiting_decision')
GROUP BY status
ORDER BY status;

-- Awaiting decisions missing policy_question payload
SELECT COUNT(*) AS missing_policy_question
FROM classification_history
WHERE status = 'awaiting_decision'
  AND (policy_question IS NULL OR jsonb_typeof(policy_question) <> 'object');

-- Ensure notification persistence table exists
SELECT to_regclass('public.app_notifications') AS app_notifications_table;

-- Verify app_notifications has read-state columns
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'app_notifications'
  AND column_name IN ('is_read', 'read_at', 'created_at')
ORDER BY column_name;
```

## Expected Thresholds (Go/No-Go)
- `cfg_rows` must equal `1`.
- active movie libraries must be `>= 1`.
- active tv libraries must be `>= 1`.
- `missing_policy_question` should be `0` for staging validation data.
- `app_notifications_table` must not be `NULL`.
- read-state columns must exist (`is_read`, `read_at`, `created_at`).

If any threshold fails:
- do not cut over
- fix data/schema consistency first
- rerun audits until all thresholds pass

## API/Contract Gate
Validate in staging before activation (use an API key with read-write access):

```bash
BASE_URL="http://localhost:21324"
API_KEY="REPLACE_ME"

curl -fsS "$BASE_URL/api/queue/live-stats" -H "X-API-Key: $API_KEY" > /tmp/live-stats.json
curl -fsS "$BASE_URL/api/classification/pending" -H "X-API-Key: $API_KEY" > /tmp/pending.json
curl -fsS "$BASE_URL/api/queue/failed" -H "X-API-Key: $API_KEY" > /tmp/failed.json
curl -fsS "$BASE_URL/api/libraries" -H "X-API-Key: $API_KEY" > /tmp/libraries.json
curl -fsS "$BASE_URL/api/classification/history?limit=5" -H "X-API-Key: $API_KEY" > /tmp/history5.json
```

Command Center notification contract gate (new for Issue 262):
- bell unread count endpoint returns deterministic unread value
- list endpoint returns unread/read grouping data
- mark read / mark unread / mark all read actions succeed and persist
- open-target metadata (path/anchor/action hints) resolves correctly

If your implementation uses `/api/notifications`:

```bash
curl -fsS "$BASE_URL/api/notifications" -H "X-API-Key: $API_KEY" > /tmp/notifications.json
curl -fsS "$BASE_URL/api/notifications/unread-count" -H "X-API-Key: $API_KEY"
```

## UI Parity Gate (Staging)
Must pass before production cutover:

1. `/` opens Command Center by default.
2. Section priority order matches locked design (`Alerts`, `Processing`, `Needs Attention`, `Errors`, ...).
3. Needs Attention cards render:
   - `policy_question.question`
   - `policy_question.why_uncertain` (when present)
   - option buttons
   - explicit `Yes` / `No` buttons for binary semantics.
4. Missing/invalid `policy_question` does not block resolution (`Change` path remains usable).
5. Errors actions work:
   - per-row `Retry` / `Dismiss`
   - bulk `Retry All` / `Dismiss All`.
6. Processing card shows active phase context and opens detail breakdown.
7. Quick Add search/add works from Command Center without route switch.
8. Recently Completed links to `/history`.
9. Notifications panel supports unread/read grouping and read-state updates.
10. `/notifications` full view works with filters and row actions.

## Mobile Gate (Staging)
Must pass on mobile viewport (`<= 767px`):

1. Action order follows locked priority.
2. Critical actions are executable in <=2 taps.
3. Processing detail opens as a bottom sheet and closes without state loss.
4. Needs Attention remains actionable for both binary and non-binary prompts.
5. No blocking layout shifts during live refresh.

## Sidebar and Deprecation Gate
Before final consolidation:
- primary sidebar matches locked Command Center IA
- `/request` remains compatibility-only (not primary nav)
- `/activity` and `/queue` are not primary nav destinations
- `/migration` is not a primary destination
- Smart Rule Builder v2 entry points are not active in primary user workflows
- legacy rule/migration wording is removed from primary operational UX copy

## Rollback Drill (Staging)
Validate reversal before production:
1. enable `command-center-default` and run smoke tests.
2. switch back to legacy-compatible landing/routing behavior.
3. verify core workflows still operate (pending resolve, retry failed, manual add, history access).
4. switch again to `command-center-default`.
5. confirm no data loss and no schema rollback required.

## Production Activation and Stabilization
After staging validation:
1. deploy `v0.42.0-alpha` with Command Center default route.
2. keep legacy-compatible routes available during stabilization window.
3. monitor:
   - action failure rate (`resolve`, `retry`, `dismiss`, `add`)
   - notification read-state errors
   - frontend/API error spikes
   - mobile-specific UX regressions
4. if regression thresholds are exceeded, revert to legacy-compatible landing and investigate.

## Post-Release Validation Queries
Run after production cutover:

```sql
-- Notification volume and unread ratio (24h)
SELECT
  COUNT(*) AS total_24h,
  COUNT(*) FILTER (WHERE is_read = false) AS unread_24h
FROM app_notifications
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- Awaiting decision backlog health (24h)
SELECT
  COUNT(*) FILTER (WHERE status = 'awaiting_decision') AS awaiting_decision,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed
FROM classification_history
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- Error concentration by module (24h)
SELECT module, level, COUNT(*) AS count
FROM error_log
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY module, level
ORDER BY count DESC;
```

## Documentation Gate (Required for Tag)
- Best-practices log (`docs/issue-262-best-practices.md`) is complete and mapped to final design/plan decisions.
- README finalized for Command Center-first IA (`README.md` replacement from proposed draft).
- `CHANGELOG.md` includes Issue 262 release entry for `v0.42.0-alpha`.
- `RELEASE_NOTES.md` includes migration/consolidation notes and known compatibility behavior.
- runbook retained as operational reference for future patch releases.
