# Webhook Authorization Header Unmask UX - Implementation Plan

## Overview
This plan defines how to add a clear "mask/unmask Authorization Header" experience in the Webhook settings UI, aligned with the API key reveal pattern used in Security settings.

Primary target:
- `client/src/views/settings/Webhooks.vue`

Supporting references:
- `client/src/views/settings/Security.vue` (API key reveal UX pattern)
- `client/src/api/index.js` (`getWebhookSecret()`)
- `server/src/routes/settings.js` (`GET /api/settings/webhook/secret`)

## Problem Statement
Webhook setup requires users to copy the Authorization Header value, but the current UX is split between:
- a masked field in settings, and
- a separate "View Secret" modal flow.

This makes reveal behavior less direct than API key reveal actions and can create uncertainty about what is currently masked, revealed, or copied.

## Goals
- Add a direct, explicit unmask/remask control for Authorization Header in `Webhooks.vue`.
- Keep reveal behavior intentional (user action required), similar to API key reveal.
- Preserve existing webhook generation/regeneration behavior.
- Avoid leaking revealed values into persisted config state or logs.

## Non-Goals
- Changing webhook auth protocol or secret format.
- Reworking webhook backend data model.
- Broad redesign of the Webhooks settings page.

## Current State (Baseline)
- Backend already provides full secret retrieval:
  - `GET /api/settings/webhook/secret`
- Frontend already has API wrapper:
  - `api.getWebhookSecret()`
- Webhooks UI currently supports:
  - masked display
  - "View" modal for full secret
  - copy actions

## Proposed UX and Behavior

### 1) Authorization Header Field Behavior
- Field label becomes explicit: `Authorization Header`.
- Default display is masked value from config.
- Add action buttons:
  - `Unmask` (fetches full value from backend)
  - `Mask` (hides and clears revealed value from reactive state)
  - `Copy` (copies currently displayed effective value, using secure fetch if needed)

### 2) Reveal Flow
- `Unmask` triggers `api.getWebhookSecret()`.
- While request is in progress:
  - disable unmask button
  - show loading text/state
- On success:
  - render full value inline in the field
- On failure:
  - show toast error
  - keep masked state

### 3) Data Handling Rules
- Do not overwrite `config.secret_key` with revealed full secret.
- Keep full secret in dedicated transient UI state only.
- Clear transient revealed value when:
  - user clicks `Mask`
  - user exits editing mode
  - component unmounts

### 4) API Key Pattern Parity
Mirror these principles from Security/API-key UX:
- explicit reveal action
- explicit copy action
- clear user feedback on failures

## Implementation Phases

### Phase 1 - Core UI Refactor (Webhooks.vue)
- Introduce dedicated state:
  - `isAuthHeaderVisible`
  - `revealingAuthHeader`
  - `revealedAuthHeader`
- Refactor field display logic:
  - computed `displayAuthorizationHeader`
- Replace/adjust existing controls:
  - shift from modal-first reveal to inline unmask/remask controls
- Keep existing generate/regenerate flow intact.

### Phase 2 - Security and UX Hardening
- Add cleanup hooks for revealed state:
  - on mode exit (`isEditing -> false`)
  - on unmount
- Ensure copy action is deterministic:
  - masked mode: fetch full secret before copy (or prompt to unmask first)
  - unmasked mode: copy `revealedAuthHeader`
- Ensure no accidental persistence of full secret in saved config payloads.

### Phase 3 - Verification and Documentation
- Manual verification pass (see matrix below).
- Add client test coverage if feasible for:
  - unmask success
  - unmask failure
  - remask cleanup
- Update changelog entry in `CHANGELOG.md` once implementation is complete.

## Implementation Status (Updated 2026-02-25)

### Engineering Checklist
- [x] Added inline Authorization Header card with `Unmask`/`Mask`, `Regenerate`, and `Copy` actions.
- [x] Moved Authorization Header section under Webhook Endpoint / JSON Payload in `Webhooks.vue`.
- [x] Added `GET /api/settings/webhook/secret` usage in the UI unmask/copy flow.
- [x] Fixed backend secret preservation bug where masked values could be written back as stored secret.
- [x] Updated webhook URL/test routes to use decrypted full secret.
- [x] Added regression tests for webhook settings secret handling.
- [x] Added inactivity-based auto-remask timeout for revealed Authorization Header values (default 60 seconds) with timer-reset coverage on user activity.
- [x] Rebuilt container stack and validated healthy startup.

### Remaining Work
- [ ] Execute full manual test matrix TC-01 through TC-10 and record evidence.
- [x] Complete final changelog wording for this feature set (if additional notes are needed).

## File-Level Change Plan
- `client/src/views/settings/Webhooks.vue`
  - update labels and field controls
  - add unmask/remask state and logic
  - keep existing generate/copy/test flows compatible
- Optional (only if required during implementation):
  - `client/src/api/index.js` (no new endpoint expected)
  - `server/src/routes/settings.js` (only if adding reveal rate limit/audit later)

