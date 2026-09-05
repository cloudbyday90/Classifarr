# Inventory-driven profile refresh outcome

## Delivered behavior

The September 5, 2026 implementation follows the
[separate design and official-source research](inventory-profile-refresh-design.md).
It extends the existing one-minute scheduler and durable refresh worker to all
active libraries whose observed inventory inputs changed. A library no longer
needs an enabled native policy to receive this maintenance.

PostgreSQL statement triggers record input revisions atomically with inserts,
updates, deletes, and truncation. A move marks both libraries. Unchanged sync
timestamps, plots, and unrelated provider fields do not cause refreshes. The
observation reader and change detector share the same metadata projection.

Inventory requests carry only server-owned library/revision identifiers and
cannot fabricate classification or learning authority. They bypass the old
profile-age shortcut. Successful claim completion acknowledges only the revision
requested before the worker read; a later change remains pending for another
pass. Failed or lost claims leave the revision unacknowledged.

Empty generation removes obsolete profiles. Inactive libraries retain pending
changes; new claims pause until reactivation. Already-running work can finish.
Library deletion cascades revision state, and bounded cleanup removes orphaned
inventory requests. Existing libraries are seeded automatically during migration.

The existing worker provides three attempts and lease recovery. A terminal
inventory failure gets a new background probe after the existing two-hour probe
interval, without needing another inventory event or manual regeneration. The
latest request preserves cooldown across restarts. Older terminal records are
pruned after 30 days in batches of at most 1,000 while retaining the latest
record per library and active claims.

## Local Compose measurement

A temporary schema cloned the ten active libraries' IDs and projected observation
fields from the running Compose inventory. The actual migration, planner,
generator, and worker ran against that scratch schema in one outer transaction.
Rollback removed the schema and all fixture writes. The live media rows were
only read, and no titles, plots, credentials, or provider payloads were exported.
A second pass also created ten placeholder profiles before migration and
verified automatic initialization of revision state for all ten.

| Measurement | Result |
| --- | ---: |
| Inventory rows / active libraries copied | 6,692 / 10 |
| Initial refreshes queued / completed | 10 / 10 |
| Initial planning and generation, two local passes | 214–1,116 ms |
| Unchanged sync plus unrelated metadata update, two local passes | 444–1,024 ms |
| Refreshes queued by that unchanged observation | 0 |
| Observed studio update across the scratch inventory, two local passes | 204–2,665 ms |
| Metadata refreshes queued / completed | 10 / 10 |
| Emptied-library refresh queued / profile cleared | 1 / 1 |
| All requested revisions acknowledged | Yes |
| Further work queued after settling | 0 |
| Scratch schema removed by rollback | Yes |

These durations include local query and row-update work under concurrent test
load. They do not isolate trigger overhead or establish a production performance
guarantee. The scratch transaction checks behavior on real-shaped inventory;
separate committed PostgreSQL integration cases verify delivery and concurrency.

## Validation and implementation boundaries

The focused PostgreSQL run passed 29 cases across the new refresh integration
suite and existing observation suite. Cases cover bulk DML, unchanged upserts,
relevant metadata, rollback, moves, empty/deleted/inactive libraries, simultaneous
planners, competing native work, changes during generation, lost claims, exact
bigint revisions, terminal recovery, retention, and atomic completion rollback.
An additional 20 existing profile API and native-circuit lifecycle/compaction
cases passed across three suites, for 49 passing integration cases in total.

Chromium passed the existing profile test, including semantic table headers,
mobile fit, maintenance-text contrast, and no writes from reading the page. The
maintenance explanation now says changes refresh automatically; regeneration is
for troubleshooting. ESM modules separate planning and persistence. No endpoint,
API contract, dependency, scheduler, provider call, or release version was added.

The full backend coverage run passed 1,049 suites and 29,369 tests; the frontend
coverage run passed 319 files and 4,312 tests. Server/client
lint, type checks, normal/production Knip, static ESM imports, strict ESM mock
shapes, migration naming, documentation lint, the production Docker build, and
isolated schema dump/parity checks passed. The coverage ratchet passed against
the committed baseline: backend lines 90.05% and branches 80.31%; frontend lines
87.68% and branches 77.16%. The updated mobile profile screenshot was visually
inspected. The live Compose service was not redeployed.

No semantic classification or routing authority was enabled. Library placements
remain observations, and the held-out human-label readiness and frozen-study
preflight remain separate requirements.

## Recommendations, pros and cons

| Layer | Benefit | Cost or limit | Recommendation |
| --- | --- | --- | --- |
| Transactional observed-input revisions | Covers sync, enrichment, and correction with low operator effort | Trigger work on relevant writes; raw changes can conservatively over-refresh | Keep |
| Existing scheduled outbox and worker | Durable coalescing, leases, retries, and automatic probes | Eventual freshness; batches and recovery cooldown can delay completion | Keep |
| Authoritative keyword/language provenance | Supplies currently missing common-trait evidence | Provider quality and typed identity confidence remain limits | [Implemented and assessed](inventory-metadata-provenance-outcome.md) |
| Bounded overlap and outlier measurement | Supports interpretable future automation | Requires coverage-aware thresholds and independent evaluation | Follow-on |

The final stack is synchronized inventory → typed observations and revisions →
automatically maintained profiles with explicit coverage → bounded comparative
evidence → measured classification and AI automation. Routine maintenance runs
in the background; human input is concentrated on exceptional ambiguity and
independent evaluation samples.

**Follow-up completed:** [keyword and original-language provenance](inventory-metadata-provenance-outcome.md).
The original recommendation was to preserve these fields during inventory
enrichment. Trace existing media-server and provider fields into the canonical
observation fields. Avoid assigning English to unknown language, distinguish
source tags from provider keywords, and reuse existing typed identity resolution
and provider caches. Test source precedence, missing values, ambiguous IDs, and
automatic refresh after a genuine observation changes. Do not enable semantic
routing to compensate for missing metadata.

## PR availability and delivery

The GitHub connector returned no open PRs on both checks during this task. There was
no open PR available for random local implementation. No PR was merged as a
substitute. README and the Unreleased changelog describe the behavior; package
versions are unchanged and no release is created.
