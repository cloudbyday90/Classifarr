# Policy Runtime Completion Native Pending Adapter Coverage

## Status

Implemented as Phase 7R Completion Audit Task 7R.10.1.

## Problem

The request-time learning completion record originally proved the core learning
contract and its focused test, while the native pending workflow had grown two
additional server-owned boundaries:

1. native pending selection provenance; and
2. native pending route outcome and persistence.

Those boundaries were implemented and individually tested, but the runtime
completion audit did not inventory their design records, services, or focused
tests. The runtime/rebuild reset also did not require test ownership for them.
A passing completion audit could therefore omit a native pending adapter after a
rename or cleanup without exposing that gap before Phase 8R storage work.

## Official Guidance Reviewed

- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  treats verification as a lifecycle-integrated secure-development practice.
  This task keeps the audit deterministic and validates current repository
  artifacts instead of relying on a historical implementation assertion.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends consistent event information and verification that logging does
  not introduce unwanted side effects. The two native adapters remain bounded,
  outcome-only transitions rather than unbounded operational logging or a new
  learning channel.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  recommend stable common names for operational data. The audit uses durable
  product-domain artifact identifiers and checks stable repository paths.
- [OpenTelemetry versioning and stability guidance](https://opentelemetry.io/docs/specs/otel/versioning-and-stability/)
  explains that event names and well-known values are contracts for downstream
  analysis. The completion audit fails closed if its documented native pending
  artifact inventory drifts.

## Design

```text
request-time learning completion record
  -> native pending selection provenance artifact group
  -> native pending route outcome artifact group
  -> runtime/rebuild reset contract ownership
  -> runtime completion audit
  -> native storage readiness
```

The top-level request-time learning component remains the owner because native
selection and routing outcomes are part of the same request-time outcome path.
The task does not create a parallel learning system or a new runtime route
authority.

Each required supporting artifact group has a stable identifier, label,
completion evidence, design paths, service paths, and focused-test paths:

- `native_pending_selection` inventories the resolution provenance adapter.
- `native_pending_route_outcome` inventories the pure route outcome adapter
  and its best-effort persistence wrapper.

The runtime/rebuild test reset adds two required coverage statements and two
required contract identifiers. Its route-outcome contract permits either the
pure adapter test or persistence-wrapper test to statically import the service
it claims to protect, while requiring both tests in the default manifest.

## Security And Behavior Guarantees

1. The audit reads only repository-relative artifact paths and remains
   side-effect-free.
2. Missing documentation, services, tests, duplicate supporting artifact IDs,
   or path drift fail the completion audit before native storage readiness.
3. The reset requires focused ESM import evidence for native selection and
   route-outcome contracts; a filename alone cannot satisfy ownership.
4. Native selection, route success, and missing mapping remain outcome-only.
   This task cannot enable learning writes, profile refresh, provider calls,
   quota reads, policy writes, or routing.
5. Browser and Discord remain consumers of the same server-owned adapters;
   this task does not introduce transport-specific behavior.

## Recommendations

1. Keep native pending adapters as supporting artifacts of request-time
   learning rather than adding a fourth overlapping outcome system.
2. Require documentation, service, and focused test paths for each adapter
   group, including the route persistence wrapper because its failure semantics
   are part of the outcome contract.
3. Keep the reset manifest's static-import validation so artifact ownership
   follows the actual ESM contract rather than a naming convention.
4. Keep the two coverage assertions explicitly outcome-only, preventing future
   refactors from treating resolution or routing results as policy learning.
5. Fail closed on missing inventory while keeping the audit read-only and
   deterministic.

## Pros And Cons

Pros:

- Closes the current audit gap without adding a redundant top-level runtime
  component.
- Detects missing or moved native pending adapter documentation, services, and
  focused tests before Phase 8R.
- Makes pure route normalization and its persistence behavior jointly visible.
- Preserves strict separation between operational outcomes and learning.

Cons:

- The manifest must be updated deliberately when native pending artifacts move.
- Static ESM import checks demonstrate ownership, not every behavioral
  assertion inside a focused test.
- The route outcome requires two test artifacts because pure normalization and
  post-route persistence have intentionally different failure behavior.

## Final Recommendation Stack

1. `policyNativePendingResolutionProvenance.mjs` records normalized selection
   provenance before a resolution completes.
2. `policyNativePendingRouteOutcome.mjs` normalizes admitted terminal route
   outcomes without side effects.
3. `policyNativePendingRouteOutcomePersistence.mjs` persists an admitted
   outcome best-effort after routing returns.
4. `policyRuntimeRebuildTestReset.mjs` requires focused test ownership and
   outcome-only coverage for both native pending boundaries.
5. `policyRuntimeCompletionAudit.mjs` validates the request-time component's
   supporting documentation, service, and focused-test artifact inventory.

## Verification

Focused coverage verifies that:

- the default completion audit inventories both native pending artifact groups;
- removing an artifact group or one of its repository paths fails closed;
- removing native selection or route-outcome tests from the reset manifest
  leaves required contracts and outcome-only coverage unmapped; and
- the normal audit and reset manifests remain side-effect-free and passing.

## Outcome

Phase 7R completion now explicitly proves that native pending selection and
route outcome contracts remain implemented, tested, documented, and
outcome-only before native storage work proceeds.
