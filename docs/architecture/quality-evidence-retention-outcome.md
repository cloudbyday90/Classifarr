# Multi-window quality evidence: outcome and operation

September 26, 2026. See the separate [design and tradeoffs](quality-evidence-retention-design.md).

## Previous commit reassessment

`51eb6e16` implemented a frozen, cache-only movie/TV comparison. It correctly
reported missing responses and missing independent reference labels. It could not
retain a 300-case experiment through the existing 50-response cache rotation.
This change closes that retention gap without enlarging the cache or allowance.

## Delivered behavior

- One explicitly registered protocol, at most 300 movie/TV cases and 600 unique
  request records, expiring at the protocol's original 720-hour deadline.
- Isolated, cache-only production replay; validated hash-only observations merged
  in short row-locked transactions. No names, descriptions, prompts, generated
  content, or independent review labels enter the study table.
- Collection before cache replacement, after publication before acknowledgement,
  and before diagnostic progression. Restart retries preserve evidence and capture
  checkpoints; duplicate requests do not inflate historical cost.
- Completed and rejected outcomes survive eviction. Contradictory exact-request
  evidence stops the study. Source/policy/model drift stops collection for that
  study and allows normal capture to continue. Transient collection failures defer
  capture; a matching explicit stop releases it without changing capture settings.
- Private blinded JSON packets include title, year, bounded description, and an
  unranked destination catalog. Predictions, membership, corrections, provider
  identifiers, and scores are excluded. Treat metadata as untrusted text.
- Aggregate report version 2 supports retained usage across windows. Version 1
  remains bounded to 50 current cached responses. Synthetic provenance, missing
  labels, incomplete evidence, and historical study state remain explicit.

The migration creates an empty table: upgrades do not opt in, generate AI calls,
export files, or change routing. Existing Vue SWR and pause controls are unchanged.

## Operator workflow after the code is installed

Run from the repository root with the intended database environment. In production,
private `.tmp` paths resolve beneath the application's data directory. Do not put
credentials in commands, reports, or documentation. These commands were tested
with fixtures and disposable databases, not run against the user's live library.

First save the frozen protocol using the existing read-only command. If AI cases
are involved, prepare after a valid cache identifies the intended model; a cold
model identity changing later intentionally stops the study.

```powershell
node server/src/scripts/runSourcePairQualityExperiment.mjs --prepare --output-file .tmp/quality-protocol.json
node server/src/scripts/runQualityEvidenceStudy.mjs --start --protocol-file .tmp/quality-protocol.json
node server/src/scripts/runQualityEvidenceStudy.mjs --packet --output-file .tmp/quality-review.json
```

An active study is collected automatically by existing diagnostic/capture paths.
It does not enable capture when capture is disabled. An explicit cache-only
collection or report is also available:

```powershell
node server/src/scripts/runQualityEvidenceStudy.mjs --collect --output-file .tmp/quality-collected.json
node server/src/scripts/runQualityEvidenceStudy.mjs --report --output-file .tmp/quality-report.json
node server/src/scripts/runQualityEvidenceStudy.mjs --report --reference-file .tmp/quality-reference.json --output-file .tmp/quality-graded.json
```

Use new output filenames; writes are exclusive. Collect can save database evidence
even if the later file write fails; retrying collection is idempotent. Start uses
the already saved protocol and prints an aggregate receipt, not another artifact.
For report/collect, exit 2 means a valid report is incomplete, synthetic, or the
study is inactive; exit 1 means the command failed. Only fully measured active
reports exit 0, and even those never authorize routing.

The reference file uses `source_pair_quality_reference.v1`, the protocol ID,
`independent_human.v1` provenance, and labels containing `item`, `mediaType`,
`target`, `consensus`, and `reviewerCount`. Obtain genuine independent reviews;
do not relabel predictions or present library membership as ground truth.
Unanimous labels require at least two reviewers; adjudicated labels require at
least three. Leave ambiguous cases unlabeled. JSON cannot prove independence.

If the study drifts or conflicts, export its historical report before stopping.
Preserve it for investigation; prepare a new protocol only after checking why the
inputs changed. To stop collection and delete just that study:

```powershell
node server/src/scripts/runQualityEvidenceStudy.mjs --stop --protocol-file .tmp/quality-protocol.json
```

Stop does not delete cache, library data, capture checkpoints, or private files.
Locally exported files have no automatic expiry; store privately and remove under
your own retention policy. Study hashes are not encryption.

## Validation and PR availability

New targeted tests cover 300 synthetic cases across twelve 50-response windows,
reordered JSONB, duplicate delivery, one-arm backfill, rejected output, conflicts,
stale observations, private packet projection, silent CLI imports, and capture
publication failure/recovery. Real PostgreSQL tests cover concurrent merges,
generation fences, rollback, fixed expiry, idempotent migration, and restart/cache
rotation without budget changes.

Final verification:

- Backend full coverage run: 1,449 suites passed; one static SQL documentation
  check initially failed. After documenting the module-local constant query, the
  failed-suite rerun passed all 28,253 code-health checks. Final changed-behavior
  regression: eight suites / 131 tests passed. No remaining known failures.
- Backend coverage: statements/lines 90.35%, branches 84.31%, functions 92.19%.
  Production worker behavior is exercised through real worker tests; worker-internal
  execution is not counted in the parent-process coverage report.
- PostgreSQL: 166 suites / 1,914 tests passed, with one existing suite/test skipped.
- Frontend: 383 files / 5,338 tests passed. Statements 85.73%, branches 77.84%,
  functions 85.30%, lines 87.79%. The combined coverage ratchet passed.
- Production frontend build, backend/frontend type checks, lint, copyright,
  development/production dependency checks, static ESM imports, mock shapes,
  migration integrity, documentation lint, and diff checks passed. The only lint
  warning is the pre-existing nonliteral file path in
  `captureOperatorCorrectionFrozenPolicy.mjs`.
- An isolated test image verified both the new migration over the old snapshot
  and a fresh installation of the regenerated snapshot. Temporary schema containers
  and their generated disposable data were removed; no live data was removed.

GitHub MCP was queried twice for open PRs in `cloudbyday90/Classifarr` on September
26. Both returned an empty list. No random open PR was available; no closed PR was
substituted and no PR was merged.

## Final recommendation and next item

Keep the existing PostgreSQL, ESM service modules, isolated replay worker, bounded
cache, and Vue SWR stack. The advantage is durable, regradable evidence without
more inference or another scheduler. The cost is bounded replay CPU and deliberate
study interruption when frozen inputs change. Do not add another dashboard or
increase sample requests before measuring actual coverage.

Next: run one protocol-bound coverage audit and blinded reference review, then
produce the first honest quality readout. Reuse existing reviewer submission
infrastructure. If the 300-case cohort lacks responses because capture selected
different cases, the next code component is a **budget-neutral, protocol-bound
capture selector** within the existing worker—not another queue or a higher budget.
Retention cannot create missing evidence, and synthetic tests do not demonstrate
real-world quality improvement. No live study, deployment, or release was performed.
