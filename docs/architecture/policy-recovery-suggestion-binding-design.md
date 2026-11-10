# Policy recovery suggestion binding design

Research: November 10, 2026 Eastern. Baseline main
19c8680f608b0ebdaf974268d346eb49726dbc36. The operator confirmed policy-based
AI-unavailable recovery advice as the first consumer. This document proposes the
complete contract, confirmed by the operator before runtime implementation.
The [investigation](policy-signal-suggestion-binding-investigation.md) records
the observed boundary, alternatives and current PR assessment.

## Intended behavior

An existing policy recovery suggestion may survive only when a private live
reference binds it to the actual evaluation and the current request's loaded
library pool. Missing, copied, historical, offline/replay, malformed, changed or
over-budget evidence supplies no primary suggestion. The existing shared helper
then selects its existing retry or neutral-review branch.

Do not alter the confidence passed to that helper to reject a suggestion. In
particular, do not replace overall confidence with the first ranked score, and
do not zero confidence when proof is unavailable. Preserve the existing
transient-or-below-50 retry predicate, counters, maximum attempts and arguments.
Overall confidence and the leading score are distinct retained values.

The reference proves origin and consistency of loaded evidence. It does not
prove classification accuracy, a uniquely correct destination, a declared-purpose
match, or current database configuration after provider work. Existing ambiguity
and review-reference safeguards remain responsible for presentation and action.

## Private lifecycle and bounds

Use small ESM contract/producer/reader leaves. Keep the ordinary scoring-context
builder's return shape and normal consumers unchanged.

1. Create a private collector only in the production policy-engine wrapper, at
   entry for the exact item object. Use strict typed movie/TV identity and the
   existing positive database-ID limits. A matching public shape is not proof.
2. Observe the actually loaded, media-compatible candidate policies before their
   asynchronous evaluation and record each actual policy/evaluation pair. Freeze
   closed headers: policy/library IDs, media scope, enabled state, runtime source
   and status, and native revision where applicable. Check these headers again
   when recording and finishing; bind every retained ranked pair to an observed
   evaluation. Repeated policy/library pairs are invalid. Different policies may
   legitimately target the same library.
3. Accept validated active native authority with a positive native revision, or
   the existing explicit compatibility-bridge source/status. Keep those origins
   distinct; compatibility has no invented native revision. Missing, invalid,
   conflicting or unknown source headers provide no reference. Do not require a
   declared-purpose match or positive intent contribution for generic evaluated
   advice, and do not promote diagnostic captures into this authority.
4. After normal ranking and existing diagnostic producers finish, retain a
   private receipt against the exact final result. Freeze the complete ordered
   numeric ranking references, leading candidate, action, overall confidence and
   decision thresholds. Require a coherent leading policy/library/score across
   retained references; confidence need not equal the leading score. Names and
   pool order are not identities or selection rules.
5. At the policy owner, immediately after constructing its ordinary context,
   hold an opaque private handle for the exact result, item, context and selected
   loaded library. Before recovery advice, recheck typed identity, retained
   numeric references, context ranking/confidence/destination, and membership of
   that same selected library object in the supplied pool. Require a unique
   selected ID, explicit active state and compatible media type. Reject changed
   destination identity/scope/activity; do not repair or substitute another row.
6. Bound collection and revalidation to 64 compatible/evaluated/ranked candidates
   and 64 pool libraries. Bound the combined closed snapshot to 16 KiB. Validate
   complete bounded collections; do not truncate a ranking to make it fit. An
   overflow or collector failure removes only the new recovery suggestion proof.

Use WeakMaps and opaque in-process handles, without result fields, serialization
or persisted payloads. Do not retain full rules, item text, prompts or raw policy
contracts in the reference. Snapshot only the stated numeric/fixed-category
fields and necessary object references; release temporary policy references
after finish. This is not a deep immutability guarantee for every metadata or
configuration property. Later database edits and unobserved raw rule changes are
not assessed by these loaded headers. No extra database freshness read is added.
Process restart or serialization loses proof; it must never be reconstructed
from History, current configuration or equivalent IDs/hashes.

