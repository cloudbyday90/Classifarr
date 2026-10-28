# Feedback selection provenance outcome

Date: 2026-10-28. Status: agreed scope implemented and locally validated.
The [design](feedback-selection-provenance-design.md) records the agreed boundary.

## Established facts

The starting tree is clean on `main` at
`83d8980857907a2190e76965ac903c6bee6c6550`. The GitHub MCP query returns no open
PRs, including Dependabot; no random candidate or stale PR is applicable.

Independent read-only fact finding confirmed two production feedback intakes,
shared transactional receipt capture, one receipt per classification, stable
replay/retention guards and the absence of explicit confirm/change request fields.
Current shortlist references are not served-reference receipts or original saved
classifier destinations. Existing v1 feedback has no frozen action/reference.

The confirmed first batch freezes truthful selection provenance and exposes a
separate selection-only diagnostic. It preserves the previous agreement against
inventing action kinds or historical labels. The design contains the source
research, alternatives, pros/cons, safeguards, verification and recommendation
stack. Investigation used no production database operation, provider request,
PR mutation, release or deployment.

The existing focused baseline passed five suites / 75 tests before implementation.

## Implementation

`feedbackSelectionSnapshot.mjs` owns strict v2 capture, parsing and independent
receipt binding. Both production writers reach it through their existing shared
receipt writer and transaction, before prompt history mutation. A small neutral
BIGINT helper is shared with the existing prospective ID API, preserving exact
int64 text without widening the old optional decision-context contract.

The additive migration freezes receipt identity, intake, fingerprint, clock and
feedback association. Snapshot UPDATE permits only identical data or clearing;
cleared evidence and FK tombstones cannot be rehydrated through UPDATE. Existing
thirty-day pruning, request fingerprints and replay checks are preserved. The
fresh-install schema was regenerated and reproduced against a disposable fixture.
Historical rows were not converted into v2 evidence.

Both frozen readers validate v2 classification/intake binding. The prospective
adapter retains selection aliases, availability and contradictions while marking
the action ineligible for its confirmation/change cohorts. Audit v2 adds the
overlapping `selectionOnlyRows` reason; capture exclusions retain their disjoint
accounting. Server/client reject old audit v1 reports; the worker recomputes them.
The protected status GET, polling, freshness and disclosure behavior are unchanged.

Existing raw feedback correction flags, policy statistics, retrospective calibration
and saved-decision overall selection agreement retain their prior semantics. New
provenance does not claim what a browser displayed, validate reference-library
availability at commit, repair historical action evidence, or establish accuracy.

## Verification

Focused backend tests passed ten suites / 151 cases, including old audit rejection
and original-context binding. Six PostgreSQL suites / 83 tests passed, covering the existing writers,
transaction rollback, concurrent replay, expiry, history cleanup, exact BIGINT
binding, immutable receipts, FK tombstones and prospective exclusions. Clock
fixtures now create receipts at a chosen instant instead of disabling the new
runtime UPDATE guard.

Focused client tests passed three files / 23 tests. Full client coverage passed
478 files / 7,400 tests: statements 87.81%, branches 81.86%, functions 87.57%,
lines 89.50%. The Chromium Evaluation
progress check passed the distinct reason label, keyboard disclosure, mobile
reflow, focus retention, failed-response clearing and access loss. Lint, types,
both Knip dependency checks, schema reproduction, all four production-policy
audits, ESM imports/mock-shape checks and inventory ownership review passed. All
eight production route/asset checks passed. Markdown lint checked 2,382 documents;
copyright checked 1,815 files. Desktop/mobile layout and the new diagnostic were
inspected. Independent reader and receipt reviews found no further defect. Existing
unresolved writer debt remains visible; the ownership gate does not establish
production writer authorization.

Full backend coverage passed 1,889 suites / 60,875 tests, with one skipped, in
953.694 seconds: statements/lines 89.21%, branches 86.51%, functions 90.78%.
The coverage ratchet passed against both fresh reports without changing its
baseline. Staged redacted secret and whitespace checks passed. Ignored private
and intermediate receipts are excluded. The disposable schema fixture was removed;
unrelated existing worktrees were preserved.

GitHub MCP was rechecked after implementation and still returned no open PRs,
including Dependabot. No random PR could be selected or stale PR rebased. No
dependency manifest changed; existing Unreleased security follow-ups remain.

No production database operation, live provider request, historical import, new branch, PR merge,
release or deployment was performed. All implementation work stays on `main`.

## Delivery

Implementation, migration/schema, tests, Unreleased and design/outcome documentation
were committed and pushed on `main` as
[b09bb380dc474563de0d6b9701ec0189821a0b03](https://github.com/cloudbyday90/Classifarr/commit/b09bb380dc474563de0d6b9701ec0189821a0b03).
GitHub MCP verified the canonical commit URL. Remote main matched the commit and
the working tree was clean. Verification used pinned Node 24.22.1 and npm 12.2.1;
no global tooling upgrade was made. Final Markdown lint passed 2,382 documents;
final staged redacted secret and whitespace checks passed. This receipt-only
follow-up changes no tested application source.

GitHub's push notice still reports one low dependency alert. Dependency manifests
are unchanged and no advisory closure is claimed; existing Unreleased security
follow-ups and next-release holds remain. Hosted CI after push is separate from
the local evidence above. No release or deployment was performed.

## Next boundary

The [History feedback review outcome](feedback-served-reference-outcome.md)
implements the next explicit action/reference boundary. Existing selection-only
requests remain selections; their action cannot be inferred through library
equality. The next investigation is a bounded cohort-specific disagreement report
before ranking or learning changes.
