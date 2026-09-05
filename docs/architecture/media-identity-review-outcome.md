# Authenticated media identity review outcome

## Delivered behavior

The previous five changes preserved typed source/history identities and made
uncertain TMDb matches abstain. This change supplies the missing operator path:
**Libraries → Review media IDs** lists unresolved movie/TV items, explains why
they need review, fetches an explicitly entered typed TMDb candidate, and requires
verification before confirmation.

The implementation follows the [separate design](media-identity-review-design.md).
The UI, client API leaf, HTTP router, contracts, repository, service, and provider
adapter use ESM. A new migration adds one expiring preview per administrator and
a partial inventory index; the generated schema includes both. No dependency,
version, or release change is included.

## Security and persistence outcome

The endpoint accepts ordinary administrator access sessions and rechecks the
active database account. API keys and scoped automation tokens are rejected.
Cookie mutations retain the application's CSRF check. Candidate and source
bindings are server-held; confirmation does not accept a candidate ID override.

Transactions lock the actor, source, then preview. They reject changed source
versions, expired or replaced previews, cross-actor attempts, and known IDs.
The guarded update, preview consumption, and audit insert commit together.
The audit records identity and provenance without storing provider payloads.
The write has no classification, queue, history, routing, or learning side effect.

The reviewed inventory ID can participate in future ordinary processing. This
workflow does not itself schedule that processing. Database audit records remain
subject to the existing audit retention and privileged database access policies.

## Local validation

- Backend: both the final full unit run and the full coverage run passed 1,047
  suites and 29,247 tests. Statements/lines 90.05%, branches 80.24%, functions 92.71%.
- PostgreSQL 18 integration: 20 checks passed against an isolated Docker database.
  These cover atomic ID/audit persistence, rollback after a real audit constraint
  failure, replay, expiry, replaced previews, actor/item binding, tampering,
  source edits and reversals, edits during provider I/O, account revocation,
  competing administrators, typed TV identity, and bounded keyset pagination.
- Client: 317 suites and 4,250 tests passed with coverage. Statements 85.58%,
  branches 77.05%, functions 84.54%, lines 87.61%.
- Chromium: the keyboard workflow passed. It checks logical focus, numeric input,
  the explicit verification gate, the confirmation body, receipt announcement,
  and return focus. It also measures at least 4.5:1 contrast for the enabled
  confirmation button. Desktop and 390-pixel mobile captures were inspected.
- The full application image built. The isolated application container applied
  migrations, regenerated the schema, and passed the schema comparison.
- The running local Compose instance passed the new read-only inventory query.
  It returned zero eligible unresolved receipts; no real inventory ID was changed.
  Provider outcomes and mutations above use deterministic fixtures, not claimed
  human review or live provider accuracy evidence.

Server/client lint, type checks, both Knip checks, static-import and strict ESM
mock-shape checks, documentation lint, and whitespace checks passed. The coverage
ratchet passed with fresh server and client reports and no baseline reduction.

The first checks caught a scoped Tailwind directive issue, a browser mock that
also intercepted module imports, and SQL/mock-reset code-health requirements;
these were corrected and retested. The strict ESM gate also exposed an existing
test mock's unused default export; it now mirrors the real named-only module.
The root agent instructions now identify the actual root coverage-ratchet script.

The in-process backend coverage run exceeded 23 minutes and approximately 4 GB
of private memory, so it was stopped. The successful run used two workers with
`workerIdleMemoryLimit: '1024MB'` in a temporary ESM configuration extending the
repository configuration and finished in 513.7 seconds. The equivalent CLI is
`node scripts/run-jest.mjs --coverage --maxWorkers=2 --workerIdleMemoryLimit=1024MB --verbose=false`
from `server/`. This keeps the existing V8 coverage provider and thresholds;
[Jest documents worker recycling](https://jestjs.io/docs/30.0/configuration)
as a way to bound retained worker memory. The separate complete unit run had
already passed before this coverage retry.

## Recommendations and tradeoffs

Use session authorization → current account check → typed provider preview →
source-bound confirmation → transactional ID/audit write. This keeps ambiguous
matches under explicit operator control and makes concurrent updates fail safely.
The costs are manual ID discovery, a ten-minute review window, and a fresh review
after any source-row change. One preview per administrator also means that
creating another preview in a second tab invalidates the first.

Prioritize authenticated receipt recovery for a lost confirmation response.
The existing transaction already prevents partial writes and duplicate receipt
creation, but a connection failure can leave the operator unsure whether the
save completed. A follow-up should retrieve the committed receipt by actor and
preview ID, preserve authorization/source provenance, and test lost responses
without performing another write. Add bounded candidate search after that if
operators find manual ID discovery too slow.

The original semantic study remains gated: an eligible held-out 24–32-case cohort,
independent human labels, acceptable measured errors, readiness, and frozen-study
preflight are still required before review-only semantic counter-evidence.
No automatic semantic routing is introduced.

## PR and delivery scope

GitHub MCP reported no open PRs for `cloudbyday90/Classifarr`; there was no eligible
PR to select randomly or implement locally. Closed dependency PRs were not
substituted. This work is recorded under Unreleased and is intended for commit,
push, and integration into `origin/main` as requested.
