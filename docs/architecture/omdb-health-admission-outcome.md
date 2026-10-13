# OMDb health admission outcome

Date: 2026-10-12. See the separate
[design, sources and alternatives](omdb-health-admission-design.md).

## Delivered

System-page, heartbeat and explicit refresh OMDb checks now reserve one request
through the same PostgreSQL daily budget and pacing used by lookups. The bounded
provider GET starts only after confirmed commit. Exhausted local quota, pacing,
rejected credentials, configuration changes and admission failures have specific,
safe guidance and remain unknown rather than suggesting a provider outage or
renewing old success. Last-success history is preserved.

The new ESM admission module reuses existing stores; it adds no schema, worker,
queue or process-local limiter. Saved daily-limit corrections invalidate old
admission guidance, while ordinary counter updates do not. The ownership review
explicitly includes quota/pacing writes; it does not authorize inventory writes.
No heartbeat, freshness, TLS, credential-recovery or memory policy was relaxed.

No backfill is necessary or safe for unrecorded historical health attempts. Normal
checks use the new behavior after deployment. This is local-installation admission,
not an OMDb account-wide billing meter. Other databases, explicit settings tests
and the queue's legacy SSL-recovery probe remain outside this increment.

## Verification

- Focused unit and real-HTTP tests: seven suites, 350 tests passed.
- Isolated PostgreSQL: three suites, 80 tests passed. Includes one committed credit
  before real loopback HTTP, concurrent lookup/health admission, durable cooldown,
  reconstructed callers, rollback and lost-commit-reply simulation, busy database,
  daily rollover, rejected credentials and changed settings. Simulated restart
  callers and fixture clock adjustments are not an elapsed-time container soak.
- Type checks, lint, copyright, both dependency analyses, reviewed ownership gate,
  static imports and ESM mock shapes passed. Markdown validation passed 2,165
  documents. The staged secret scan passed. No baseline was relaxed.
- Full frontend coverage passed: 469 files, 7,190 tests in 319.58 seconds.
  Statements 87.63%, branches 81.56%, functions 87.30%, lines 89.34%. The first
  run had one existing ESLint-config hook timeout: 468 files and 7,162 tests
  passed, with 28 tests not executed. The complete rerun enabled phase diagnostics;
  no timeout, assertion, coverage requirement or dependency was changed.
- Backend coverage completed at 23:59:06 UTC. The final console output exceeded
  the tool's output limit, so its process-exit receipt and individual test total
  were not retained. Verification against Jest's freshly written result cache
  matched all 1,814 currently discovered suites to successful results, with zero
  failed or missing suites; Jest's failed-test selection also found none.
  Coverage: statements/lines 89.76%, branches 86.25%, functions 91.20%.
  The combined backend/frontend coverage ratchet passed without changing baselines.

## Exact image and local evaluation

Started on clean `main` at `697a187e873112eb5abf148666dc01e72e545f36`.
Runtime source commit: `140730374795796dbff90058f8efbc8418427e3f`.
The no-cache Compose build used `--require-provenance` from a clean checkout,
Linux/amd64 and AVX2. Tested local image identity:
`sha256:16a4fb49fe9f4ed14e249af45cec7a274cf0991daa6b829f19e605cf52666420`.
This is local-image evidence, not a published multi-platform release or signed
registry claim. Later documentation changes do not change the runtime source.

The exact image ran first in an owned disposable container: no external network,
no published ports, 1 GiB memory, two CPUs and 256 PIDs. Fresh migrations and schema
comparison passed through `20261010_220000_source_catalog_mappings.sql`, with
22 seed migrations and no schema diff. Existing checks passed for five database
configuration cases, six cross-connection cases, eight health projections and
nineteen adapter cases. Five additional packaged OMDb admission cases used one
real loopback request: admitted, paced, exhausted, rejected and changed-generation
outcomes. Only fixture tables were written; public OMDb configuration stayed empty.
The isolated container and its exact data directory were removed and verified absent.

Before replacement, a 76,065,989-byte local database backup passed checksum and
archive-list checks, and the exact previous image was retained. This is not a
full restore rehearsal. Only local Classifarr was recreated; Unraid, Plex, shared
Ollama and unrelated containers were not changed. Normal startup jobs remained
enabled. No manual provider refresh, settings change or recovery was performed.

The replacement started at 23:53:16 UTC and is healthy, with no OOM and zero
restarts. Twenty-three packaged runtime files match the checkout. Route fixtures
passed six aggregate, five freshness, six OMDb admission and three configuration
failure/drift/reconciliation checks. Admission output remains unknown and preserves
last success without exposing credentials. These fixtures use controlled observation
times, not a timed heartbeat soak. Health, liveness and readiness returned 200;
unauthenticated detailed health returned 401. Compiled System information passed.

Read-only browser inspection showed OMDb healthy and seven of seven active services
healthy, zero unknown, one disabled and four not configured. Local OMDb usage moved
from 80 to 81 across startup with its configured limit unchanged. That is consistent
with startup accounting, not proof of complete upstream billing attribution; the
synthetic database/HTTP case establishes the exact one-credit behavior.

Read-only before/after totals stayed at 6,837 classifications, ten active/covered
libraries, four unresolved identities (two source review, two retry wait), zero
pending text embeddings and 6,815 pending image embeddings. No startup warnings
appeared in the initial sample. Deployment retained uid/gid 1000, read-only root,
2 GiB memory, no-new-privileges and PostgreSQL noexec tmpfs. These checks do not
establish resolution of unrelated identity, optional vector or memory issues.

## Recommendation stack

1. Keep shared durable admission: correct local accounting without another service
   or migration. Cost: health competes with useful lookups for the same budget.
2. Keep explicit unknown/skipped guidance and last-success history: honest status
   without hiding failures. Cost: pacing can defer a useful health observation.
3. Next, move the legacy queue SSL-recovery probe into shared admission while
   preserving its recovery behavior and credential fencing. It currently has
   process-local timing and bypasses this budget.
4. Then evaluate using recent, attributable lookup outcomes for OMDb health or a
   lower cadence, with matching freshness and recovery-latency rules. The default
   heartbeat calculates to 96 checks/day/installation before startup/manual work;
   this is not a measured account-wide request total.

GitHub MCP enumeration found zero open PRs. No random open PR was available;
none was implemented or merged. No release, tag, version bump or branch was made.
