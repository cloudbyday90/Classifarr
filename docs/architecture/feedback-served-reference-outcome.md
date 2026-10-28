# Explicit feedback and served-reference outcome

Date: 2026-10-28. Status: implementation complete and locally verified.
The [design](feedback-served-reference-design.md) records current facts, official
research, alternatives, pros/cons and the final recommendation stack.

## Baseline and findings

The starting tree is clean on `main` at
`fecf0acb7e917ba11d9bdd92ad0410570d6d9397`. GitHub MCP currently returns no open
PRs, including Dependabot; no random candidate or stale PR is applicable.

Independent read-only tracing confirmed that legacy feedback/prompt API leaves
have no current production UI caller. Actual pending resolution already has an
explicit action contract and separate routing/learning effects. History correction
has another canonical owner and performs an actual correction. Neither is a safe
shortcut for a new feedback assessment.

The runtime fingerprint provides optimistic concurrency, not an actor-bound
issuance receipt. Existing durable identity-review preparation and receipt-recovery
patterns supply reusable lifecycle ideas. Their authorization policy must be
considered separately; a History projection must not widen private history access.

The first product choice is confirmed: a feedback-only History assessment records
existing feedback/statistics effects without moving media or adding policy rules.
The preserved original automated destination and the full safeguards are confirmed.

## Implemented outcome

History now opens a separate feedback review of the preserved original automated
destination. Fresh preparation, active administrator checks, ten-minute durable
references, locked stale-state validation and atomic consumption precede one
existing feedback/statistics transaction and receipt. The UI names the current
outcome separately and never uses the stale History row as its action reference.
No media movement, reclassification, policy rule or additional learning authority
was added.

New v3 snapshots preserve explicit confirmation/change evidence and independent
receipt bindings for the existing prospective readers. Legacy selections remain
v2; unknown legacy actions stay holdouts. Existing retrospective feedback flags
remain relative to the commit-time shortlist, while v3 action meaning is relative
to the original automated decision. These measures answer different questions.

The implementation separates contracts, projection, repository, consumption,
maintenance, frozen evidence, shared legacy writer effects and client state/UI.
The migration extends one-way receipt protection; evidence expiry can clear a
snapshot and feedback deletion can leave a tombstone without removing scoped
receipt recovery. Restore invalidates prepared references in its transaction.

Review caught and fixed uncertain-command loss after an unauthorized retry or
another administrator's conflict. Both cases preserve the original command for
receipt recovery. The strict reader also rejects contradictory non-automated
decision context. The expiry fixture now preserves the new immutable receipt
bindings instead of accidentally removing them during synthetic reinsertion.

## Verification

The unchanged focused baseline passed five backend suites / 89 tests before
implementation. Focused PostgreSQL/HTTP, contract, client state and mounted
component tests cover the new boundaries. Real Chromium tests cover History entry,
keyboard/focus, mobile layout and lost-response recovery with exactly two intended
writes: preparation and submission.

| Check | Local result |
| --- | --- |
| New PostgreSQL/HTTP workflow | 12 tests passed; active/read-only access, stale library/policy, expiry/reissue, concurrency, caps, rollback, legacy competition, immutable/tombstoned receipts |
| Related PostgreSQL regressions | 12 suites / 221 tests passed, including the new workflow, legacy statistics/eligibility, prospective readers and backup/restore |
| Client final full coverage | 481 files / 7,440 tests passed; statements 87.84%, branches 81.92%, functions 87.57%, lines 89.52% |
| New real History browser flow | Two Chromium cases passed; original/current labels, explicit payload, keyboard/focus, mobile reflow and reload receipt recovery |
| Production browser assets | Build and eight cold-route/navigation checks passed |
| Backend full coverage | 1,890 suites; 60,992 tests passed, one existing skip; statements/lines 89.17%, branches 86.52%, functions 90.67% |
| Types and lint | Server/client types, full lint and final changed-file lint passed |
| Dependency usage / ESM | Standard/production Knip, static imports and test mock-shape gates passed |
| Storage / source gates | Migration naming, reproducible schema, reviewed ownership drift, four production policy gates and copyright passed |
| Documents / secrets | Markdown: 2,384 files, zero errors; staged redacted secret and whitespace checks passed |
| Final coverage ratchet | Both scopes passed against the unchanged baseline |

The initial full backend attempt caught a fixed lock-clause annotation on the wrong
line for the SQL code-health guard. The explanatory comment was moved without
changing SQL behavior; the focused guard passed 36,747 checks before restarting
the clean full coverage run. The coverage baseline was not changed.

Final UI review found that the existing History title entry only opened by mouse.
It now uses a native labeled button. Focused tests and real keyboard entry passed,
then full client coverage, client types/lint and the production build/eight browser
checks were repeated against that final source. Verification used pinned Node
24.22.1 and npm 12.2.1 without a global tooling upgrade. Backend full coverage
excludes the separately executed PostgreSQL integration suites listed above.

The schema was generated from the committed snapshot plus the migration in an
owned, disposable PostgreSQL 18 / pgvector 0.8.7 container and reproduced unchanged.
Only synthetic local fixtures were used; no production database or provider was
accessed. GitHub MCP was checked again after implementation: no open PRs,
including Dependabot, were available to select or rebase. Dependency manifests
remain unchanged; existing Unreleased security holds are retained.

## Using the review

Once this code is installed, open History and use an item's title button to open
its details, then choose **Review library feedback**. Preparation must find a
preserved, completed automated decision with matching typed identity. Unsupported
or changed sources, missing evidence and existing final receipts remain unavailable.

Read the original automated destination and current outcome separately. Select a
policy under either confirmation or a different destination, then use that action's
explicit feedback button. This records an assessment and existing statistics;
the correction command elsewhere in History has different effects.

If the result is uncertain, use the same active administrator account to check
the receipt or retry the same stored command. Closing or reloading does not cancel
a possible commit. The UI retains minimal recovery IDs in this tab's session
storage, and warns if storage is unavailable. An unverified lookup is not proof
that the submission failed.

## Next item

Add a bounded, read-only disagreement report for frozen prospective cohorts:
original decision, explicit assessment, ranked alternatives and available declared
purpose/intent evidence. Keep confirmations separate from destination changes and
selection-only observations. Use the report to identify the first repeatable
ranking/intent failure before changing scoring or learning. Missing historical
evidence and current library membership must not become inferred labels.

This change builds the evidence collection path; it does not establish that the
original misclassification or underlying ranking behavior is fixed.
