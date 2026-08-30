# AI Readiness Controller Outcome

## Status

Implemented on 2026-08-30. No release is created by this change.

## Delivered Outcome

**Settings → AI** now leads with one **AI Readiness** card rather than five
equal-weight verification cards.

- The card states the server-owned saved capability in plain language and
  shows a stable badge: ready, ready with advisory, needs verification,
  classification only, unavailable, or status unavailable.
- A saved Ollama configuration displays one test action only when its current
  server-projected status needs verification. A ready configuration does not
  advertise an unnecessary manual test.
- The readiness state updates automatically on initial view entry, on a
  visible-page two-minute cadence, and after returning to the page or browser
  window. Operators can pause or resume those automatic updates and can still
  explicitly refresh.
- Runtime observations, test history, compatibility matrix, receipts, and
  scheduled-preflight state are loaded only after **Diagnostics and update
  controls** is expanded.
- The deferred scheduled-preflight display omits raw provider error text and
  configured model/endpoint values, retaining only bounded operational status
  fields.

## Implementation Evidence

- Lifecycle and concurrency boundary:
  `client/src/composables/useAiReadinessAutoRefresh.js`.
- Primary accessible UI and diagnostics disclosure:
  `client/src/components/settings/AiReadinessController.vue`.
- Bounded scheduled-preflight display:
  `client/src/components/settings/OllamaScheduledPreflightSummary.vue`.
- Settings integration, lazy diagnostic reads, and post-save/test refresh:
  `client/src/views/settings/AI.vue`.

## Validation

Focused client coverage verifies:

- ready and remedial saved-capability presentation;
- one actionable test control when strict verification is not admitted;
- diagnostics-only automatic-update controls;
- mount, visible-page interval, pause, hidden-page, and explicit refresh
  behavior;
- a post-save refresh that may supersede an earlier still-pending read;
- lazy diagnostic loading, capability refresh after save, and raw preflight
  error redaction in the AI Settings view.

The existing AI Settings suite was updated to assert the new deliberate
boundary: diagnostics are absent until their disclosure opens, rather than
being silently fetched on page load.

## Pull Request Check

The GitHub repository query for open pull requests returned an empty result on
2026-08-30. Consequently there was no open PR that could be selected and
implemented locally in this change; no closed or guessed PR was substituted.

## Next Item

Implement the **Library Evidence Profile** as a read-only policy-maintenance
surface. It should contrast declared-policy evidence with item metadata,
current-library inventory, and the already offline-evaluated semantic/RAG
signal. It must remain advisory until reviewed evaluation metrics justify any
new policy-score influence.
