# Route-safety readiness auto-refresh outcome

## Delivered behavior

AI Settings now has a separate **Routing safeguards** summary beneath the
saved AI-readiness state. It automatically refreshes in the existing
visible-page, two-minute AI-readiness lifecycle and respects the existing
pause/resume control.

The summary reports one of two meaningful states:

- **Route safeguards observed**: the completed seven-day window contains a
  persisted deterministic primary route-safety gate. Up to three fixed gate
  categories and counts are shown.
- **No recent safeguard decisions**: the completed window contains no
  persisted safety-gate projection. The UI explicitly says this is not an AI
  readiness or policy-health verdict.

An unavailable aggregate has a text explanation and does not change provider,
policy, or routing behavior.

## Implementation record

- `server/src/services/routeSafetyReadiness*.mjs` separates the fixed
  aggregate contract, query, and read service.
- `server/src/routes/statsRouteRouteSafetyReadiness.mjs` provides an
  administrator-only, parameter-free, no-store, rate-limited endpoint.
- `database/migrations/20260831_090000_add_route_safety_readiness_metrics_index.sql`
  adds a partial index for the existing route-safety version; it introduces no
  new data store.
- `client/src/utils/routeSafetyReadinessPresentation.js` rejects unexpected
  response text and identifiers before rendering.
- `client/src/components/settings/RouteSafetyReadinessSummary.vue` provides
  the compact card, pause-aware update text, and transition-only live status.
- `client/src/views/settings/AI.vue` refreshes saved capability and aggregate
  route safety together without testing a model.

## Validation plan

Focused server tests cover the completed UTC window, response allow-list,
static aggregate SQL, malformed-range failure, service ownership, admin denial,
rate limiter, and `no-store` response. Client tests cover the API leaf/barrel,
client allow-list, UI rendering, hidden-field rejection, automatic refresh, and
the accessibility status transition. The complete server/client test suites,
lint/type checks, security diff review, and a no-cache local Compose rebuild
are required before commit.

## Pull-request discovery result

The GitHub connector was queried for `repo:cloudbyday90/Classifarr is:pr
is:open` on 2026-08-31. It returned issue records rather than a usable pull
request; the local GitHub CLI was unauthenticated (`HTTP 401`). No pull request
was therefore claimed, copied, or merged. Treating an issue as a pull request
would have made the requested local implementation unverifiable. A future run
should repeat the connector query when a real open PR is available.

## Follow-up

Use the first several completed UTC windows to confirm the summary maps
operator experience to the right high-level gate categories. The next
high-value component is a **policy-maintenance handoff from repeated aggregate
gate evidence**: offer one fixed, read-only link to the existing policy review
when a sufficiently representative, stable gate pattern persists. It should
remain advisory and should not auto-edit policy, invoke AI/RAG, retry, or route
media.
