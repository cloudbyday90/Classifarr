# Candidate-Bound Verification Capability Current-State Summary

## Status

11R.7 is complete on 2026-08-13. Administrators can now read the current saved
strict candidate-bound verification capability in AI Settings, refresh that
read-only status, and open the existing aggregate Verification monitoring tab.

The summary is not a provider health check, connection test, model-discovery
request, settings mutation, fallback selection, budget operation, policy
change, route decision, classification action, or retry command. It never
returns a provider, model, endpoint, credential, prompt, model output, item,
policy, library, or aggregate identity.

## Problem

11R.6 reports the capability of a proposed configuration before an
administrator saves it. An administrator who explicitly saved a general-AI
configuration with advisory-only strict verification had no direct
current-state explanation in AI Settings. Inferring capability later from a
pending decision risks conflating provider liveness, AI advice, policy
authority, and the saved configuration admission contract.

## Official Research Basis

This implementation was reviewed against official guidance available in
August 2026:

- OWASP requires least privilege, deny-by-default behavior, and authorization
  checks on every request. The new route remains under the existing
  authentication and administrator authorization applied to `/api/settings`.
  [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- OWASP REST guidance identifies `Cache-Control: no-store` as the appropriate
  directive for browser-consumed API responses that should not be cached. The
  saved capability response therefore always uses it. [OWASP REST Security
  Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- NIST's AI RMF Playbook calls for production monitoring and documentation of
  observed controls without treating one observation as a full risk diagnosis.
  The summary states configuration admission only and links to existing
  aggregate monitoring. [NIST AI RMF Playbook](https://airc.nist.gov/airmf-resources/playbook/)
- W3C describes `role="status"` as a polite live region with atomic updates.
  The summary uses an explicit atomic status region for refreshed advisory
  state without interrupting the operator. [W3C ARIA22: Using
  `role=status`](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22)

## Decision

Add `GET /api/settings/ai/verification-capability`. The handler calls the
existing preflight service without a proposal, reusing the 11R.6 minimum
stored-configuration reader and server-owned authority and candidate-bound
admission contracts. It returns the same versioned fixed `statusId`, label,
message, guidance, anonymous path capabilities, and explicit false
side-effect flags with `Cache-Control: no-store`.

The browser renders only the fixed label, message, and up to three guidance
lines. It has two bounded controls:

1. **Refresh Status** repeats the same read-only GET. It does not test a
   provider, discover models, or mutate configuration.
2. **Review Aggregate Readiness** opens `/statistics?tab=verification`, which
   selects the existing administrator-authorized aggregate Verification tab.

The summary refreshes after a successful `PUT /api/settings/ai`, before the
independent pattern-settings save. On request failure it uses a fixed
unavailable state and never renders transport errors. Request sequencing
prevents a late older response from overwriting a newer post-save status.

## Alternatives

### Browser-Only Capability Inference

Pros: no request.

Cons: duplicates server authority rules, becomes stale after another
administrator saves, and treats editable form state as configuration truth.

Decision: rejected.

### Live Provider Probe on Refresh

Pros: might report liveness.

Cons: adds external effects, rate-limit and outage behavior, sensitive
diagnostics, and still does not prove strict structured-output authority.

Decision: rejected. Existing explicit provider operations remain separate.

### Background Polling

Pros: an open tab would eventually observe a remote save.

Cons: repeated privileged reads, ambiguous freshness, and noisy accessibility
status changes.

Decision: rejected. Initial load, post-save refresh, and explicit refresh are
the deterministic freshness points.

### Embed Aggregate Data in AI Settings

Pros: one screen could display configuration and outcome history.

Cons: conflates configuration admission with aggregate interpretation and
widens the settings boundary.

Decision: rejected. The bounded link preserves distinct read models.

## Final Recommendation Stack

1. Derive strict-verification capability server-side from the saved minimum
   configuration using the existing admission contract.
2. Keep the response fixed, identity-free, versioned, administrator-protected,
   and `no-store`.
3. Render fixed advisory text in an accessible status region; never render
   transport failures or configuration fields.
4. Refresh after successful settings persistence and on explicit request while
   rejecting stale responses.
5. Link to, but do not merge with, aggregate Verification monitoring.
6. Keep provider testing, model discovery, policy edits, routing, and retries
   separate explicit operations.

## Implementation Evidence

- Current-state handler: `server/src/routes/helpers/aiSettingsHandlers.mjs`.
- Route registration and inherited administrator boundary:
  `server/src/routes/settingsRouteProviders.mjs` and `server/src/routes/api.mjs`.
- Existing pure capability projection and minimum reader:
  `server/src/services/classificationCandidateBoundVerificationProviderPreflight.mjs`,
  `classificationCandidateBoundVerificationProviderPreflightRepository.mjs`, and
  `classificationCandidateBoundVerificationProviderPreflightService.mjs`.
- Client API and presentation:
  `client/src/api/settingsProviders.js`,
  `client/src/components/settings/VerificationCapabilityCurrentStateSummary.vue`,
  `client/src/views/settings/AI.vue`, and `client/src/views/Statistics.vue`.
- Focused tests prove the cache directive, authorization inheritance, privacy
  bounds, no provider/model discovery, no mutation, explicit and post-save
  refresh, stale-read rejection, failure redaction, and verification-tab link.

## Next Task

Proceed with **11R.8 Verification Capability Change Receipt**. Add a durable,
administrator-authorized receipt for a successful AI configuration save that
records only fixed before-and-after strict-verification status IDs,
server-derived actor, configuration revision, and timestamp. It must not store
provider, model, endpoint, credential, prompt, model output, policy, item,
library, or routing data, and it must not create provider or policy authority.
