# Prospective purpose correction cohort design

Date: 2026-10-29. Status: Q1–Q4 scope implemented and locally verified. Follows the
[declared-purpose outcome](declared-purpose-evidence-outcome.md). The separate
[investigation outcome](prospective-purpose-correction-cohort-outcome.md) records
verified facts and checks.

## Problem and design decisions

Current v2 cards distinguish declaration provenance and actual declared-subset
matching, but their durable diagnostic is mutable History metadata. That is a
presentation boundary, not a frozen prospective statistical label. Legacy
correction signal snapshots and attribution deliberately remain v1 heuristics.

The immutable `policy_evaluation.v1` child preserves the evaluated pool, ranking,
aggregate purpose provenance and runtime admission. Its closed schema contains
no declared-match or specialized-purpose proof. Neither current policy settings,
eligibility/count flags nor a current card can supply that missing historical
fact.

The user confirmed Q1 comparison meaning: use the
retained leading policy candidate as the purpose reference and compare the
operator's explicit destination choice against it. Keep original automated
destination comparisons and each command's confirmation/change reference
separate. A policy leader can differ from the eventual automated destination.
Agreement is not accuracy; disagreement is not an error label or causal proof.

The user also confirmed Q2–Q4: existing explicit-choice sources, a v2 immutable
source capture and atomic outcome supplement, and a separate bounded private
aggregate CLI. Legacy statistics, inventory cohorts, routing and learning remain
unchanged. No receipt producers, public API/UI, provider calls or jobs are added.

## Verified source boundaries

- Live purpose evidence is minted synchronously from validated native authority,
  typed identity and the declared subset using existing scoring semantics. A
  private WeakMap receipt authenticates the live object; valid-looking JSON alone
  cannot restore that receipt.
- `policyEngineEvaluation` records the immutable policy child before specialized
  identity refinement. Freezing the new proof requires both the original native
  match and the actual later specialization state, with explicit gaps for paths
  that never reach refinement.
- Policy captures bind an exact History ID, typed identity, held live result and
  retained ranking. Retry creates a different History ID. Identity-only joins
  would attach a later retry to the wrong original evaluation.
- The existing child is first-write-wins, payload-capped at 64 candidates / 64 KiB,
  expires after thirty days, retains tombstones, cascades only with History, and
  is excluded from portable configuration backups. Persistence is best-effort
  after classification; evidence failure cannot roll classification back.
- Authorized outcome snapshots freeze exact action/identity/destination/context
  in the effects transaction. Replay returns before capture. Runtime tier aliases
  share a canonical event key and cannot create extra votes.
- The capture hook permits authorized outcome-only decisions, but not every
  successful no-learning pending answer currently produces an authorized receipt.
  Existing runtime verification commands require admitted learning. This cohort
  must not silently create command/learning authority to fill that coverage gap.
- Explicit History review uses a separate atomic feedback transaction and v3
  snapshot referenced to the original automated destination. Older selection-only
  requests do not prove an explicit confirmation/change command.

## Proposed storage and lifecycle

The implementation extends the existing live immutable policy child with a new payload
version, through small proof projection/validation modules. Keep v1 readable as
missing match evidence. The database accepts both versions and keeps DEFAULT 1
for older writers; the new writer explicitly inserts version 2. Readers validate
the matching header/payload version. No in-place upgrade or filling of rows.

Minting must remain live-only, with identity, contract and retained-ranking checks.
Do not copy raw rules, prompts, library names, actors or arbitrary card JSON.
Unrefined, incompatible, missing or overflow evidence must retain closed gap
states instead of implying support. No ranking or scoring change is proposed.

At a new eligible outcome commit, a separately versioned association freezes
the available original policy reference plus verified purpose categories, or a
closed reason why that evidence was unavailable then. Evidence inserted later
must not turn a missing-at-commit record into a positive label. Same-event tier
aliases and replay must not replace, refresh or improve the original association.

The protected supplement has real foreign keys to History and exactly one
authorized/feedback source receipt. Its canonical event key prevents tier aliases
from filling an earlier gap. A later alias of an older event without a supplement
records `legacy_event`, not newly available proof. Source or History deletion
cascades operational supplements; direct deletion/truncation is blocked. FK
cascades also permit the existing authorized runtime-reset/receipt fixture path.

The available reference is at most 4 KiB and contains fixed purpose categories,
the retained policy/library IDs, numeric score and original capture lease. No
full 64-KiB payload is copied. Expiry is the earlier of source expiry and the
outcome's thirty-day window. It clears the payload and copied identity, choice
and action fields; a minimal immutable event/source tombstone blocks refilling.
Gaps expire their copied label fields after thirty days as well. Pruning uses
the existing maintenance pass with `LIMIT 1000 FOR UPDATE SKIP LOCKED`.

The agreed Q3 boundary uses v2 of the existing policy child and a separate
event-bound outcome supplement. The supplement records a small purpose reference
or missing-at-commit reason in the eligible outcome transaction. Keep the original
64-candidate / 64-KiB capture caps, expiry-only payload removal and replay guards;
do not introduce a second source-capture table or a new retention job. Portable
configuration backups continue to exclude operational evidence.

## Cohorts and reader boundary

The existing private disagreement report is an experimental inventory-ranking
cohort. Its source requires a ranking shadow; its eligibility requires the chosen
destination to be inside that experimental candidate set. Adding purpose fields
there unmodified would measure only that subset, not all retained policy choices.

The first reader is a separate explicit private CLI cohort mode, with a
distinct protocol and denominator. Reuse coherent read-only repeatable-read
transactions, cancellation, fixed thirty-day windows, database-side row/payload
admission and bounded output. Keep existing inventory aggregate/disagreement
results identical.

