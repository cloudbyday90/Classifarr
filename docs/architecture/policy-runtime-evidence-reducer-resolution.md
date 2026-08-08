# Policy Runtime Evidence Reducer Resolution

## Status

Implemented on August 6, 2026 and re-evaluated on August 8, 2026.

## Decision

The generated-intent outcome reducer
(`policyMigrationGeneratedIntentOutcome.mjs`) is **retained as a
migration-only contract**. It is not promoted into the runtime-evidence
projection, and it is not deleted until the migration verifier chain is
deleted under the 5R.8.4 final gate.

The reducer produces a migration-comparison outcome shape
(`destinationLibraryId`, `destinationLibraryName`, `statusId`, `routeReady`,
`blocked`, `needsReview`, `confidenceScore`, `confidenceLevel`) used solely to
compare legacy outcomes against accepted rebuild proposals during cutover
verification. A comprehensive runtime-evidence contract already exists
(`policyRuntimeEvidenceProjection.mjs`) that maps live evidence into bounded
buckets (identity, compatibility, constraint, profile, RAG, history, routing,
freshness) with demotion logic, fingerprints, and trace validation. The
reducer's output shape is structurally and semantically distinct from that
runtime-evidence model; promoting it would create a competing, lower-fidelity
runtime-evidence path without adding capability.

The resolution is enforced by a regression-tested contract that:

- scans the server source graph to prove the reducer is imported only by
  declared migration-parity consumers,
- rejects any runtime, authoring, or route importer,
- rejects any runtime-evidence projection import of the reducer, and
- validates that the runtime-evidence projection's actual top-level contract
  does not expose any migration comparison field, and
- binds the reducer's deletion to the same exit criteria as the verifier chain.

Migration comparison fields and historical samples must not enter normal
runtime or authoring responses.

## Evidence Reducer Role

The reducer is a pure, side-effect-free projection of an accepted rebuild
proposal. Its only consumers are:

| Consumer | Role | Side-effect profile |
| --- | --- | --- |
| `policyMigrationRepresentativeClassificationSource.mjs` | Attaches the generated-intent outcome to each representative classification for comparison. | Bounded read (migration only) |
| `policyMigrationVerifierRollback.mjs` | Provides the default comparison baseline for the rollback verifier. | None (pure comparison) |

Neither consumer is reachable from ordinary policy authoring, runtime
classification, learning, routing, provider, or scheduler paths.

## Runtime Evidence Contract Already Exists

`policyRuntimeEvidenceProjection.mjs` is the authoritative runtime-evidence
contract. It:

- maps seven evidence sources (library profile, operator intent, history, RAG,
  metadata, routing, profile freshness) into bounded evidence buckets,
- applies demotion logic for broad genres, low-trust RAG, unknown libraries,
  stale profiles, and unproven routing,
- produces a stable sanitized fingerprint and trace attributes,
- validates that no raw payloads, live lookups, or UI-chip language leak into
  evidence entries, and
- records an operator-intent boundary context with projection-fingerprint
  binding.

The migration reducer does not perform any of these functions. Its output
shape is a flat comparison record, not a bucketed, demoted, fingerprinted
evidence projection. Promoting it would duplicate authority without adding
safety or capability.

## Official Guidance Reviewed

