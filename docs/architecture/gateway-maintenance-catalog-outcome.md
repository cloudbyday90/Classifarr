# Gateway maintenance-catalog recovery — outcome

## Status

2026-10-16: approved scope and deeper research review documented; runtime
implementation remains pending. The user approved verification-only recovery,
then requested further weakness analysis and online methodologies. This update
is documentation only, not a completed backup/restore feature.

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

## Verification and limits

Markdown validation passed for 2,264 files with no errors; `git diff --check`
passed. Only documentation validation applies to this research update. No runtime tests,
model checking, fault injection, database queries, no-cache rebuild or deployment
were performed for it. The earlier cleanup rehearsal results do not validate the
new catalog design. Implementation will need the checks listed in the design.

No runtime source, dependency, database, container or provider was changed. No
production activation, expiry, live restore, branch, PR merge or release occurred.
Unraid, Plex and shared Ollama were untouched. A fresh GitHub MCP check on
2026-10-16 found no open Classifarr PRs; no closed PR was substituted.

## Next

Implement the approved verification-only design, starting with state invariants
for maintenance-only refreshes and backup self-bookkeeping. Keep expiry and
restored-worker activation disabled. No additional user approval is needed for
the already agreed scope; a broader recovery/hosting policy would need a new decision.