## Existing authority and failure boundaries

Apply the reader only in policy-path AI-failure recovery. Normal classify,
verify/adjudicate prompts, profile reads, the legacy signal calculator and shared
helper compatibility remain unchanged. Preserve valid AI proposals, policy auto
outcomes, numeric scoring, ranking, calibration, thresholds and source weights.

Preserve catch breadth, cancellation, stop, retry/admission/budget/ownership,
charged attempts, write receipts, exact replay and uncertain-operation handling.
No new provider call, retry layer, timeout, concurrency slot, cooldown or durable
state is needed. Provider recovery remains review-required; advice grants no
routing or learning permission. If no advice survives, use existing neutral
wording and selection controls. Valid independent review evidence remains subject
to its own existing safeguards. Do not rewrite historical records.

No new UI, endpoint, setting, schema, job, operator CLI trigger, capture version,
provider/log payload or live configuration write. Existing automatic recovery and
application controls remain the operator process. No release or deployment.

## Verification and delivery

Freeze regressions before implementation for unbound or mismatched recovery
suggestions. Exercise the production evaluator/owner, not a test-only authority
bypass. Cover native and compatibility sources, missing/invalid authority,
cross-item/copy/replay objects, mutation before and after asynchronous work,
duplicate pairs/library IDs, missing pool destinations, inactive/media mismatch,
64/65 and byte boundaries, and display-name/pool-order invariance.

Keep positive controls for genuine advice, conservative confidence zero with a
positive ranked score, confidence 49/50, differing confidence/score, transient
failure, unchanged retry arguments and normal prompt/profile consumers. Verify
the independent legacy calculator and existing diagnostic-capture gaps remain
independent of this new reference.

Use actual loopback provider HTTP and the production database factory against
isolated PostgreSQL for load/evaluation, provider failure, pending persistence,
explicit resolution, stale/inactive refusal and completed replay. Exercise
existing web/Discord neutral-choice and recovery route-safety controls. Tests
must not add provider permission, live writes or weaker assertions/deadlines.

Run fresh backend coverage and affected normal quality, audit, ownership,
Markdown and coverage-ratchet gates. Reuse client coverage/build evidence only
after verifying relevant source, installed graph and reports are unchanged;
otherwise regenerate it. Keep current findings and scanner/install policy.
Perform scoped artifact maintenance before heavy work and at handoff. Write a
separate outcome, update Unreleased, review the full diff, then commit/push all
agreed changes on main and inspect the exact source commit's CI.

Current random selection is the only open PR, 589. Its immutable candidate graph
is unchanged from the demonstrated failing compiler assessment. Retain that
settled deferral; do not reinstall it or manufacture an unrelated update. Recheck
open PR metadata at delivery and rebase only genuinely stale applicable branches.
Leave PRs unmerged.

## Recommendation stack and primary guidance

First qualify this recovery-only reference and unchanged retry behavior. Then
investigate normal prompt/profile suggestion provenance as a separate consumer
contract. A fresh-database check would be a separate availability/admission
decision; this batch makes no freshness promise.

The [investigation's alternatives](policy-signal-suggestion-binding-investigation.md#recommendations-and-alternatives)
compare structural checks, dedicated proof, diagnostic reuse and wider consumers.
The private reference gives explicit provenance with a small process-local
lifecycle; its cost is conservative neutral advice when proof is unavailable.

Official sources were identified and opened through MCP on November 10, 2026:

- [W3C PROV-DM](https://www.w3.org/TR/prov-dm/) distinguishes provenance,
  derivation and invalidation. Apply that distinction to loaded snapshots without
  claiming a PROV protocol implementation or current database validity.
- [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  supports default refusal and explicit permission checks. A suggestion receipt
  supplies advice evidence, never execution authority.
- [W3C headings and labels](https://w3c.github.io/wcag/understanding/headings-and-labels)
  supports accurate cues. Reuse the existing neutral selection wording and
  controls without a new panel or a full accessibility-conformance claim.
