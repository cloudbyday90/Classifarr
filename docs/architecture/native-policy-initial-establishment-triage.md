# Native Policy Initial-Establishment Triage

## Status

Implemented as Phase 8R.3.2.10.1. This component classifies an unconverted
policy with no legacy preset configuration as an initial-establishment case,
separate from a malformed or incomplete legacy configuration. It does not
create, activate, alter, or infer native policy intent.

## Problem

Automatic reconciliation previously placed two materially different states in
the same `no_convertible_intent` bucket:

- a legacy configuration exists but cannot safely produce a native purpose
  rule; and
- no legacy configuration exists at all.

The first is a migration remediation problem. The second is an initial policy
establishment problem. Treating both as failed conversion hides the actual
work, causes misleading maintenance evidence, and tempts the system to promote
observed library contents into durable intent.

## Official-Source Research

Official sources reviewed in July 2026:

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-side workflow state and explicit business-rule validation.
  Classification therefore owns the distinction server-side rather than
  trusting a UI choice or a client-generated status.
- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  recommends a final server-side authorization check and a sequential workflow
  for consequential changes. The triage result cannot authorize a native
  intent write or route by itself.
- [PostgreSQL: SET TRANSACTION](https://www.postgresql.org/docs/current/sql-set-transaction.html)
  documents read-only transaction behavior. The candidate report remains a
  dry-run classification with no policy mutation.
- [PostgreSQL: Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html)
  documents the transaction scope of row-level locks. A later establishment
  transition must revalidate current policy authority under its own write
  transaction; it cannot reuse this report as authorization.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  calls for risk-driven secure design and verification. Regression tests cover
  the classification boundary and reject unsafe report tampering.

## Options Considered

### Keep `no_convertible_intent` for Every Empty Contract

Pros:

- No contract change.
- Smallest immediate implementation.

Cons:

- Conflates absent migration input with malformed legacy input.
- Makes the reconciliation inventory less actionable.
- Encourages unsafe automatic inference to clear a misleading blocker.

### Infer Intent from Library Profile Genres

Pros:

- Could make an empty policy appear configured without an additional step.
- Uses information the media server already supplies.

Cons:

- A distribution is observed application evidence, not a declaration of future
  routing intent.
- Generic or mixed libraries have no stable identity in their top genres.
- Violates the existing authority vocabulary and can silently route future
  media based on incidental historical contents.

### Recommended: Dedicated, Non-Writing Establishment Triage

Pros:

- Makes the outstanding maintenance state truthful and bounded.
- Preserves automatic conversion for policies that have valid legacy intent.
- Prevents library observations, metadata, or AI suggestions from creating
  durable authority without an intentional later transition.
- Requires no schema migration because reconciliation status and reason fields
  already use constrained stable identifiers.

Cons:

- Empty destinations remain unresolved until a permitted establishment source
  and transition are implemented.
- Compatibility deletion remains correctly blocked while those policies need
  establishment.

## Implemented Design

### Candidate Boundary

`policyIntentMigrationCandidateReport.mjs` now emits
`requires_initial_policy_establishment` only when all of the following are
true:

1. The policy has zero attached legacy presets.
2. Its compatibility contract has `source: empty` and `inference_state: empty`.
3. Materialization reports `empty_intent_contract`.
4. Active native-authority conflict and contract-validation blockers have
   already been ruled out by their higher-precedence checks.

The report includes only a bounded legacy-configuration summary:
`empty_legacy_configuration` and `attachedPresetCount: 0`. It does not expose
presets, library items, profile values, prompts, AI output, or raw legacy JSON.

### Reconciliation Outcome

The reconciliation state contract maps the dedicated candidate status to
`requires_maintenance` with the same stable reason ID. It is never selected as
a conversion candidate and cannot consume the bounded ready conversion batch.
Its candidate fingerprint changes from the old broad status, allowing the
state inventory to correct itself on the next scheduler evaluation.

### Audit Invariants

The read-only report validator rejects:

- a missing or malformed legacy-configuration summary;
- an initial-establishment status without an empty configuration and dedicated
  reason; and
- a valid empty configuration that has been downgraded to another conversion
  status without an active-authority blocker.

## Security And Edge Cases

| Risk | Control |
| --- | --- |
| Profile distribution becomes durable policy intent | The classifier reads preset attachment presence only; profile evidence is not an input. |
| Client changes the status to bypass workflow | Candidate status and reconciliation outcome are generated and validated server-side. |
| Stale dry-run authorizes a later write | This component has no write path; any later establishment flow must lock and revalidate current authority. |
| Malformed legacy policy is hidden as empty | Any attached preset, partial inference, unsupported shape, or validation failure preserves the established blocker path. |
| Raw legacy or media data leaks through status | Output is limited to stable IDs and an integer attachment count. |

## Verification

- Candidate-report tests prove empty policies receive the dedicated status and
  configured purpose-less policies remain `no_convertible_intent`.
- Audit tests reject a downgraded empty candidate.
- Reconciliation-state tests prove initial-establishment policies become
  maintenance outcomes and cannot displace ready conversion work.
- Focused ESLint and Jest suites verify the server ESM contracts.

## Result

Classifarr now describes empty legacy destinations accurately without treating
them as failed conversions or creating intent from historical media contents.
The remaining work is an explicit, separately authorized initial-establishment
transition, not a broader conversion retry.
