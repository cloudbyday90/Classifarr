# Policy Library Profile Evidence Loader

## Status

Implemented as the server-owned cached-profile and freshness handoff for policy
evidence.

The loader reads a persisted `library_profiles` record through the existing
library profile service, adapts it with `policyLibraryProfileEvidence.mjs`,
derives a bounded freshness record, and sends only the bounded result through
the policy evidence boundary. It never refreshes a library, calls a media
server or provider, reads provider quota, or writes policy storage.

## Problem

The profile adapter is deliberately pure. Runtime callers still need one
consistent server-side path that loads cached profile data and determines whether
the observation is current enough to support downstream policy work. Letting a
client supply a freshness flag or raw profile would allow stale or untrusted
state to reach the evidence engine.

## Official Guidance Reviewed

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  requires server-side syntactic and semantic validation. The loader validates
  a positive library ID, parses timestamps server-side, and treats missing or
  invalid freshness data as review-required rather than current.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends re-deriving security-relevant values from trusted server data.
  Freshness is therefore computed from the persisted profile timestamp, never
  accepted from the caller.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  calls for safe error handling and resource protection. Loader failures expose
  stable risk IDs and generic messages, not database details.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  support stable, documented attribute meanings. The loader returns stable
  status and reason IDs without introducing a telemetry dependency.

## Recommendations

1. Load the saved profile by server-validated library ID only.
2. Keep profile loading read-only and offline from the media server and metadata
   providers.
3. Use the recorded `last_generated_at`, falling back to `updated_at`, as the
   sole freshness source.
4. Treat a profile older than seven days, or a missing/invalid timestamp, as
   review-required evidence. Do not silently classify it as current.
5. Require both the profile-evidence audit and the complete evidence-boundary
   audit before reporting a ready handoff.

## Pros And Cons

Pros:

- Prevents client-provided freshness claims and raw profile payloads from
  bypassing the evidence boundary.
- Keeps profile loading deterministic, cache-backed, and provider-free.
- Preserves stale observations for inspection while ensuring they become
  insufficient evidence downstream.
- Sanitizes loader failures so database details do not leave the server layer.

Cons:

- A seven-day threshold is a product default and may later need a controlled
  server setting.
- The loader does not regenerate profiles; a separate refresh workflow remains
  responsible for that side effect.
- This component does not yet attach classification outcomes, routing outcomes,
  or operator intent to the evidence envelope.

## Final Recommendation Stack

1. `libraryProfileService.getProfile()` reads the existing persisted profile.
2. `policyLibraryProfileEvidence.mjs` converts distributions into bounded
   compatibility and outlier evidence.
3. `policyLibraryProfileEvidenceLoader.mjs` derives trusted freshness and runs
   the evidence boundary.
4. `policyEvidenceBoundary.mjs` remains the only handoff to later engines.

## Implementation Outcome

The loader returns stable status IDs for an invalid library ID, missing profile,
load failure, unsafe adapted evidence, blocked boundary, current profile, and
stale profile. Successful results include only:

```text
libraryId
profileEvidence
profileEvidenceAudit
profileFreshness
evidenceBoundary
evidenceBoundaryAudit
sideEffects
```

`profileFreshness` has a stable key, stale boolean, normalized timestamp, age,
maximum age, and reason ID. Missing or invalid timestamps are explicitly stale.
The evidence engine converts stale freshness to insufficient evidence, keeping
normal automation from treating unknown age as trusted.

## Security Outcome

- The library ID is validated before any profile read.
- The loader reads only the persisted profile service; it cannot refresh or
  contact external systems.
- Errors do not expose the original database exception.
- Freshness is re-derived from trusted server data.
- Ready results require both a successful evidence boundary and boundary audit.
- Side-effect audit rejects live media-server/provider activity, provider quota
  reads, and policy storage mutation.

## Next Step

Add a single runtime evidence-envelope assembler that combines this cached
profile handoff with already persisted classification outcomes, manual
corrections, pending answers, routing outcomes, and bounded metadata evidence.
It must remain read-only and pass the combined envelope through the same policy
evidence boundary.
