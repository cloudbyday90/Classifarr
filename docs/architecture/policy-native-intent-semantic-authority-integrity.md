# Policy Native Intent Semantic Authority Integrity

Status: implemented on 2026-07-16.

## Problem

The original native-intent reconciliation error was fixed separately as a
no-work outcome: an empty unconverted-policy inventory must not try to execute
a missing conversion workflow. That repair did not address a more serious data
condition found while investigating the failure.

Earlier reconciliation runs could leave an active `policy_intents` header with
`source = empty`, `inference_state = empty`, and no purpose rules. The prior
authority check treated exactly one active header as converted. Runtime then
suppressed compatibility behavior despite having no materialized native policy.

An active-header uniqueness constraint controls row count; it cannot prove that
the remaining row is semantically usable.

## Research

PostgreSQL documents partial indexes and unique constraints as structural
integrity controls. They are appropriate for preventing duplicate active
headers, but semantic multi-table state needs a further transaction-aware
constraint. PostgreSQL constraint triggers support deferred validation, which
lets the native header and its required purpose rule be written atomically.

- [PostgreSQL: Partial Indexes](https://www.postgresql.org/docs/16/indexes-partial.html)
- [PostgreSQL: Unique Indexes](https://www.postgresql.org/docs/17/indexes-unique.html)
- [PostgreSQL: Explicit Locking](https://www.postgresql.org/docs/17/explicit-locking.html)
- [PostgreSQL: Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)

OWASP ASVS and NIST SSDF support fail-safe validation, least exposure in
operational telemetry, and evidence that enables remediation without retaining
sensitive or unnecessary application data.

- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
- [NIST SP 800-218: Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)

## Options

1. Keep the single-active-header rule and patch only the scheduler exception.
   This preserves the empty-row runtime failure and permits future incomplete
   headers to claim authority.
2. Validate only in application code. This improves normal writes but leaves
   migrations, maintenance tooling, restores, and direct database access able
   to commit invalid active data.
3. Define shared semantic eligibility, enforce it in the database at commit,
   repair only exact historical shapes, and preserve compatibility behavior for
   non-authoritative rows.

## Decision

Use option 3.

An active intent is authoritative only when all of the following are true:

- its source is `native_intent`;
- its inference state is `inferred`;
- validation is `valid` or `warning`; and
- at least one persisted rule has role `purpose`.

`policyNativeIntentAuthorityEligibility.mjs` owns that rule for server reads,
reconciliation selection, dry-run detection, and write-gate materialization.
A single active row that fails it is explicitly non-authoritative. The runtime
uses compatibility behavior with a bounded authority state; duplicate active
rows remain a fail-closed conflict.

The migration applies only two safe historical repairs:

- a fully materialized `legacy_presets` header is normalized to
  `native_intent`; or
- an exact empty header with no child rules is deactivated.

All other active invalid shapes stop the migration. That is deliberate: the
system must not manufacture an operator's policy intent.

The migration then adds a header check and a deferred constraint trigger across
`policy_intents` and `policy_intent_rules`. The deferred trigger allows the
normal header-plus-rule transaction, but rejects a transaction that would
commit an active intent without purpose.

## Tradeoffs

**Shared eligibility and deferred database enforcement**

- Pros: one definition across all boundaries; protects migrations and restores;
  keeps legacy behavior intact when a native intent is incomplete; prevents
  future invalid commits.
- Cons: adds a purpose-rule existence query to authority checks and a deferred
  trigger to writes. Both are scoped by the existing intent ID and occur only
  at policy conversion or mutation boundaries.

**Failing migration for unknown active shapes**

- Pros: no inferred policy behavior, no silent loss of automation, and a clear
  maintainer remediation point.
- Cons: an upgrade can require data repair before proceeding when historical
  state is neither complete nor exactly empty.

**Compatibility fallback for one incomplete row**

- Pros: preserves the actual policy while it remains unconverted and avoids a
  false native cutover.
- Cons: an operational trace reports a non-authoritative state until the row
  is repaired or converted correctly.

## Security And Operational Outcome

- Repair events include only a fixed action ID and bounded reason; they never
  contain legacy JSON, prompts, provider data, credentials, or stack traces.
- The migration locks the two related tables before evaluating repair state,
  preventing concurrent authority changes from racing the invariant setup.
- Candidate and reconciliation outcomes classify non-materializable contracts
  as maintenance. They are not marked converted and cannot trigger a manual
  conversion dialog.
- Runtime compatibility fallback applies only to one non-authoritative row.
  Multiple active rows stay blocked rather than choosing an arbitrary policy.

## Verification

- Unit tests cover each semantic eligibility outcome, SQL predicate safety,
  native loader behavior, compatibility fallback, candidate classification,
  reconciliation state mapping, and write-gate refusal.
- PostgreSQL integration tests cover safe empty-header deactivation with a
  bounded event, a valid header-plus-purpose transaction, and rejection of an
  active purpose-less intent at deferred constraint evaluation.
- The repository migration checker and fresh container schema dump verify the
  migration can be applied and represented in the canonical schema snapshot.

## Final Recommendation Stack

1. Keep the shared semantic eligibility service as the sole definition of
   native authority.
2. Retain the database header check and deferred purpose-rule trigger as the
   final commit-time safeguard.
3. Repair only exact, provable historical states and fail closed for every
   other active shape.
4. Keep scheduler-owned reconciliation automatic and represent unresolved
   data as bounded maintenance, not conversion success or manual workflow.
