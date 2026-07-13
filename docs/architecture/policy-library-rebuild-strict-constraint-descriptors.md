# Policy Library Rebuild Strict-Constraint Descriptors

## Status

Implemented on 2026-07-13 as Task 7R.7.3. Rebuild proposals can now preserve a
deliberately authored strict constraint as a versioned structured descriptor
and translate it directly into a native hard-limit rule. A label alone remains
non-executable and is rejected by replacement.

## Problem

The policy builder and native policy contract already represent strict
constraints with a signal type, operator, values, constraint mode, and
semantics. The rebuild evidence path previously retained only a display signal,
such as `PG-13 maximum`. That label cannot establish whether the rule means a
maximum, an inclusion list, an exclusion list, a numeric range, or a runtime
range. Reconstructing it during replacement could tighten, loosen, or invert
live behavior.

## Research

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side syntactic and semantic validation, including
  allowlists for fixed values.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends keeping workflow state and security-sensitive decisions
  server-owned rather than trusting a presentation-derived interpretation.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  recommends validating request data before it reaches application logic.
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
  supports the existing replacement gate's transaction and row-locking design;
  the descriptor changes rule construction, not its transaction authority.

## Options Considered

### Infer a native rule from a label or signal key

Pros:

- Requires no new structured field.
- Can appear to migrate more policies automatically.

Cons:

- A label cannot express an operator, complete values, or semantics.
- Key prefixes cannot distinguish maximum, inclusion, exclusion, and range
  behavior.
- A guessed rule can silently alter a live policy.

### Preserve arbitrary policy configuration objects

Pros:

- Fewer initial transformations.

Cons:

- Passes UI metadata and unsupported fields into a rebuild authority path.
- Creates a second, loosely validated rules language.
- Does not prove the configuration is executable by the strict evaluator.

### Use a versioned, allowlisted strict-constraint descriptor

Pros:

- Preserves the exact executable signal type, operator, values, constraint
  mode, and semantics.
- Allows the server to validate a small native-rule subset before every
  handoff.
- Keeps display labels separate from rule authority.
- Reuses the existing native policy contract and replacement transaction.

Cons:

- Legacy label-only hard limits remain blocked until intentionally authored in
  structured form.
- Each supported runtime constraint shape needs explicit validation.

## Final Recommendation Stack

1. Carry `strictConstraint` only on explicit hard-limit signals. The
   descriptor is versioned as `policy.strict_constraint_descriptor.v1` and
   contains `signal_type`, `operator`, `values`, `constraint_mode`, and
   `semantics`.
2. Require plain own-data objects, bounded values, fixed descriptor fields, and
   explicit operator/value compatibility. Reject unknown fields, accessor
   values, label-derived values, unsupported signal types, and invalid ranges.
3. Support only strict evaluator semantics: list constraints, media-type
   inclusion/exclusion, certification include/exclude/maximum, numeric ranges,
   and runtime ranges.
4. Preserve the canonical descriptor through rebuild input sanitization,
   evidence projection, descriptor-aware deduplication, and the intent draft.
5. Convert only a validated descriptor into a native `hard_limits` rule at the
   existing transaction-gated replacement boundary. Keep a missing descriptor
   fail-closed.

## Implementation

- Descriptor contract and native-rule conversion:
  `server/src/services/policyStrictConstraintDescriptor.mjs`
- Sanitized rebuild-input preservation:
  `server/src/services/policyLibraryRebuildInputContract.mjs`
- Evidence and intent propagation:
  `server/src/services/policyEvidenceEntryNormalizer.mjs`,
  `server/src/services/policyEvidenceEngine.mjs`,
  `server/src/services/policyEvidenceEntryIdentity.mjs`, and
  `server/src/services/policyIntentEngine.mjs`
- Replacement conversion:
  `server/src/services/policyLibraryRebuildReplacementContract.mjs`

## Security Boundaries

- `strictConstraint` is not inferred from labels, keys, or UI text.
- The descriptor accepts no presentation fields and never receives raw provider
  payloads, prompts, embeddings, quota state, or preview diagnostics.
- Input validation requires plain own-data records and bounded arrays before a
  descriptor reaches evidence or intent construction.
- Descriptor-aware identity preserves two different hard limits even when they
  share a display signal key.
- The existing replacement gate still revalidates the accepted transition,
  verifier report, snapshot, active intent, and transaction state before it
  writes a native rule.

## Verification

- `policyStrictConstraintDescriptor.test.mjs` covers canonical certification,
  list, and numeric range descriptors plus invalid labels, fields, and
  operator/value combinations.
- `policyLibraryRebuildInputContract.test.mjs` verifies descriptor preservation
  and malformed-descriptor rejection at the rebuild boundary.
- `policyLibraryPolicyRebuild.test.mjs` verifies propagation through bounded
  evidence into the intent draft.
- `policyLibraryRebuildReplacementContract.test.mjs` verifies exact native
  hard-limit conversion, malformed descriptor rejection, and the retained
  label-only fail-closed behavior.

## Next Component

Proceed with Task 7R.8: runtime metrics and decision trace. It should consume
the existing bounded runtime and rebuild outcomes without introducing new
policy-authoring or replacement behavior.
