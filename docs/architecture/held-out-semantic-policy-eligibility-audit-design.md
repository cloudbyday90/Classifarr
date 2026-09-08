# Held-out semantic policy eligibility audit design

Status: Implemented, unreleased. Research checked 7 September 2026 against
the linked primary sources.

## Problem

The prospective held-out semantic cohort correctly samples before semantic
retrieval and fails closed when it cannot obtain 24–32 ready comparisons. Its
first real frame contained 384 records, all `not_pending_policy_decision`.
That status alone could mean automatic classification, manual abstention, a
missing policy, or an insufficient candidate set. Changing thresholds, using
semantic evidence to find cases, or asking an operator to hand-pick examples
would make the evaluation less trustworthy.

The platform needs a repeatable, content-free way to answer whether the
current canonical inventory contains any broad-policy comparison that could
enter the study.

## Decision

Add a private, ESM-only `study:audit:held-out-policy-eligibility` command and
modular services that inspect at most 8,000 canonical identities. The current
population is below that cap. The audit evaluates only the same restricted
broad-policy preparation already used by cohort selection, then retains just
aggregate counts.

```text
canonical current inventory, excluding source conflicts
  -> deterministic media metadata in process memory only
  -> no authority/history/profile/pattern signals and empty RAG cache
  -> fixed action × ranked-candidate-count diagnostic
  -> aggregate contract and stratum counts
  -> configuration-drift check
  -> complete | candidate_source_truncated | configuration_changed | failed
```

The audit has no HTTP route, provider call, semantic retrieval, database
write, policy update, routing decision, fixture, snapshot, label, or readiness
authority. It accepts no command-line input. PostgreSQL is opened with
`default_transaction_read_only=on`, normal and file logging are suppressed,
and the command returns no title, identity, library, policy, score, rule,
metadata, model, vector, prompt, or semantic result.

The source reader detects a population larger than 8,000 by requesting one
additional row. A truncated result cannot be used to claim that no eligible
case exists. The audit also fingerprints embedding configuration and active
policies before and after evaluation; a changed configuration returns no
summary.

`heldOutSemanticStudyEligibilityDiagnostics.mjs` reduces every decision to
two fixed values: action (`auto_classify`, `manual`, `prompt_confirm`,
`prompt_select`, or `unknown`) and ranked candidate count (`none`, `one`, or
`two_or_more`). The audit keeps only their aggregate Cartesian count. This
explains availability without turning internal evidence into another source of
authority.

## Research basis

NIST AI RMF Measure calls for documented, repeatable testing and evaluation,
including the test set, metrics, tools, conditions, and independent review
where appropriate. A complete policy-only audit separates the question of
cohort availability from semantic performance and any later human study.
[NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)

W3C Data on the Web Best Practices recommends provenance, quality information,
versioning, and an explanation when data is unavailable. The bounded status,
configuration-drift result, source-cap result, and versioned aggregate summary
make an unavailable study population explicit without publishing the library.
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

OWASP recommends clear trust boundaries, pre-retrieval constraints, output
validation, and fail-closed behavior for RAG systems. The audit uses no
semantic retrieval and does not let retrieved content, a model, or a study
tool modify policy or routing.
[OWASP RAG Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)

The private command's read-only connection and parameterized canonical query
follow PostgreSQL's transaction model. They do not turn the live library into
an immutable dataset; the configuration and source-cap checks state that
limit explicitly.
[PostgreSQL Transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html)

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Retry random 24–32-case cohorts | Small implementation change | Can repeatedly miss rare policy matches and cannot distinguish why eligibility failed | Reject |
| Lower thresholds or force pending decisions | May manufacture cases quickly | Changes the system under evaluation and risks policy/routing regression | Reject |
| Use semantic retrieval to choose candidates | May find apparently interesting cases | The signal being evaluated chooses the sample | Reject |
| Bounded full-population policy-only audit | Measures actual availability, preserves the study boundary, and minimizes retained data | Scans current inventory and may still report that no cohort exists | Adopt |

## Final recommendation stack

1. Run the private audit before attempting another held-out cohort capture.
2. If it finds no ready comparisons, perform a separately reviewed native
   policy-intent coverage design. Validate signal/metadata semantics and
   intended overlap; do not merely lower decision thresholds.
3. If it finds sufficient ready comparisons in every stratum, select the
   cohort from that policy-only eligible population before any semantic lookup.
4. Collect independent blinded labels and run the existing readiness and
   frozen-study preflight against a complete bundle.
5. Only a qualifying measured profile can justify a later review-only
   counter-evidence proposal. Automatic routing remains out of scope.

## Non-goals

- This audit does not alter policy intent, thresholds, libraries, media, or
  classifications.
- It does not establish semantic accuracy or replace independent human labels.
- It does not relax source-conflict exclusion, cohort size, stratum balance,
  readiness, or frozen-study preflight.
