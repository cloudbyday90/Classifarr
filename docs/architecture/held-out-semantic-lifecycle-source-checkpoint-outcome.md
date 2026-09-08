# Held-out semantic lifecycle source checkpoint outcome

Status: implemented on 2026-09-08. See the separate
[design](held-out-semantic-lifecycle-source-checkpoint-design.md) for research,
options, and the recommendation stack.

## Outcome

The lifecycle re-audit now records each changed aggregate source separately
from its audit receipt. A temporary loss of complete declared-purpose evidence
therefore changes the source checkpoint even though it deliberately runs no
audit. When the same aggregate eligible state returns, it differs from that
checkpoint and the existing private audit runs again.

The new ESM persistence module stores only a fixed source digest, count-only
source receipt, and observed time in a one-row table. The prior audit-state
table still records only actual audit receipts and their bounded failure state.
Both tables exclude policy, library, configuration, provider, actor, rule, and
media identity.

Focused tests cover zero lifecycle evidence, deferred incomplete purpose
evidence, unchanged completed and failed states, bounded failure retries, and
the regression sequence of complete evidence, incomplete evidence, then the
same complete evidence returning. The regression asserts that the returned
state performs an audit with a fresh attempt budget.

## Boundaries preserved

The source checkpoint cannot select, capture, or label a cohort; execute
readiness or frozen-study preflight; retrieve semantic evidence; call AI;
change policy or configuration; or route media. A deferred source writes no
audit receipt and does not query the candidate population.

## Next item

Allow ordinary policy authoring to create real current declared-purpose and
lifecycle evidence. The passive checkpoint will then trigger one bounded audit
without operational input. Only a resulting complete 24–32-case cohort may
move to independent labels, readiness, and frozen-study preflight; any later
semantic ambiguity remains review-only.
