# Capture finalization acknowledgement outcome

Date: 2026-11-01 (America/New_York). Status: implemented and verified.
Design, official November research and tradeoffs:
[finalization acknowledgement design](capture-finalization-acknowledgement-design.md).

## Change and evidence

The worker now interprets finish results through a small ESM helper created for
each runOnce flight. After the repository promise settles, exact numeric rowCount
one permits normal completion; exact zero records non-application in a private
boolean and throws a fixed error. Other/missing counts fail the contract, and
rejections cannot set that flag. Error text is never zero-row proof.

The first regression run failed thirteen of seventeen new cases against the old
worker. The worker previously discarded all five finish results, allowing primary
non-application to be reported as captured or another ordinary outcome.

Known primary non-application now returns existing deferred, uses the five-minute
local cooldown, and skips the secondary finish even if admission replaces the
thrown error. Permanent stop has precedence. A new flight gets a fresh helper;
no stale flag survives that invocation. During failure cleanup, a zero-row result
or rejection preserves the already-observed failure status without another attempt.
That status describes the worker outcome, not a successful persistence receipt.

The existing worker fixture moved into a shared test helper and its successful
finish mock now returns a real rowCount-one shape. New regressions use that same
evaluation setup. Production changes are limited to the small finalization helper
and its worker integration; repository SQL and QueryResult contracts are unchanged.

## Verification

Focused service, code-health and ownership checks passed seven suites / 37,587
tests. They cover all four primary finalizers, cleanup outcomes, exact count
validation, spoofed error text, coalescing, flight isolation, exact local cooldown,
stop precedence and an admission error replacing the internal error. Existing
capture guards and composite readiness behavior also pass.

Focused isolated PostgreSQL passed four suites / thirty-seven tests. The eleven
new acknowledgement tests use the production database factory for revision
changes at each primary site, three cleanup outcomes, singleton deletion followed
by the unchanged default-row bootstrap, and delayed/lost/stopped acknowledgement
after a real zero-row COMMIT. No classification occurs while acknowledgement is
pending. A lost reply follows the existing ordinary failure cleanup; it is not
promoted to zero-row evidence or transaction-callback replay.

Within that run, two publication tests run the real capture flow. The HTTP test uses
only an in-process loopback provider fixture: it dispatches once, reserves quota,
records progress and publishes the cache before a revision change makes finish
affect zero rows. The saved cache/progress, retention and charged reservation
remain exact, and a repeated tick stays in local cooldown. The empty-plan test
creates no provider client, reservation or cache write before its zero-row finish.

Existing PostgreSQL cooldown and failure-stop tests retain exact deadline,
isolation, lock timeout, queued-stop, rollback and unknown-COMMIT evidence.
Adjacent automatic source-pair evaluation, budget, workload/cancellation and
restore-reference checks passed five suites / sixty-four tests. Together the two
runs passed nine PostgreSQL suites / 101 tests.

Backend lint/type checking, both dependency scans, static ESM import/mock-shape
checks, copyright and four policy gates passed. The inventory ownership gate
passes with productionCompatible false and no manifest/pin or baseline changes.
Existing unresolved writer and indirect-query analysis debt remains; this gate is
not live-writer authorization.

## Limits and next item

Zero affected rows proves non-application, not a newer owner/configuration. A
matching acknowledged update does not establish latest-attempt ownership. The
raw repository result, synchronous validation, bootstrap commit behavior,
prelocking, cooldown validity, transaction isolation and timeouts are preserved.
Stop after dispatched COMMIT cannot guarantee rollback. Already-published work
and charged attempts are neither removed nor refunded.

The helper adds no query, timeout, retry queue, durable payload or public result
field. Existing exception cleanup remains; it is not permission to replay provider
work or an uncertain transaction. Existing admission, resource/cancellation gates,
automatic schedule and evaluator-only composite result remain authoritative.
Fresh installs remain off. Restart/restore/singleton lifecycle is unchanged.

No UI, operator CLI trigger, schema, endpoint, job, setting, provider capability,
routing or learning change was added. No release, deployment or restart occurred.
The design records the recommendation stack, pros/cons and official sources.

Next: assess same-revision attempt/status ownership so a late finalizer cannot
overwrite a newer outcome merely because the configuration revision still
matches. Design its durable fencing and uncertain-outcome semantics before
adding retry authority. Keep singleton lifecycle and broader write cancellation
separately scoped.

## Validation handoff

Full backend coverage passed 1,914 suites / 62,061 tests, with one existing skip,
in 785.922 seconds. Coverage was 89.22% statements/lines, 86.64% branches and
90.77% functions. The coverage ratchet passed without baseline changes. Client
source is unchanged; the ratchet reused the October 30 07:37 client coverage-final
report. No fresh frontend test/build is claimed.

Markdown passed 2,420 files; whitespace and staged secret checks passed. Unreleased
records the change, and the predecessor outcome links to this batch. Work and
delivery use main, with no version bump or release.

The final GitHub MCP intake found no open PRs, including Dependabot. Random open-PR
implementation and stale dependency rebasing were therefore inapplicable. No PR
was merged.

Artifact maintenance reused the verified recent filesystem inventory and retained
its changed-metadata and unreviewed-file exclusions. Fresh context/daemon,
all-container and image metadata confirms the same Classifarr container, image,
start time and healthy state. No Testcontainers remain. No files or images were
removed; current evidence, recovery assets and shared resources remain protected.
Private receipts stay under .tmp. No image build, deployment or restart occurred.