Agreed Q2 sources are new successful explicit choices represented by existing
authorized outcome receipts and explicit History feedback reviews. Preserve
their distinct action-reference meanings. Do not add receipt producers for the
no-learning pending population that currently lacks them; that population is
unassessed rather than silently counted as zero gaps.

Agreed Q4 limits are a fixed thirty-day window, 5,000 events / 64 MiB of admitted
input and 1 MiB of aggregate-only output. Report source/action-reference,
confirmation/change, purpose-origin/match and evidence-gap breakdowns. Do not
print item/library IDs, titles, names, hashes, actors or raw snapshots in this
aggregate mode. Whole-cohort event alias/conflict validation and chronological
item holdouts precede counting. No inventory-shadow eligibility is imported.

Run `node server/src/scripts/runInventoryOutcomeCalibration.mjs --prospective-purpose`
explicitly against the intended local database. The mode rejects all other
options, uses a cancellable UTC read-only/repeatable-read transaction, and enforces
12-second statement / 15-second transaction deadlines. Database admission
precedes transfer. Canonical-event conflicts include unavailable destinations;
connected classification/typed-identity aliases reserve the earliest event even
when its evidence is missing. Output distinguishes first-item gap counts from
all-event observed gap counts, which include holdouts. Agreement with the policy
leader does not redefine a correction as confirmation. A chosen destination
outside the captured policy pool can disagree without being silently excluded.
Canonical source timestamps retain microsecond ordering, with exact numeric
classification/source ID tie-breaks. Tier copies with contradictory frozen
decision contexts remain conflicting even when their selected destination agrees.
`sourceRows` and `aliases` describe admitted variants after database tier-alias
deduplication, not a count of every physical receipt.

Implementation is split across `purposeOutcomeReference`, `purposeOutcomePersistence`,
`purposeOutcomeCohortRepository`, `purposeOutcomeObservations`,
`purposeOutcomeCohortReport` and `purposeOutcomeCohortRead`. Shared legacy
snapshot/attribution and inventory eligibility services are unchanged.

Preserve explicit action meaning and source context rather than deriving kind
from agreement with the policy leader. Separate confirmations and changes,
including reference-kind differences. Exclude automatic events, failed/unresolved
outcomes and legacy selection-only requests from scored comparisons. Preserve
missing/unknown/expired/conflicting evidence and unavailable targets explicitly;
later favorable receipts cannot hide them. Deduplicate canonical event aliases
before caps and reserve conservative chronological item holdouts before sampling.

No public API/UI, scheduled report, provider call, historical import, automatic
promotion or generalized learning is proposed. Legacy v1 statistics,
representative review and calibration remain separate and unchanged.

## Alternatives and tradeoffs

| Option | Pros | Cons / risk | Recommendation |
| --- | --- | --- | --- |
| New live immutable policy capture version | Extends established identity/retention boundary | Requires synchronized schema and strict readers | Implemented |
| Separate companion purpose capture | Leaves v1 contract untouched | Duplicates lifecycle/admission and requires exact cross-capture binding | Alternative |
| Freeze current card JSON at outcome time | Easy initial coverage | Cannot establish original immutable evaluation proof | Reject |
| Recompute from today's policies | More apparent coverage | Reconstructs history and can introduce outcome leakage | Reject |
| Policy leader as purpose reference | Measures the retained policy decision directly | Differs from final AI/routing and some action references | Agreed Q1 |
| Original automated destination only | Aligns with explicit History assessment | May have no corresponding policy candidate; misses policy leader disagreement | Separate existing meaning |
| Existing inventory report subset | Reuses eligibility unchanged | Cannot represent a general policy-purpose population | Only with explicit subset naming |
| Separate private purpose cohort | Honest protocol and denominator | New bounded source/reader contract | Implemented |
| Mix new evidence into v1 support buckets | Fewer consumers to change | Relabels legacy metrics and review corpora | Reject |

Final stack: live verified match → immutable versioned policy capture →
exact commit-time association → canonical event deduplication and conservative
holdouts → separately named action/reference cohorts → bounded private report.
All comparison, source, lifecycle and reader choices were explicitly agreed.

## Official research checked October 29, 2026

Sources were discovered/read through MCP. The applications below are engineering
inferences, not conformance or certification claims.

- [W3C PROV constraints](https://www.w3.org/TR/prov-constraints/) distinguishes
  generation, use, derivation, invalidation, uniqueness and event ordering.
  Bind an assessment to evidence that existed for the referenced evaluation;
  later reconstruction cannot supply an earlier missing fact.
- [PostgreSQL consistency guidance](https://www.postgresql.org/docs/current/applevel-consistency.html)
  explains consistency boundaries and explicit locking where non-serializable
  writes exist. Preserve the established transactional command locks and use a
  coherent read-only snapshot for multi-source reports.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  discusses source verification, forged/replayed event data and sensitive data.
  Use exact source receipts and closed projections; avoid raw content/actors in
  retained or printed cohort evidence.
- [NIST AI RMF core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  documents measurement methods, limitations, context, privacy and bias.
  Keep suggestion-biased confirmations separate and describe what the cohort
  cannot establish. No classifier-accuracy rate follows from operator agreement.

## Planned verification and delivery

Test live proof origin/binding and stage refinement, both immutable versions,
first-write/replay/expiry tombstones, commit-time missing evidence, canonical
alias conflicts, source/action/reference distinctions, temporal bounds, retries,
whole-cohort admission and unchanged legacy/experimental outputs. Exercise real
PostgreSQL constraints, concurrent expiry and transaction rollback. Run applicable
coverage, types, lint, ownership and repository gates before commit/push on main.
No release or deployment is part of this batch.
