# Retained destination decisions: design

Status: Unreleased, September 24, 2026. See the separate
[outcome document](correction-destination-decisions-outcome.md) for verification.

## Problem and scope

The completed 300-case retrieval comparison has no correction labels. Increasing
its size cannot measure decision quality. The existing candidate capture favors
the policy shortlist, not necessarily the saved destination. Queue witnesses only
cover queued work and disappear with queue/history cleanup. Retained correction
outcomes survive cleanup but currently lose the original classifier decision.

Preserve the actual saved decision automatically, then join it to the existing
explicit correction event. Do not add another approval, dashboard, training job,
model call, or routing authority. Movie and TV libraries remain name-agnostic;
music is excluded. No release or local container replacement is part of this work.

## Contract

- Build a small versioned projection when classification history is first saved:
  typed TMDB identity, allowlisted method, saved status and saved library ID.
  Do not copy caller-supplied captures or replace it with the policy leader.
- Pending review and retry decisions have no final destination. Source-library
  observations and manual decisions are recorded as non-classifier context.
- In the existing correction transaction, retain the validated projection and
  exact classification ID with the correction snapshot. Retention remains 30
  days, including read-time expiry and existing bounded cleanup. No new foreign
  key to mutable history or queue records.
- Missing, malformed, mismatched, or historical context stays unknown. No legacy
  reconstruction from the current destination or a corrected status.
- Extend the private evaluator with `--saved-decisions`: one bounded read-only
  snapshot, no model/configuration dependency, aggregate output only. Deduplicate
  repeated corrections of the same classification; conflicting labels or captures
  are excluded rather than selecting a favorable outcome. Inactive/type-changed
  destinations remain excluded, even when other labels for that decision exist.
- Separate completed-decision agreement/disagreement, review deferrals, retries,
  non-classifier records, missing context, conflicts and unavailable destinations.
  Report movie/TV strata. Rates describe only the explicitly corrected cohort;
  they are not overall accuracy, automatic-routing safety or filesystem success.
  A row-budget overflow fails the report rather than publishing partial rates.

## Official research and tradeoffs

Sources discovered and checked online on September 24, 2026:

- [W3C PROV-DM Recommendation](https://www.w3.org/TR/2013/REC-prov-dm-20130430/)
  distinguishes generated entities and their derivation. Keep original decisions
  separate from subsequent corrections; do not infer provenance from mutable state.
  This applies provenance principles, not a claim of PROV serialization compliance.
- [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/playbook/measure/)
  calls for documented measurement limitations and evaluation of operator feedback.
  Correction-only observations are selection-biased; do not present them as a
  representative accuracy estimate or generate positive labels from silence.
- [PostgreSQL 18 RETURNING](https://www.postgresql.org/docs/18/dml-returning.html)
  supports obtaining the exact inserted event. Reuse the existing data-modifying
  CTE and caller-owned transaction so event and retained evidence commit together.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Extend existing correction snapshots | Small, automatic, cleanup-safe, exact event linkage | Prospective coverage; biased cohort | Implement |
| Reuse queue witnesses alone | Already immutable | Queue-only; cascading deletion loses context | Keep for queue diagnostics |
| Reconstruct from current history | Immediately produces numbers | Corrections/retries contaminate the baseline | Reject |
| Store all raw model evidence forever | Rich debugging detail | Privacy, cost and retention exposure | Reject |

Recommendation stack: original saved decision → atomic retained correction →
bounded read-only attribution → largest observed failure → one paired regression
experiment. Keep existing retrieval evaluation for stage-specific evidence. Add
representative positive outcome coverage before making whole-platform quality
claims; the absence of corrections is not evidence of correctness.

## Security and compatibility

Use ESM pure projection/measurement modules and a small database reader. Allowlist
fields and values; retain no title, library name, actor, prompt, token, or provider
response. SQL is fixed and parameterized. No new dependency, public endpoint, UI
or SWR cache is needed. The additive nullable column accepts existing snapshots;
the old application can still write rows without context. Fresh-install schema
and migration must agree. Test rollback, cleanup durability, repeat/conflict
handling, identity changes, deferrals, music exclusion and content-free output.
