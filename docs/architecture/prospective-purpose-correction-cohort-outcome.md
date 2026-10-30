# Prospective purpose correction cohort outcome

Date: 2026-10-29. Status: agreed Q1–Q4 batch implemented and locally verified.
See the separate
[design, official research and tradeoffs](prospective-purpose-correction-cohort-design.md).

## Agreement and findings

Work started clean on main at `a450c4d5f9c6cad4e8c6c8bb35e0153b4ceff38a`.
The repository grilling workflow used independent read-only source/consumer
investigations. The user confirmed the policy leader as the purpose reference,
existing explicit-choice sources, immutable v2 capture plus atomic supplement,
and a separate bounded aggregate-only private CLI cohort.

Investigation found that current card proof is mutable History presentation
metadata. The immutable policy child v1 preserves aggregate provenance and
runtime admission but lacks declared-match and final specialization proof.
Copying current cards or recomputing current rules cannot fill that history.
Legacy correction buckets feed statistics, representative review and calibration;
changing their meaning under v1 would silently relabel measurements.

Existing authorized outcome snapshots and explicit History reviews prove action
meaning but have different references. Some no-learning pending outcomes produce
no canonical receipt. The old disagreement reader is an experimental inventory
subset, so its denominator cannot silently become a general policy-purpose cohort.

These facts identify measurement gaps, not the cause of a reported wrong library.
Existing media placement is not an independent correct label.

## Implemented outcome

- Live immutable `policy_evaluation.v2` retains authentic minted purpose proof
  and the later actual specialization state. JSON copies and contract drift leave
  gaps. Scores, rankings, authority and admission remain unchanged. Existing v1
  captures remain readable without acquiring match proof.
- The schema accepts v1/v2 and preserves DEFAULT 1 for older writers. The new
  writer explicitly inserts version 2; no old row is upgraded or refilled.
- Existing successful authorized receipt transactions and explicit History review
  transactions freeze a small purpose reference or an explicit commit-time gap.
  New `policy_purpose_outcome_supplements` records have real source/History FKs,
  an immutable canonical event key and protected expiry/tombstone transitions.
- Canonical tier aliases cannot add votes or improve a prior gap. A later tier
  for an older event without a supplement records `legacy_event`. Failed,
  unresolved, automatic and selection-only events do not enter comparisons.
- Payload expiry cannot extend the source capture's lease. Maintenance removes
  the purpose payload and copied identity/destination/action fields, including
  expired gap labels, while keeping a minimal replay tombstone. The existing
  maintenance pass prunes at most 1,000 rows with SKIP LOCKED. Source/History
  deletion cascades operational evidence; direct deletion/truncation is blocked.
- `--prospective-purpose` adds a separate aggregate-only private CLI protocol,
  source reader and denominator. It uses a fixed thirty-day UTC read-only,
  repeatable-read snapshot with cancellation, timeouts and database-side admission.
  Limits are 5,000 input events / 64 MiB and 1 MiB of aggregate output.
- Whole-cohort alias/conflict validation precedes connected chronological item
  holdouts and counting. First missing/expired/conflicting evidence reserves the
  item before favorable retries. Confirmation/change and source/action-reference
  meanings stay separate. First-item gap counts and all-event observed gaps have
  explicit scopes. No item IDs, names, hashes, raw snapshots or actors are printed.

Legacy statistics, representative review, calibration, inventory cohort results,
routing and learning authority are unchanged. No provider call, receipt producer,
public API/UI, scheduled report or historical backfill was added. Uncovered
no-receipt populations remain explicitly unassessed. Operator agreement is not
classifier accuracy and disagreement does not establish a causal defect.

## Verification

The unchanged focused baseline passed six suites / 113 tests. Focused contracts,
code-health and retention checks passed ten suites / 37,187 tests. Real PostgreSQL
integration passed five suites / 54 tests, including existing authorized outcomes,
History review and private disagreement readers.

Database checks cover outcome-only choices, policy versus original-destination
meaning, explicit History reviews, runtime aliases, unavailable contradictory
destinations, legacy-event gaps, late source writes, exact replay, rollback,
expiry label removal, tombstone non-rehydration, source/History cascades and backup
exclusion. Existing feedback concurrent-command/recovery tests remain intact.
Final proof/cohort contracts passed five suites / 105 tests. Additional cases
cover contradictory frozen contexts, microsecond chronology, exact numeric source
ties and NULL-safe receipt-type binding. Client coverage passed 481 files /
7,457 tests with 87.84% statements, 81.95% branches, 87.58% functions and 89.53%
lines. The rerun used two workers after a concurrent run hit the existing lint
initialization deadline; no assertion or timeout configuration was weakened.

256 main-baseline capture comparisons matched after removing only the new proof
field and version: retained numbers, rankings, authority, admission and gaps were
unchanged. An isolated, network-disabled PostgreSQL 18 container applied the
migration, generated the authoritative snapshot and reproduced it in a second
fresh database with identical dump output. The task-owned container was removed
after verification; optional pg_stat_statements behavior was preserved.

Both Knip modes, server types/lint, static imports, ESM mock-shape checks, four
policy gates, copyright, migration naming/snapshot integrity, Markdown and the
reviewed ownership gate passed. Only five changed/new ownership entries were
reviewed; existing unresolved debt and production-compatibility limits remain.

Full backend coverage passed 1,896 suites / 61,348 tests with one existing skipped
test: 89.19% statements/lines, 86.55% branches and 90.70% functions. The combined
coverage ratchet passed without changing its baseline. Staged whitespace and
Gitleaks checks passed; final documentation was checked again before delivery.

## PR, dependencies and delivery

GitHub MCP found no open PRs in `cloudbyday90/Classifarr`, including Dependabot.
No random PR was applicable and no stale Dependabot PR required rebasing. No PR
was merged or modified. Dependency manifests/locks are unchanged. The existing
low-severity `deepmerge` development-dependency follow-up remains open; this batch
does not close that advisory or establish release readiness.

Unreleased records the new measurement boundary. Delivery is directly on main,
with no release, tag, deployment, live data mutation or historical import.

## Next recommended item

The separately agreed private view is now implemented; see its
[design](prospective-purpose-case-view-design.md) and
[outcome](prospective-purpose-case-view-outcome.md). The following recommendation
records the transition from this aggregate-only batch.

Inspect the first aggregate's source distribution and gaps after an authorized
deployment. Then add a separately agreed bounded, opt-in private case view for
this purpose cohort, using frozen classification/library IDs and exact source
references. The existing disagreement report covers only the inventory experiment.

Benefit: identify one evidenced policy-ranking or later AI/routing defect rather
than guessing from an aggregate disagreement. Cost: an additional private-output
contract and display limits. Preserve legacy gaps and suggestion-bias limitations;
do not change weights or promote existing media placements into labels.
