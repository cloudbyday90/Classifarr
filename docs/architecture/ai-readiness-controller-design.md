# AI Readiness Controller Design

## Status

Implemented on 2026-08-30. This document records the design decision for the
single self-updating readiness surface in **Settings → AI**.

## Problem

AI Settings previously placed the saved capability, runtime-integrity
observations, saved-test history, compatibility matrix, capability-change
receipts, and scheduled preflight in separate visible cards. Each card had a
separate refresh or action. That exposed diagnostic implementation detail
before answering the operator's first question: whether the saved AI path is
ready for strict candidate-bound verification.

The earlier save-and-auto-test flow correctly tests a newly saved primary
Ollama target, but routine capability freshness still depended on a manual
read-only refresh. The new presentation must reduce that work without
silently creating provider traffic or changing routing authority.

## Official Research Basis

Reviewed against official sources available on 2026-08-30:

- [W3C WCAG 2.2: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  requires programmatically determinable status changes that do not take
  focus. The controller therefore maintains one persistent polite, atomic
  status region for readiness, checking, and result states.
- [W3C WCAG 2.2: Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide)
  requires user control over automatically updating parallel content. The
  automatic status refresh is visible-page only and exposes a pause/resume
  control in the adjacent diagnostics disclosure.
- [Vue composables guidance](https://vuejs.org/guide/reusability/composables)
  calls for DOM effects to be installed in mounted lifecycle hooks and cleaned
  up on unmount. The lifecycle, focus listener, visibility listener, interval,
  and watcher live in one composable and are disposed together.
- [OWASP API4:2023](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)
  recommends operation-specific rate limits and bounded resource consumption.
  Automatic refresh uses the existing low-cost capability read only; it never
  initiates an Ollama probe, matrix run, model discovery, save, or route.

## Decision

Introduce three modular client units:

1. `useAiReadinessAutoRefresh` owns a bounded, read-only refresh lifecycle.
2. `AiReadinessController` presents one operator-facing readiness state and
   moves controls and evidence into an accessible native disclosure.
3. `OllamaScheduledPreflightSummary` renders a bounded scheduled-preflight
   projection without exposing raw provider errors.

The controller refreshes the existing server-owned
`GET /api/settings/ai/verification-capability` projection:

- once when AI Settings mounts;
- every two minutes only while the page is visible;
- when the browser window regains focus or the page becomes visible;
- after a saved strict-verification test or AI settings save; and
- when the operator explicitly selects **Refresh now**.

The automatic-update control starts enabled and is scoped to the mounted
settings view. Pausing it stops interval, focus, and visibility refreshes but
does not prevent an explicit refresh. No capability result is cached in local
storage.

All detailed reads are lazy: they begin only when the operator opens
**Diagnostics and update controls**. The compatibility matrix remains a
separate explicit, bounded action because it performs provider work. A strict
verification test is displayed only when the server says that the saved
Ollama capability needs a test; the existing save-and-auto-test path remains
the only automatic provider test.

## Security and Authority Boundaries

- The browser still receives only the existing administrator-authorized,
  server-owned, `no-store` capability projection.
- Automatic refresh cannot send a host, model, prompt, schema, or media item.
- It cannot run provider tests, compatibility checks, model discovery, writes,
  retries, policy changes, learning, or routing.
- Only the current capability read is automatically refreshed. Aggregate
  histories, runtime observations, receipts, and scheduled-preflight data are
  intentionally deferred until diagnostics open.
- Scheduled-preflight diagnostics retain fixed status, timestamp, failure-type,
  and next-attempt fields. Raw provider error strings and model/endpoint
  values are not rendered by the new component.
- An explicit post-save refresh may run while an older initial read is still
  pending; request sequencing keeps the newer server projection authoritative.

## Alternatives

| Option | Pros | Cons |
| --- | --- | --- |
| Keep five independently refreshed cards | No refactor | High decision load and routine manual work. |
| Auto-run provider tests on a timer | Feels hands-off | Creates uncontrolled local-model traffic and can repeatedly probe a changed target. |
| Server-Sent Events | Near-immediate updates | Adds a persistent connection and server lifecycle without a provider event source; disproportionate for an infrequently changing saved capability. |
| **Visible-page read-only polling with focus refresh** | Uses the existing authority projection, is bounded and pausable, and works after remote changes | Freshness is periodic rather than instantaneous. |

## Final Recommendation Stack

1. Keep server-owned capability admission and the save-and-auto-test boundary.
2. Make the readiness controller the sole primary AI Settings status.
3. Refresh only the read-only capability automatically, while visible, with a
   pause control and a two-minute bound.
4. Treat diagnostics as lazy, optional evidence; keep provider-affecting
   actions explicit.
5. Build the proposed Library Evidence Profile next so policy-vs-metadata/RAG
   disagreements become observable before semantic signals can influence
   routing.
