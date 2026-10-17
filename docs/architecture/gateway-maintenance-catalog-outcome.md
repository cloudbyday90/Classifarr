# Gateway maintenance-catalog recovery — outcome

## Status

2026-10-16: first implementation increment adds a test-only scheduling model and
private checked input for the existing optional restore verifier. Full catalog
capture/restoration and live catalog-aware scheduling remain pending. This is not
a completed maintenance-catalog backup/restore feature.

See the [design and risk review](gateway-maintenance-catalog-design.md) for official
sources, observed code paths, recommendations, tradeoffs and acceptance tests.

## Findings established

Read-only inspection of baseline `fa6f3231ebbb52299e309408678ba79647edf2c6`
confirmed that current inference archives omit the three maintenance tables.
Additional implementation risks were identified: catalog self-reference,
maintenance-only scheduling changes, live restore guards, nonportable transaction
identity, external artifact dependencies, mutable input handoff and aggregate
byte limits. These are code/design findings, not reproduced production failures.

Selected methods are lightweight FMEA/fault-tree review, executable state-model
testing, deterministic crash-boundary tests, real isolated restoration,
dependency-aware retention and durable idempotent reconciliation. Research came
from PostgreSQL, NASA, Amazon, Google SRE, restic, pgBackRest, Linux man-pages and
the RFC Editor. The design labels project-specific conclusions separately.

The important refinement is separating exact database restoration, referenced-file
availability and authorization to resume. Verification cannot grant the last one.
Two same-host copies remain a common failure domain; no off-host recovery is claimed.

## Earlier research-only verification

Markdown validation passed for 2,264 files with no errors; `git diff --check`
passed. Only documentation validation applies to this research update. No runtime tests,
model checking, fault injection, database queries, no-cache rebuild or deployment
were performed for it. The earlier cleanup rehearsal results do not validate the
new catalog design. Implementation will need the checks listed in the design.

In that earlier research-only commit, no runtime source, dependency, database, container or provider was changed. No
production activation, expiry, live restore, branch, PR merge or release occurred.
Unraid, Plex and shared Ollama were untouched. A fresh GitHub MCP check on
2026-10-16 found no open Classifarr PRs; no closed PR was substituted.

## First implementation increment

The model keeps snapshot coverage separate from retry identity. It exercises
maintenance-only changes, capture after admission, immutable historical views,
duplicate/reordered receipts, cancellation, restart, unknown publication and
exhausted budgets. It exposes the conservative consequence that catalog-only
refreshes share the existing inference revision's three-attempt budget. It does
not invent a new persisted generation format or reset policy hashes.

The verifier now copies checked dump bytes into private scratch, validates that
copy, closes its writers and gives native `pg_restore` only the private path.
It refuses insufficient scratch, changed bytes, invalid permissions and
cancellation. The trusted-host boundary and restricted restore role remain.

Initial host checks: 435 gateway unit tests in 20 suites passed, including 40 new
model/input tests. The model includes 1,620 production-scheduler comparisons and
8,192 deterministic event attempts, not exhaustive state exploration. The first
wider run lacked OpenSSL in PATH; rerunning with the existing explicit binary
passed. Image rehearsal and local rebuild results will be recorded after execution.

Typecheck, test/security lint (after removing one unnecessary suppression), both
Knip modes, copyright, Markdown, static imports, ESM mock-shape and npm-flag checks
passed. The inventory ownership gate detected the changed verifier source. Its
single source digest was updated after reviewing the full diff: SQL and the
analysis digest are unchanged, connections still target the private socket, and
no live database, cleanup authority or provider access was added. The recheck
passed; no other ownership entry was refreshed. Full coverage/ratchet is not run
for this scoped increment.

Fresh GitHub MCP enumeration found no open Classifarr PRs. No closed PR was
substituted. No dependency upgrade or new table is included. Existing native
UUIDv7 storage conventions remain unchanged; test identifiers are synthetic UUIDv7.

## Next

Implement bounded, same-snapshot catalog capture and exact restoration, including
the explicit reader-role contract, relationship checks and artifact dependency
inventory. Only then persist and integrate the modeled scheduling distinction;
post-capture rotation must not invalidate a recovery set. Keep expiry and
restored-worker activation disabled. No additional user approval is needed for
the already agreed scope; a broader recovery/hosting policy would need a new decision.
