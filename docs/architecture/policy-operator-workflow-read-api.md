# Policy Operator Workflow Read API

## Status

Implemented for Phase 6R.5 as the read-only, library-first input to the
rebuilt policy-authoring UI.

The endpoint is:

```text
GET /api/policies/operator-workflow/libraries/:libraryId
```

It validates the connected library, reads only its persisted profile and Arr
mapping, and returns the server-owned five-section workflow with bounded
observed-library suggestions. It does not refresh a media server, call a
metadata or search provider, inspect quota state, write policy state, learn
from outcomes, or execute routing.

## Problem

The policy builder currently composes library context, local draft state, and
diagnostic panels in Vue. That makes the client responsible for deciding what
the library means and encourages operators to configure implementation details.

Phase 6R.5 needs one product projection that starts from the source of truth:
the connected media-server library. The projection must separate what is
already observed from what an operator has deliberately accepted as policy
intent.

## Official Guidance Reviewed

- [W3C WAI: Grouping Controls](https://www.w3.org/WAI/tutorials/forms/grouping/)
  recommends grouping related controls with a visible and semantic group label.
  The response provides the fixed five destination-oriented sections that the
  UI will render as small form groups.
- [W3C ARIA Authoring Practices: Checkbox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/)
  requires accessible labels, descriptions, and grouped checkbox semantics.
  Observed suggestions include source and acceptance state so future multi-select
  controls can retain an accessible explanation for each selection.
- [GOV.UK Design System: Checkboxes](https://design-system.service.gov.uk/components/checkboxes/)
  recommends checkbox groups for multiple independent selections, a clear
  instruction such as "Select all that apply," and no preselected choices. The
  API marks every observed value as requiring explicit acceptance.
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
  supports server-side enforcement of business rules. The endpoint has no
  client-supplied evidence payload, and its response explicitly cannot authorize
  automation, policy persistence, or routing.

## Design

The server builds the projection from three bounded inputs:

1. **Connected library identity**: an existing `libraries` row validates the
   requested destination.
2. **Persisted profile**: `policyLibraryProfileEvidenceLoader` adapts the cached
   profile into display-safe observations. A stale profile remains visible but
   is labeled as needing refresh; it is never refreshed as a side effect of
   this GET request.
3. **Persisted routing map**: `library_arr_mappings` produces only configured
   versus unconfigured routing readiness. It exposes no Arr credentials,
   request payloads, or live connection attempt.

The returned `observedProfile.suggestions` represent values already seen in the
library. Each has `requiresExplicitAcceptance: true`. Observations are useful
defaults for an operator, but they are not silently promoted to `belongs_here`,
hard limits, avoid rules, or durable learning.

The five-section `workflow` continues to come from
`policyOperatorWorkflow.mjs`:

```text
what_belongs_here
what_should_not_go_here
what_helps_but_should_not_decide_alone
when_should_classifarr_ask
can_this_route
```

The response is a display projection, not an automation decision. Runtime and
migration callers must continue to use the bounded workflow wrapper with its
full evidence, learning, readiness, quality, and provenance checks.

## Pros And Cons

Pros:

- Gives the future Vue rebuild one server-owned source for library context and
  workflow structure.
- Keeps current library observations visible without presenting them as policy
  requirements or exclusions.
- Prevents provider, quota, replay, TMDB, raw-profile, and routing-execution
  mechanics from reaching the normal policy path.
- Makes stale and missing-profile states product-level outcomes rather than
  client-side error handling.

Cons:

- It is intentionally display-only and does not yet apply accepted selections
  to the typed policy draft.
- Existing saved native intent is not yet merged into this library-first read
  projection; that belongs to the following draft-command component.
- It adds a small route and contract that the Vue builder must adopt before old
  panels can be deleted.

## Final Recommendation Stack

1. Use this endpoint for the destination context and observed-suggestion source
   in the normal builder.
2. Keep selections local until the typed draft-command boundary accepts them.
3. Keep policy persistence, learning, runtime decisions, and routing behind
   their existing server-side authority boundaries.
4. Replace the legacy modal panels only after the client renders this projection
   and can save a typed accepted-intent draft.

## Implementation

- Server read service:
  `server/src/services/policyOperatorWorkflowReadService.mjs`
- Route:
  `server/src/routes/policiesRouteOperatorWorkflowRead.mjs`
- Client API leaf:
  `client/src/api/policiesApi.js`
- Server tests:
  `server/src/__tests__/services/policyOperatorWorkflowReadService.test.mjs` and
  `server/src/__tests__/policies-operator-workflow-read-routes.test.mjs`
- Client API test:
  `client/src/__tests__/api/policiesApi.test.js`

## Security Outcome

- Input is a positive library ID in the URL path; evidence is never accepted
  from the browser.
- Only cached profile data and the stored mapping are read.
- The API exposes display-safe labels, counts, confidence, and source category,
  never raw media, provider, credential, quota, or diagnostic payloads.
- Observed values cannot become declared intent without a later explicit
  draft-command action.
- The response states that it cannot authorize automation, policy persistence,
  or routing execution.