- [OWASP API9:2023 Improper Inventory Management](https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/)
  requires an explicit retirement plan for every retained API version or
  endpoint and warns against undocumented data flows. The resolution binds the
  reducer to the verifier chain's exit criteria so no migration-only artifact
  lingers without a deletion gate.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends deny-by-default authorization and least privilege. The resolution
  contract default-denies every importer except the two declared
  migration-parity consumers.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends treating cross-trust-zone data as untrusted and retaining only
  necessary, protected event data. The reducer output is a compact comparison
  shape with no raw samples, provider payloads, prompts, or embeddings.
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  and the [NIST Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
  emphasize governance, traceability, and risk controls. Keeping the migration
  reducer separate from runtime evidence preserves a clean traceability
  boundary between migration verification and live classification.

## Options Considered

### 1. Promote the reducer into the runtime-evidence contract

Pros:

- Removes one migration-only file once merged.
- Gives runtime paths direct access to a proposal-derived outcome shape.

Cons:

- The runtime-evidence projection already exists with a richer, bucketed,
  fingerprinted, demotion-aware model; the reducer's flat comparison shape
  would compete with it, not enhance it.
- Blurs the boundary between migration verification and live classification,
  violating the roadmap rule that migration comparison fields must not enter
  normal runtime responses.
- Requires runtime consumers to understand migration proposal shapes, widening
  the trust surface for a temporary comparison helper.
- Risks historical samples or migration semantics leaking into authoring or
  learning paths.

### 2. Delete the reducer immediately

Pros:

- Smallest attack surface and least maintenance.
- Removes all migration-reducer terminology from live code.

Cons:

- Removes the comparison baseline currently used by the rollback verifier and
  representative classification source while migration cutover is still active.
- Weakens the parity evidence chain needed before Phase 8R cutover completes.
- Is premature: the task is explicitly gated on Phase 8R migration parity,
  which has not been proven.

### 3. Retain as migration-only with a hard deletion binding and source-graph audit

Pros:

- Preserves the single comparison shape required by active cutover verification.
- Keeps migration comparison fields out of runtime, authoring, route, learning,
  provider, and scheduler paths.
- Provides an explicit, regression-tested deletion gate tied to the verifier
  chain exit criteria.
- Is simple to test without adding public infrastructure.
- Follows the same deny-by-default source-topology audit pattern proven in
  5R.8.1 and 5R.8.2.

Cons:

- Maintains a small amount of migration-only code until Phase 8R completes.
- Requires discipline to keep the reducer internal and prevent it from
  becoming a general runtime helper.

### 4. Move the reducer into a separate worker with isolated credentials

Pros:

- Strong process and credential isolation.

Cons:

- Adds deployment, queue, retry, and credential complexity for a 30-line pure
  projection with no side effects.
- Is disproportionate until the reducer is proven to be a permanent runtime
  capability, which this resolution explicitly rejects.

## Final Recommendation Stack

1. Retain `policyMigrationGeneratedIntentOutcome.mjs` as a migration-only,
   side-effect-free pure projection. Do not promote it into the
   runtime-evidence contract.
2. Bind its deletion to the verifier chain exit criteria: Phase 8R migration
   parity, native-storage cutover completion, rollback retention expiry, and no
   active rebuild binding.
3. Enforce a deny-by-default source-graph audit: only the two declared
   migration-parity consumers may import the reducer. Every other importer,
   including any route, runtime, authoring, learning, provider, or scheduler
   path, fails the audit.
4. Reject a runtime-evidence import of the reducer and fail when the actual
   runtime-evidence top-level contract exposes a migration comparison field.
5. Run the resolution audit in regression coverage so the reducer cannot be
   silently promoted or leaked into a non-migration path.
6. Reassess only after Phase 8R migration parity is proven; at that point the
   reducer is deleted with the verifier chain under 5R.8.4, not promoted.

## Implementation Outcome

`server/src/services/policyMigrationGeneratedIntentOutcomeResolution.mjs`
owns the resolution contract. It defines the formal decision, the allowed
migration-parity importers, the prohibited importer categories, the verifier
chain deletion binding, and a pure resolution-contract validator. It performs
no read, write, routing, learning, provider, or scheduler operation.

The resolution audit and migration-verification boundary audit share the
internal `policyMigrationStaticSourceInventory.mjs` scanner. The resolution
audit proves the reducer is imported only by its declared migration-parity
consumers. It fails closed for missing expected importers, unexpected
importers, route importers, runtime-evidence-projection importers, and any
migration comparison field exposed by the actual top-level runtime-evidence
projection contract.

Focused regression tests cover the clean current-state audit, a missing
expected importer, an unexpected non-migration importer, a route importer, a
runtime-evidence-projection importer reference, an unsafe promotion flag, a
broken deletion binding, and a malformed resolution contract version.

## Security Outcome

- The migration reducer cannot be imported by any runtime, authoring, route,
  learning, provider, or scheduler path without failing the resolution audit.
- The runtime-evidence projection cannot import the reducer, and its actual
  top-level contract cannot expose migration comparison fields.
- The reducer has an explicit, tested deletion gate tied to the verifier chain.
- No migration comparison fields or historical samples enter normal runtime or
  authoring responses.

## Next Task

The verifier deletion gate and server-authority test reset are complete. The
next remaining high-value work is **4R.1 Live Entry-Path And Action Inventory**
rendered-path verification: exercise each normal authoring state in the live
browser and reconcile the results with the already-complete source inventory.