## Acceptance Criteria
1. Authorization Header is masked by default on load.
2. Clicking `Unmask` reveals full header value inline after successful authenticated fetch.
3. Clicking `Mask` hides the value and clears transient revealed state.
4. Copy action works in both masked and unmasked states without exposing value in UI logs/errors.
5. Existing generate/regenerate webhook key flow still works.
6. No regression in webhook save/load behavior.

## Manual Test Matrix
1. Load Webhooks settings with existing secret:
   - verify masked display by default.
2. Click `Unmask`:
   - verify loading state, then full value appears.
3. Click `Mask`:
   - verify masked display returns and revealed state is cleared.
4. Copy while unmasked:
   - verify clipboard receives full value.
5. Copy while masked:
   - verify expected behavior (fetch then copy, or explicit prompt behavior).
6. Regenerate key:
   - verify old revealed value is cleared and new secret flow behaves correctly.
7. Exit edit mode / navigate away:
   - verify revealed value is not retained.

## Manual Verification Runbook (Comprehensive)

### Scope
- Feature under test: Authorization Header component behavior in Webhooks settings.
- Primary files:
  - `client/src/components/settings/WebhookAuthorizationHeaderCard.vue`
  - `client/src/views/settings/Webhooks.vue`

### Prerequisites
1. App is running and reachable in browser.
2. Authenticated admin session is active.
3. You can open `Settings -> Webhooks`.
4. Clipboard access is allowed in your browser.

### Environment Setup
1. Start backend:
   - `npm --prefix server run dev`
2. Start frontend:
   - `npm --prefix client run dev`
3. Log in as admin and navigate to `Settings -> Webhooks`.

### Test Data Variants
- Variant A: existing webhook secret already present.
- Variant B: no webhook secret (fresh/cleared state).
- Variant C: regenerated secret during session.

### Execution Checklist

#### TC-01 Masked by Default (Existing Secret)
- Preconditions:
  - Variant A.
- Steps:
  1. Open `Settings -> Webhooks`.
  2. Locate `Authorization Header` card under `Webhook Endpoint` / `JSON Payload`.
- Expected:
  - Header value is masked (starts with dots, not full plaintext).
  - `Unmask`, `Regenerate`, `Copy` controls are visible.
- Evidence:
  - Screenshot of masked field + controls.
- Result:
  - [ ] Pass
  - [ ] Fail
  - Notes:

#### TC-02 Auto-Generate When Missing
- Preconditions:
  - Variant B.
- Steps:
  1. Open `Settings -> Webhooks`.
  2. Wait for config load completion.
  3. Inspect `Authorization Header` card state.
- Expected:
  - A secret is generated automatically.
  - Field is masked (not plaintext).
  - No blocking errors in UI.
- Evidence:
  - Screenshot before/after load.
- Result:
  - [ ] Pass
  - [ ] Fail
  - Notes:

#### TC-03 Unmask Flow
- Preconditions:
  - Variant A or B with secret present.
- Steps:
  1. Click `Unmask`.
  2. Observe loading state.
  3. Wait for completion.
- Expected:
  - Button shows loading while request is in flight.
  - Full Authorization Header value appears inline after success.
  - No page refresh required.
- Evidence:
  - Screenshot with visible full value (redact before sharing externally).
- Result:
  - [ ] Pass
  - [ ] Fail
  - Notes:

#### TC-04 Mask Flow
- Preconditions:
  - TC-03 completed and value is visible.
- Steps:
  1. Click `Mask`.
- Expected:
  - Field returns to masked form immediately.
  - Full value is no longer visible.
- Evidence:
  - Screenshot after masking.
- Result:
  - [ ] Pass
  - [ ] Fail
  - Notes:

#### TC-05 Copy While Unmasked
- Preconditions:
  - Value is currently unmasked.
- Steps:
  1. Click `Copy`.
  2. Paste into a temporary text editor.
- Expected:
  - Pasted value matches currently visible full Authorization Header.
  - Success toast appears.
- Evidence:
  - Paste capture in local scratch pad (do not commit).
- Result:
  - [ ] Pass
  - [ ] Fail
  - Notes:

#### TC-06 Copy While Masked
- Preconditions:
  - Value is masked.
- Steps:
  1. Click `Copy` without unmasking first.
  2. Paste into temporary text editor.
- Expected:
  - Pasted value is full secret (not masked dots).
  - Success toast appears.
  - Field remains masked unless explicitly unmasked.
- Evidence:
  - Screenshot + pasted value validation.
- Result:
  - [ ] Pass
  - [ ] Fail
  - Notes:

#### TC-07 Regenerate Flow
- Preconditions:
  - Existing secret present.
- Steps:
  1. Click `Regenerate`.
  2. Confirm prompt.
  3. Observe resulting field state.
  4. Copy new value and compare against previously saved value.
- Expected:
  - Confirmation prompt appears.
  - New secret is produced (different from old).
  - Old secret is invalidated.
  - UI reflects new secret masked/visible state correctly.
- Evidence:
  - Before/after comparison (redacted).
- Result:
  - [ ] Pass
  - [ ] Fail
  - Notes:

#### TC-08 Exit Edit Mode Cleanup
- Preconditions:
  - Header is unmasked and visible.
