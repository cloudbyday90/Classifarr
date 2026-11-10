# Unresolved generic advice outcome

Research and implementation: November 10, 2026 Eastern. Baseline main
071b38924e4e3f0356ef641f66fd4cb5cd246065. The operator confirmed the complete
[design](generic-classify-unresolved-advice-design.md) before implementation.
Work stays on main, without release, deployment or live configuration changes.

## Result and boundaries

The classify parser now returns no primary library for fresh invalid responses,
contract violations and valid CLARIFY responses. A pure result leaf retains
bounded known-library choices and existing diagnostic/default confidence rules.
Names, list position and ordinary signal-context objects cannot select that
primary destination or produce a deterministic-preference explanation. Partially
matched options remain choices, with deduplication and a four-choice limit.

JSON CLARIFY now selects verification by explicit mode, matching pipe CLARIFY.
An ordinary context object in classify mode no longer creates verify advice.
Successful proposals, strict verify/adjudicate, bounded repair/retries and
untagged legacy helper behavior remain separate and unchanged. The separate
AI-unavailable recovery fallback and stored historical advice are unchanged.

No new schema, API, UI, job, setting, provider call, authorization or learning
authority was added. Existing pending presentation handles a missing primary:
the operator chooses a destination, and server resolution validates the current
question and destination. A confirmation command records that explicit choice;
it does not prove that a previous AI prediction was correct.

## Verification

The new parser regression baseline failed 29 assertions before implementation,
with two positive controls passing. After implementation, the focused parser
and owner suites passed 247 tests. Five older classify assertions were updated
to require neutral advice; successful, strict-mode and legacy-helper controls
were preserved.

Real loopback Ollama/custom requests verify null primary advice for malformed,
out-of-set and JSON clarification responses with a known high-confidence hint,
one generation per request when repair is disabled, and unchanged route/learning
refusal. The combined parser, question and Discord checks passed 143 tests.

The production database factory connected only to a disposable PostgreSQL suite
database. All four unresolved response forms persisted NULL destinations and
completed only after explicit selection. Exact replay returned no routing
permission; changed receipts, stale questions and inactive destinations were
refused. PostgreSQL still rejected a completed classification without a library.
The new lifecycle and existing review-reference suites passed all eight tests.
An initial fixture cleanup omission caused duplicate-library test failures;
owned row cleanup corrected the fixture before the successful run.

Both browser scenarios passed, including keyboard selection from a real
server-produced unresolved contract. No mutation preceded explicit selection.
The existing narrow-width disagreement test initially consumed its unchanged
30-second deadline during cold Vite startup; the subsequent run passed both
scenarios in 7.3 seconds without changing timeouts or assertions. The separate
production asset suite passed all eight tests.

Server/client lint and type checks, both dependency-declaration modes, copyright,
ownership, npm-flag policy, four policy gates and static-import/mock-shape checks
passed. Development-inclusive npm audits report root/client zero findings and
the unchanged five server low findings in deepmerge/Jest's tooling chain. Both
installed package trees pass. No audit finding was hidden or reclassified.

All 7,426 non-Markdown tracked/untracked source inputs were frozen before fresh
coverage and checked unchanged afterward. Fresh backend coverage passed 1,939
suites: 63,015 tests passed and one skipped. Statements/lines are 89.30%, branches
86.75% and functions 90.84%.

The initial overlapping client coverage run passed 7,565 tests but timed out four
existing Vue subprocess controls. All seven controls passed separately with
their original limits. A subsequent separate full run passed all 488 files and
7,569 tests in 182.21 seconds, with unchanged assertions/deadlines. Client
statements are 87.92%, branches 82.17%, functions 87.70% and lines 89.60%.
The coverage ratchet passed with both current reports; all frozen inputs remain
unchanged. Failed preliminary receipts remain private and unqualified.

Scoped artifact maintenance reused the recent reviewed inventory and found no
newly verified stale removal candidate. Zero files/images were removed and no
application image was built. Current evidence, tools, worktrees, backups,
rollback/reference images, shared cache and other projects were preserved.
Disposable test containers were cleaned by their harness. Classifarr remained
running and healthy; no production service was restarted.

Local verification is complete. Exact-source CI is inspected after the main
commit is pushed and recorded in the delivery receipt below.

## Security, alternatives and follow-up

The design records official W3C provenance/labeling and OWASP authorization
guidance, with source links, applicability limits and a pros/cons comparison.
Neutral advice removes the demonstrated misleading heuristic using existing
controls. Its cost is an explicit operator choice when a primary is unknown;
it creates no missing proof and makes no classification-accuracy claim.

Recommendation stack:

1. Qualify and use this neutral generic unresolved boundary.
2. Inspect the separate AI-unavailable recovery fallback under the recovery
   workflow, preserving retry, cancellation and authorization boundaries.
3. Assess new provenance protocols only when a concrete consumer needs them.
4. Retain the [PR 589 compiler deferral](client-compiler-pr-589-outcome.md) until
   a changed artifact passes the existing differential controls. Address known
   runtime-security gaps before any later publication qualification.

The PR was not merged or rebased: the only open proposal is fresh and mergeable,
and its coupled compiler graph has no newly applicable subset. No scanner
exception, rule severity, package pin or installation policy changed.
