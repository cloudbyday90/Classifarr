# Replay-safe native purpose declaration validation outcome

Date: 2026-11-09 Eastern. Status: implemented and locally verified; push/CI receipts pending. See the separate [design](native-purpose-declaration-validation-design.md).
Baseline d0a2757b5; work remains on main. No release or deployment.

## Result and preserved boundaries

Fresh native purpose changes, initial establishment and native create/profile
admission now share the existing canonical positive capability. Checks occur
after exact receipt recovery and before first DML. Bulk planning keeps parseable
unsupported drafts in existing individual-review exceptions; application checks
the complete fresh plan before dispatching any child writer.

The small nativePurposeDeclarationCapability leaf delegates recognition to the
scorer's existing semantics and uses the update writer's existing normalization.
Initial/create checks inspect their existing materialized contract. Structural
parsers, command fingerprints, historical drafts and receipts are unchanged.
Every submitted purpose command is checked, including an unsupported command
before a later supported replacement. Unrelated edits still copy old purpose.

The advanced editor offers four positive choices. A saved exclusion retains its
actual value in a disabled legacy option until the operator changes it. Existing
form errors distinguish the fixed HTTP 400 validation refusal from uncertain
outcomes. The unchanged retry keeps its body and key; editing uses the existing
key lifecycle. Existing automatic transport retries remain unchanged.

Initial establishment still materializes purpose as identity, including requested
compatibility/null/omission; this batch deliberately preserves that existing
mapping. It does not infer historical proof, migrate negative purpose, change
numeric scoring, create authorization or prove classification accuracy.

## Observed verification

The new production-module red test first reproduced a fresh exclusion being
accepted. After the guard, focused service/HTTP controls pass: 8 suites / 104
tests. This includes every positive signal/operator/semantics pair, materialized
defaults, mixed-command refusal, fixed error redaction, old receipt recovery and
whole-plan validation before the first bulk child.

Three real PostgreSQL suites pass 21 tests. Unsupported initial materializations
and fresh changes perform no DML; rejected native create does not advance the
policy sequence. A seeded old exclusion receipt recovers after a genuine later
revision. Existing real contention, receipt-failure rollback, bulk atomicity and
lost acknowledgement controls pass. A lost initial COMMIT reply recovers through
its exact receipt without creating another establishment. Synthetic fixtures use
a real administrator foreign-key row; no application database is used.

Focused client controls pass 3 files / 16 tests, preserving legacy encoding,
visible saved values, actionable refusal and exact unchanged retry identity.
The final full client run passes 484 files / 7,539 tests. Two Chromium controls
verify the visible legacy choice, four fresh choices, fixed refusal, unchanged
retry identity and browser cookie/inert boundaries. The fresh production build
and eight production-browser cases also pass. Full backend coverage passes 1,931 suites / 62,720 tests, with one existing skip,
in 890.759 seconds. Two additional post-review HTTP/replay regressions then pass
in the final 104-test focused run; production source and installed inputs are
unchanged. Coverage is 89.28% statements/lines, 86.71% branches and 90.81%
functions. Both current coverage reports pass the unchanged ratchet; the new
capability leaf has 100% coverage. Lint, types, Knip, ownership, ESM, copyright,
dependency policy and repository policy gates pass. Delivery remains pending.

## Next recommendation

Decide the initial declaration semantics mapping independently: initial creation
currently forces identity while later purpose changes preserve compatibility.
Then remove remaining category-specific prompt assumptions and assess intentional
individual/bulk review in existing surfaces. Keep these behavior changes separate
from this replay-safe validation boundary and from security-alert triage.
