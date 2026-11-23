# Exact History IDs in Discord completed-item corrections outcome

November 23, 2026 Eastern. See the
[design](discord-completed-correction-bigint-design.md) for the alternatives
and primary sources.

## Implemented behavior

The Discord verification opener (`verify_no`) and completed correction menu
(`library_select`) accept canonical positive History IDs through PostgreSQL
BIGINT max. The shared parser returns a number in JavaScript's safe range
and exact decimal text above it. The existing `HistoryId_LibraryId` menu
value fits Discord's limit at 30 characters even with both IDs at their
respective maxima. The destination uses a positive PostgreSQL INTEGER.

The actual enabled control, saved Discord message, current History status,
and delivered notification receipt authorize the action. The correction
transaction keys the write and evidence to that exact row, and the provider
route uses the same History ID after commit. A repeat selection of the saved
destination returns without another correction or provider call. Affirmative
verification and direct reclassification still use their safe-integer limit.

The existing optional original-decision snapshot has a separate INTEGER
History ID boundary. A correction above 2,147,483,647 can retain an exact
correction event and outcome while its original-decision snapshot is
unavailable. Astra reviewed the production diff and found no unintended
admission changes.

## Local verification

All 129 focused tests and 176 isolated PostgreSQL tests passed. They exercised
the real classification notification renderer and delivery repository, the
verification opener and its generated menu, and a routing stand-in. The cases
covered adjacent large History IDs, BIGINT max and overflow, a mismatched
notification, and duplicate selection. The correction evidence retained the
original-decision snapshot at INTEGER max and reported it as unavailable above
that boundary.

Fresh backend coverage passed 64,409 tests in 1,957 suites, with one skip.
The coverage ratchet passed using the verified client inputs and report.
Lint, type checks, ownership and preflight, ESM checks, policy checks,
Markdown lint, and the staged secret scan passed. The root, server, and client
npm audits returned zero findings. GitHub listed no open PRs for local testing
or Dependabot rebasing.

## Next recommended item

Design the original-decision snapshot upgrade across recovery and evaluation.
Use exact IDs in the stored representation and group keys. Preserve existing
numeric snapshots, exercise the recovery query across both integer boundaries,
and verify missing and conflicting evidence still excludes the right row.
