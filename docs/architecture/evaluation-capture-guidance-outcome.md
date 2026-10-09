# Evaluation capture guidance outcome

Date: 2026-10-09. See [design and tradeoffs](evaluation-capture-guidance-design.md)
and the [operator guide](../operations/evaluation-ai-capture.md).

## Diagnosis and changes

Local read-only inspection found no cached AI-response batch, zero capture
limits/reservations and disabled recurring capture. Inventory was ready and
policy replay had evaluated 300 cases. The latest historical group contained
252 missing responses and 23 unsupported paths; these are different counts from
policy replay and change as windows are surveyed. This is expected lack of
authorization, not evidence of a failed generation. Unraid was not inspected or
changed in this round.

Added a small static Vue disclosure with a read-only container-console command
and a separate guide for deliberate activation, reservations, disabling and
failure review. No mutation endpoint, inference, polling timer, schema change,
budget enablement or memory-policy change was added. Existing templates work
without a new service or mount. The recovery skill kept status reads distinct
from authorization to run recovery/capture.

Separately reproduced [CI run 37922140772](https://github.com/cloudbyday90/Classifarr/actions/runs/37922140772)'s three failing integration tests:
their temporary library table lacked `media_server_id`. Added that column and
isolated the source, ingestion and capture-state relations rather than reading
unrelated public fixture data. Seeded complete synthetic handoffs and added a
real-database regression for ready/backfilling status and unchanged disabled
budgets/cache. Production readiness SQL and gates are unchanged.

## Verification

- Before fixture repair: 21 passed, three failed. After repair and the new
  regression: all 25 passed in isolated PostgreSQL.
- Focused client checks: two files, 20 tests passed.
- The first full frontend run caught the repository's required Vue script block
  missing from the static component. Added its explicit component name in
  `script setup`; code-health plus focused checks then passed all 3,199 tests.
  The first broad run had 6,515 passed and that one failure. The final full rerun
  passed all 448 files / 6,516 tests: 88.80% lines and 80.48% branches.
- Chromium passed with Enter/Space disclosure, mobile-width, pause/resume and
  authorization-loss checks and zero HTTP writes. The initial run hit the existing
  30-second test timeout during early interaction; an unchanged rerun passed in
  4.7 seconds. Adding explicit Space/Enter close/reopen coverage then passed in
  5.9 seconds. No timeout or assertion was relaxed. Existing unrelated dashboard
  mock warnings remain outside the scope of this browser check.
- Root lint and type checks passed; four initial Vue formatting warnings were
  corrected and client lint/type checks rerun successfully. Markdown, copyright,
  static ESM import checks, both Knip modes and all 40 dependency-tooling tests
  passed. The status CLI also passed against the existing local container with
  `default_transaction_read_only=on`, showing zero configured/reserved budget.
  The guide's five-call activation and zero/zero disable examples pass the
  production argument parser; no live configuration command was executed.
- [Random open PR 555 trial](node-types-pr-555-outcome.md): exact patch rejected
  by the unchanged Node-major gate (8/8 → 7/8 → 8/8). No retained dependency
  change or PR merge. The dependency skill kept this an isolated trial.
- Full backend unit/coverage run passed: 1,758 suites, 54,572 passed tests and
  one Linux-only test skipped on Windows (covered by the image probe below).
  Coverage: 89.75% lines, 85.86% branches. The coverage ratchet passed with both
  fresh workspace reports and unchanged thresholds.
- Full isolated PostgreSQL integration run passed: 246 suites / 2,951 tests.
  One separate opt-in provider-fault Compose suite/test was skipped by its
  existing default gate; that dedicated harness was not run in this round.
  The three originally failing tests now pass in the full suite, not just the
  focused rerun. No acceptance gate, retry assertion or timeout was weakened.

## Local image and schema

Built local Compose with `--no-cache --require-provenance` from clean source
`bc3d14740d6d6c0c7acc01f4f1cc5817619e66e9`. The resulting image ID is
`sha256:ea51195de1f9f42a85f5d66946606c6914413251ff8071c32fbed05651aa6a40`;
its OCI revision label matches. Only the local Classifarr service was recreated,
using `--no-build --force-recreate --wait`. Existing data mounts, forced UID/GID
and the 2 GiB memory limit were preserved. This is not a published release or an
Unraid upgrade; later commits only record verification/documentation.

The container became healthy with zero restarts and no OOM kill. `/health`
returned 200 and unauthenticated evaluation-history access returned 401. The
packaged frontend assets contain the new disclosure and guide link. The status
CLI passed with PostgreSQL writes prohibited and reported disabled capture,
zero limits and zero reservations.

At 19:31:14 UTC, a read-only packaged-service/database check completed in 273 ms:
inventory was ready, all ten current-run handoffs complete and due/processing
tasks zero. The latest policy snapshot (19:28 UTC, before restart) contained
300 evaluated cases; this does not claim a new post-restart pass. The historical
comparison group had 259 missing responses, 23 unsupported paths and no completed
pairs. There were no cached response batches. Counts grew through normal window
selection; no capture was enabled to fill them.

At 19:36:58 UTC the normal post-restart imports had begun a new backfill pass:
seven handoffs were complete and three were scanning, with a 19:35 checkpoint
and zero due/processing tasks. The diagnostic correctly changed to `backfilling`
instead of reusing the earlier ready state. Capture stayed disabled with zero
reservations. This observation does not claim those last three scans had finished;
no manual completion, queue reset or worker invocation was used to advance them.

After the no-cache rebuild, `check-schema-snapshot-container.mjs --dump` created
and dumped a fresh isolated database using that exact image. The schema snapshot
was unchanged. The runner removed its disposable container/data; no schema-check
container remained. The existing Linux-only directory-fsync assertions also
passed against the new image's module in a separate unprivileged, network-disabled,
read-only-root container with temporary synthetic files and bounded memory/PIDs;
that probe was removed. No local appdata was used by either isolated check.

## Recommendation

Keep recurring capture opt-in, with its existing durable budget and admission
safeguards. The console guide is immediately usable on existing templates, at
the cost of requiring administrator console access. A budget form would improve
discoverability but needs its own mutation-authority and concurrency design.

Next: a deliberately authorized small-budget local capture/replay experiment,
without using the separate one-shot capture path to bypass recurring limits.
Separately review Node 24 declaration patch 24.19.2 and the previously identified
Playwright 1.64.0 / Vue Router 5.4.0 updates. No release, tag or version bump belongs
to this change.
