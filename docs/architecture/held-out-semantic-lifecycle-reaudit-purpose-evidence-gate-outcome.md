# Held-out semantic lifecycle re-audit purpose-evidence gate outcome

Status: implemented on 2026-09-08. See the separate
[design](held-out-semantic-lifecycle-reaudit-purpose-evidence-gate-design.md)
for research, alternatives, and the recommendation stack.

## Outcome

The lifecycle re-audit now uses an ESM purpose-evidence adapter over the
existing policy-purpose evidence inventory. Its v2 source contains the complete
policy-evidence count alongside fixed lifecycle counts. A re-audit requires both
counts to be positive; a zero lifecycle count stops before the inventory query.
Otherwise it stops before candidate retrieval and leaves the durable cursor
unchanged.

This directly addresses the observed state: 6,641 candidate comparisons existed,
but zero policies retained declared purpose with complete lifecycle provenance.
The previous 28-case cohort attempt therefore stopped at
`insufficient_eligible_cases`. With the new preflight, a later receipt cannot
needlessly run that private audit while the same aggregate condition remains
zero.

## Boundaries preserved

Only aggregate counts cross the adapter. It includes no policy, library,
configuration, lifecycle receipt, provider, or media identity. It does not
promote inferred library-profile purpose, create evidence, or add a manual
trigger.

The change cannot capture or label a cohort, execute readiness or frozen-study
preflight, call AI, select semantic evidence, mutate policies, or route media.
The future semantic path remains review-only for ambiguity.

## Validation

Focused contract and service tests cover a positive qualified state, unchanged
state, bounded retry, absent lifecycle receipt, and normal lifecycle evidence
with zero complete declared-purpose evidence. The adapter test confirms that it
uses the established aggregate inventory query rather than a second query
contract, and that the query excludes names and rule values. Broader validation,
container build, and security review are recorded with this implementation.

## Next item

Passively observe for a policy whose current native intent retains declared
purpose and complete lifecycle provenance. When the re-audit then finds a
balanced 24–32-case eligible cohort, obtain two independent labels plus
adjudication where needed and run the existing readiness and frozen-study
preflight. Do not add semantic counter-evidence or automatic routing until the
measured error profile meets the established thresholds.