- Steps:
  1. Leave the page section/state where the card is shown (for example route change or full refresh).
  2. Return to `Settings -> Webhooks`.
- Expected:
  - Full secret is not retained as visible UI state on return.
  - Field appears masked unless user clicks `Unmask` again.
- Evidence:
  - Screenshot after returning to page.
- Result:
  - [ ] Pass
  - [ ] Fail
  - Notes:

#### TC-09 Route Navigation Cleanup
- Preconditions:
  - Header is unmasked and visible.
- Steps:
  1. Navigate to another settings tab/page.
  2. Return to Webhooks.
  3. Locate `Authorization Header` card.
- Expected:
  - Value is masked again.
  - No stale plaintext rendering after navigation.
- Evidence:
  - Screenshot on return.
- Result:
  - [ ] Pass
  - [ ] Fail
  - Notes:

#### TC-10 Error Handling (Reveal Failure)
- Preconditions:
  - Ability to simulate backend failure (temporary API block or network offline).
- Steps:
  1. Trigger failure condition.
  2. Click `Unmask`.
- Expected:
  - Error toast displayed.
  - Value remains masked.
  - UI recovers when backend/network restored.
- Evidence:
  - Screenshot of error toast.
- Result:
  - [ ] Pass
  - [ ] Fail
  - Notes:

### Completion Criteria
- All test cases TC-01 through TC-10 pass.
- No critical UI or workflow regressions observed in Webhooks page.
- Any failures are logged with reproduction steps and severity.

### Execution Log
- Tester:
- Date:
- Environment:
- Overall Result:
  - [ ] Pass
  - [ ] Fail
- Follow-up defects:

### Live Execution Tracker
Use this section during the live run. Mark each case as `Pass`, `Fail`, or `Blocked`, and include evidence references.

| Test Case | Status | Evidence | Notes |
|---|---|---|---|
| TC-01 Masked by Default (Existing Secret) | Pass | In-thread UI screenshot (2026-02-25) | Field shows masked value and controls visible. |
| TC-02 Auto-Generate When Missing | Pass (Automated) | `client/src/__tests__/settings/WebhookAuthorizationHeaderCard.test.js` | Covered by `auto-generates a secret when missing on mount`. |
| TC-03 Unmask Flow | Pass (Automated) | `client/src/__tests__/settings/WebhookAuthorizationHeaderCard.test.js` | Covered by `unmasks and re-masks authorization header reliably`. |
| TC-04 Mask Flow | Pass (Automated) | `client/src/__tests__/settings/WebhookAuthorizationHeaderCard.test.js` | Covered by same unmask/remask test. |
| TC-05 Copy While Unmasked | Pass (Automated) | `client/src/__tests__/settings/WebhookAuthorizationHeaderCard.test.js` | Covered by `copies visible unmasked header without refetching`. |
| TC-06 Copy While Masked | Pass (Automated) | `client/src/__tests__/settings/WebhookAuthorizationHeaderCard.test.js` | Covered by `copies full header while remaining masked when still masked in UI`. |
| TC-07 Regenerate Flow | Pending | `client/src/__tests__/settings/WebhookAuthorizationHeaderCard.test.js` | UI flow covered (`regenerates and emits updated masked secret`), but old-secret invalidation still needs manual/integration validation. |
| TC-08 Exit Edit Mode Cleanup | Pass (Automated) | `client/src/__tests__/settings/WebhookAuthorizationHeaderCard.test.js` | Covered by `clears visible secret when masked secret prop is removed`. |
| TC-09 Route Navigation Cleanup | Pass (Automated) | `client/src/__tests__/settings/WebhookAuthorizationHeaderCard.test.js` | Covered by `returns to masked state after component remount (navigation cleanup)`. |
| TC-10 Error Handling (Reveal Failure) | Pass (Automated) | `client/src/__tests__/settings/WebhookAuthorizationHeaderCard.test.js` | Covered by `shows error and stays masked when unmask fails`. |

### Live Session Notes
- Session start time: 2026-02-25 (local)
- Session end time: In progress
- Browser/version: User environment (not directly instrumented by agent)
- Build/commit identifier: Local working tree + `docker compose up -d --build`
- Critical issues found: Initial unmask reliability issue caused by masked secret preservation in backend route handling.
- Non-critical issues found: API client method name collision (`updateWebhookConfig`) created ambiguous webhook config update behavior; renamed source-config variant.
- Automated evidence added:
  - `npm --prefix client test -- src/__tests__/settings/WebhookAuthorizationHeaderCard.test.js`
  - Result: 9/9 passing

## Risks and Mitigations
- Risk: Revealed value accidentally included in save payload.
  - Mitigation: keep revealed value in separate UI state, never in `config`.
- Risk: User confusion between "secret key" and "authorization header".
  - Mitigation: standardize UI text to "Authorization Header" with helper text.
- Risk: Extra secret fetch calls from repeated copy/unmask.
  - Mitigation: short-lived in-memory revealed state reused during the session.

## Expansion Backlog (Future)
- Add backend audit trail for webhook secret reveal events.
- Add rate limiting specific to `/api/settings/webhook/secret`.
