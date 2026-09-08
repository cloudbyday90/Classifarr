# Held-out semantic lifecycle source checkpoint design

Status: implemented on 2026-09-08. Research checked against the linked primary
sources on 2026-09-08.

## Problem

The passive lifecycle re-audit previously used its last audit receipt as the
source-change cursor. That cursor cannot represent an aggregate source state
that is ineligible for an audit. If complete declared-purpose evidence
temporarily became zero, the service correctly deferred the audit but retained
the prior eligible fingerprint. If the count later returned to the same value,
the service could mistake the restored state for the already audited state and
skip its required re-audit.

The correction must preserve the quiet deferment. It must not manufacture
purpose evidence, turn an inferred profile into declared purpose, start a
cohort, or require an operator action.

## Decision

Store an aggregate source checkpoint separately from the existing audit state.
The checkpoint contains a SHA-256 source fingerprint, the fixed count-only
source receipt, and its observation time. It has no audit status, attempt
count, candidate data, policy, library, configuration, provider, actor, rule,
or media identity.

Each changed source is checkpointed, including zero lifecycle or zero complete
purpose evidence. The scheduler still avoids the purpose-inventory query when
the lifecycle count is zero. It invokes the existing private eligibility audit
only when both counts are positive and either the source changed or the stored
audit state does not match the current source. A failed audit still has the
existing three-attempt budget; a changed source starts a fresh budget.

```text
aggregate source changes
  -> persist aggregate source checkpoint
  -> lifecycle and declared-purpose counts both positive?
       no  -> defer with no audit receipt or candidate read
       yes -> source differs from audit state?
                 yes -> run existing bounded private audit
                 no  -> retry only an in-budget failed audit
```

This restores correct state-transition observation without treating deferral as
measurement.

## Research basis

W3C Data on the Web Best Practices recommends provenance and version
information so data can be understood and trusted. The checkpoint keeps the
minimum versioned provenance needed to explain why a future measurement ran.
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

W3C PROV describes provenance in terms of entities, activities, and derived
artifacts. Separating an observed source from an audit result follows that
distinction: the checkpoint is an observation, while the audit receipt is its
separate derived artifact. [W3C PROV overview](https://www.w3.org/TR/prov-overview/)

NIST AI RMF Measure calls for documented approaches that regularly identify and
track risks in deployed contexts. The changed-source checkpoint makes the
measurement trigger reviewable without making a classification decision.
[NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)

OWASP recommends parameterized queries to separate data from SQL commands. The
new persistence module uses fixed SQL and placeholders for every value.
[OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep the audit receipt as the only cursor | No migration. | Cannot record an ineligible source transition, so a returned state can be skipped. | Reject |
| Write a `deferred` audit receipt | Uses one table. | Mixes an observation with a claimed measurement and weakens audit semantics. | Reject |
| Re-audit every time complete evidence returns | Recovers the missed transition. | Performs repeated private scans and loses an explicit provenance boundary. | Reject |
| Store a distinct aggregate source checkpoint | Records transitions, preserves the audit contract, and remains library-agnostic. | Adds one one-row table and a guarded write when the aggregate changes. | Adopt |

## Recommendation stack

1. Persist a changed count-only source before deciding whether it is eligible
   for measurement.
2. Keep the checkpoint and audit receipt in separate state contracts.
3. Run the existing audit only for positive lifecycle and complete-purpose
   counts; do not retrieve candidates during a deferred state.
4. Keep bounded failed-audit retries and reset that budget on a source change.
5. Continue to require a real independently labelled 24–32-case cohort,
   readiness, and frozen-study preflight before semantic work.
6. Permit semantic counter-evidence only after measured error is good; send
   ambiguity to review and never automatically route it.

## Non-goals

This change does not create declared purpose or lifecycle receipts, capture or
label a cohort, invoke readiness or preflight, retrieve semantic evidence, call
an AI provider, expose an endpoint, change policy or configuration, or route
media.
