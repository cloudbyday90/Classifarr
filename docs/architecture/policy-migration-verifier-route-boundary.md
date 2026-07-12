# Policy Migration Verifier Route Boundary

## Status

Implemented on July 11, 2026. Read-only impact verification lives under
`/api/policies/migration-verifier/impact-preview`, outside normal policy write
routes. The replay endpoint was retired after its provider, scoring, and local
diagnostic branches no longer supplied an independent migration decision.

The normal policy write route now owns creation and update behavior only. The
migration verifier remains a separate, deterministic diagnostic boundary until
native-storage parity authorizes the planned diagnostic deletion work.

## Problem

Impact verification was registered beside policy creation and update. That
mixed a temporary migration safety tool with ordinary destination setup,
increasing the chance that diagnostic behavior would be treated as part of
normal authoring or be extended with write behavior.

## Official Guidance Reviewed

- [NIST SP 800-228](https://csrc.nist.gov/pubs/sp/800/228/upd1/final)
  recommends lifecycle-specific, risk-based controls for APIs. Separating
  migration verification from normal writes narrows the accepted behavior of
  each route boundary.
- [MDN JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
  describes modules as a way to split complex applications into importable,
  focused units. The dedicated ESM route owns only verifier composition while
  the write route no longer imports diagnostic services.

## Recommendation

Use separate route ownership for migration verification:

```text
policy writes               -> /api/policies
migration verification only -> /api/policies/migration-verifier/*
```

Keep the remaining verifier endpoint read-only. Do not add policy persistence,
provider write, Arr write, learning, rollback creation, or legacy deletion
behavior to this route.

## Pros And Cons

Pros:

- Removes diagnostic orchestration from the normal policy-write module.
- Makes migration-verifier intent explicit in the API namespace.
- Keeps the existing deterministic, bounded verifier behavior available while
  native-storage deletion gates remain incomplete.
- Preserves modular ESM ownership with a focused route file.

Cons:

- The client endpoint changes during this beta-stage API cutover.
- The existing optional verifier presentation remains a separate deletion task;
  it is not part of ordinary policy writes.

## Final Implementation Stack

1. Register `policiesRouteMigrationVerifier.mjs` from the policy route
   composition root.
2. Keep the impact endpoint in the migration-verifier namespace; the replay
   endpoint was retired because it had no independent migration decision.
3. Invoke the canonical impact verifier directly after route-owned validation
   and preset resolution.
4. Keep route input validation and preset resolution server-owned.
5. Keep all verifier side effects disabled.
6. Track the dedicated route, not the policy write route, as the migration
   artifact in deletion and completion audits.
7. Remove the verifier client surface and server internals only after the
   native-storage deletion gates prove parity.

## Validation

- Route coverage exercises the impact verifier and proves the retired replay
  endpoint is unavailable through the dedicated namespace.
- API-layer tests verify the client uses the new namespace.
- Security and client lint verify modular imports and static checks.

## Outcome

Migration verification is now explicit infrastructure rather than an implicit
capability of ordinary policy writes. The evidence engine remains independent of
replay and impact diagnostics.
