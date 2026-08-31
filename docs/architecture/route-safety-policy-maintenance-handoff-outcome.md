# Route-safety policy-maintenance handoff outcome

## Delivered behavior

AI Settings now evaluates a second aggregate-only route-safety report when the
existing current-window readiness report contains observations. A **Policy
maintenance** card appears only when the same policy-owned primary safeguard is
representative in two adjacent completed seven-day UTC windows.

The card names the safeguard category using fixed client copy and offers one
descriptive **Review policy configuration** link to the existing Policies view.
It never names or selects a policy, library, destination, media item, provider,
or operator. Following the link is optional. The handoff cannot edit a policy,
invoke AI/RAG, retry a classification, change learning, or route media.

## Implementation record

- `server/src/services/routeSafetyMaintenanceHandoff.mjs` owns the fixed
  stability and representativeness assessment.
- `server/src/services/routeSafetyMaintenanceHandoffRepository.mjs` owns a
  static parameterized aggregate over the existing persisted route-safety
  projection.
- `server/src/services/routeSafetyMaintenanceHandoffService.mjs` owns the
  server-built adjacent completed-day windows.
- `server/src/routes/statsRouteRouteSafetyMaintenanceHandoff.mjs` provides an
  administrator-only, no-store, rate-limited read endpoint.
- `client/src/utils/routeSafetyMaintenanceHandoffPresentation.js` maps only
  allow-listed gate identifiers to fixed text.
- `client/src/components/settings/RouteSafetyMaintenanceHandoff.vue` renders
  the optional advisory card and a transition-only status message.
- `client/src/views/settings/AI.vue` reads the handoff only after current
  route-safety observations exist, in the same visible-page refresh lifecycle.

## Validation plan

Server tests cover stable representative assessment, malformed/overlapping
window rejection, fixed SQL fields, service-owned windows, authorization,
rate limiting, and `no-store`. Client tests cover the API leaf/barrel,
allow-list rendering, absence of server-derived policy data, descriptive route
target, and accessibility status transition. Full suites, type checks, lint,
coverage ratchet, security diff review, and a no-cache local Compose rebuild
are required before commit.

## Pull-request discovery result

GitHub MCP pull-request search for `cloudbyday90/Classifarr` returned no open
pull requests on 2026-08-31. No unrelated issue or closed pull request was
treated as an open PR, and no PR implementation was copied or merged locally.

## Next item

Build an explicitly opened, policy-scoped evidence digest in the existing
Policies view. It should show a bounded, redacted history relevant to the
policy the operator chose, preserve provenance and uncertainty, and remain
read-only until a separate explicit policy-edit flow is invoked. That will make
the general handoff actionable without allowing an aggregate signal or AI/RAG
to infer a policy target.
