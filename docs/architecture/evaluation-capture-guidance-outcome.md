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

Separately reproduced CI run 37922140772's three failing integration tests:
their temporary library table lacked `media_server_id`. Added that column and
isolated the source, ingestion and capture-state relations rather than reading
unrelated public fixture data. Seeded complete synthetic handoffs and added a
real-database regression for ready/backfilling status and unchanged disabled
budgets/cache. Production readiness SQL and gates are unchanged.

## Verification in progress

- Before fixture repair: 21 passed, three failed. After repair and the new
  regression: all 25 passed in isolated PostgreSQL.
- Focused client checks: two files, 20 tests passed.
- [Random open PR 555 trial](node-types-pr-555-outcome.md): exact patch rejected
  by the unchanged Node-major gate (8/8 → 7/8 → 8/8). No retained dependency
  change or PR merge. The dependency skill kept this an isolated trial.
- Broader checks, no-cache local image rebuild and isolated schema dump are
  pending; no completion claim is made for them yet.

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
