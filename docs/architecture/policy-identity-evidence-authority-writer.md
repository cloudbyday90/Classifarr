# Policy Identity Evidence Authority Writer

## Status

Implemented as Phase 6R.3.3e.3. The writer creates an append-only runtime
admission only after a command-authorized manual outcome matches independent
identity authority. It is deliberately not yet called by the generic
transaction executor: Phase 6R.3.3e.4 must atomically compose the admitted
evidence mutation with the profile-refresh outbox row.

## Problem

A manual answer proves the destination selected for one classified item. It
does not, by itself, prove what a library means. Treating it as durable
identity would turn one-off corrections, client-visible labels, or stale
screens into broad automation policy.

Identity admission therefore has a stricter invariant than compatibility
evidence: a locked, authorized outcome may reinforce identity only when an
independent authority already verifies the same canonical signal for the same
library. It must not change `policy_intents`, `policy_intent_rules`, routing,
provider quota, or profile state.

## Official Guidance Reviewed

Official sources were reviewed on July 26, 2026 against the requested June
2026 baseline:

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-derived security-relevant state, explicit state
  transitions, and tests for the business invariant rather than only the happy
  path.
- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  requires the final authorization control and transaction data protection at
  execution time, not from client-controlled state.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends deny-by-default and permission validation on every request.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  distinguishes semantic, server-side validation from presentation-only input
  checks.
- [PostgreSQL INSERT](https://www.postgresql.org/docs/18/sql-insert.html)
  documents `ON CONFLICT DO NOTHING` as the no-update alternative for a unique
  conflict, which preserves the first immutable source-event admission.

## Design

```text
canonical intake + learning guard + locked final destination
  -> rebuild authorized persistence command
  -> canonical identity candidate
  -> lock/read active native purpose rule
  -> independently match affirmative declared identity
  -> append-only identity admission keyed by source event
  -> later: same transaction evidence mutation + refresh outbox
```

The implementation separates responsibilities:

- `policyIdentityEvidenceAuthorityRepository.mjs` reads active native purpose
  rules through the caller-owned transaction. It takes a shared row lock and
  accepts only valid or warning, inferred `native_intent` authority for the
  locked library.
- `policyIdentityEvidenceAuthorityResolver.mjs` canonicalizes eligible
  `genres`, `keywords`, `studios`, and `media_type` candidates. It matches only
  the affirmative array named by the native rule operator (`require_all`,
  `require_any`, `prefer`, or `include`). Zero matches and competing active
  intent versions fail closed.
- `policyIdentityEvidenceAdmissionRecord.mjs` reruns the authorized-command
  audit, binds the candidate to the locked classification and library, rejects
  unsupported sources and media types, and produces a compact record with no
  destination label, answer text, AI output, provider payload, or route data.
- `policyIdentityEvidenceAdmissionRepository.mjs` owns the parameterized,
  append-only insert. A unique `(source_id, source_event_id)` conflict returns
  the first record for an exact workflow replay; no update path exists.
- `policyIdentityEvidenceAuthorityWriter.mjs` composes those modules with a
  caller-owned transaction client.

The `policy_identity_evidence_admissions` table is runtime audit and
idempotency state, not user configuration. It is excluded from configuration
backup and can be deleted only by a transaction-local, guarded replace
restore. Database checks restrict its authority shape:

- declared authority must carry the native policy, intent, and version;
- observed authority must carry a SHA-256 fingerprint and cannot carry native
  policy identifiers; and
- only `operator_declared_intent` or `media_server_contents` can be recorded.

## Authority Boundary

The current default resolver admits only active, server-stored declared native
purpose rules. This is the production path because it has a durable, locked
authority reference.

The writer also defines a narrow extension contract for a future
server-qualified observed identity projection. It requires a canonical key and
signal, the same library, current profile freshness, a server `verified` flag,
and a SHA-256 projection fingerprint. Raw library-profile distributions,
metadata enrichment, AI output, manual outcome data, labels, and client claims
are not observed authority. No current adapter promotes those inputs into this
contract.

This keeps the manual outcome causal but not authoritative: it can be admitted
only as a corroborated event and cannot create or replace declared intent.

## Options Considered

### Promote Every Eligible Manual Outcome to Native Purpose

Pros: shortest path to visible automation changes.

Cons: one correction could redefine a destination, bypass explicit intent
editing, and collapse final-outcome and policy-authority boundaries. Rejected.

### Store Identity Alongside Compatibility Evidence

Pros: reuse the existing canonical evidence table.

Cons: compatibility evidence intentionally accepts manual-outcome provenance
at fixed supporting confidence. It cannot prove independent destination
identity, and combining the paths would weaken the authority model. Rejected.

### Treat Raw Library Distributions as Observed Identity

Pros: uses already available profile information.

Cons: distributions are observational suggestions and may be stale, noisy, or
ambiguous. They lack a per-admission qualified projection reference. Rejected.

### Append an Admission Only After Independent Authority Matches

Pros: preserves manual-outcome correlation, server-side semantic validation,
transactional locking, append-only auditability, and a clear future outbox
composition point.

Cons: does not yet create a refresh request or alter runtime policy behavior.
Selected.

## Final Recommendation Stack

1. Rebuild the authorized command from canonical intake, revalidated actor
   authority, and transaction-locked state.
2. Canonicalize the identity candidate and allow only bounded identity-capable
   signal types.
3. Require exactly one active declared native purpose match by default.
4. Permit future observed authority only through a server-qualified current
   projection with a stable fingerprint; never from raw distributions.
5. Persist a compact, append-only admission with source-event uniqueness.
6. Keep admissions separate from native intent, compatibility evidence, and
   route changes.
7. In Phase 6R.3.3e.4, commit the admitted evidence mutation and refresh
   outbox row in the same transaction; do not activate the writer earlier.

## Verification

Focused tests cover declared authority matching, zero and ambiguous matches,
exclusion and unrelated-value rejection, canonical command context, locked
state binding, declared and observed authority shape validation, immutable
source-event replay, transaction-client enforcement, backup-restore guard
ordering, and migration constraints.

## Next Step

Proceed to **Phase 6R.3.3e.4: Refresh Outbox Persistence**. It must compose
the supported evidence writer or this identity admission with the validated
refresh command in one transaction, keyed by the authorized source event.
