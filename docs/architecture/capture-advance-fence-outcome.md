# Automatic capture advance fence outcome

Date: 2026-11-02 (America/New_York). Status: implemented and verified.
Design: [agreed advance boundary](capture-advance-fence-design.md).
Base: 7285cbb6a782e12970af04827b8812018054051a on main.

## Result and reproduced gap

Automatic rotation/advance now requires the acknowledged revision/UUID retained
by the flight's existing claim helper. A small repository leaf locks the owned
row, rechecks cooperative stop and executes the existing rotation/progress-clear
UPDATE with a UUID predicate. The common transaction/bootstrap wrapper and SQL
module are reused. No general mutation framework or public result field is added.

The pre-change real PostgreSQL regression reproduced the failure: after a
replacement claim committed at the same revision, the older advance changed
selection_offset from zero to 25 and cleared the retained progress/fingerprint/
lease. The shared cache and existing charge survived, so zero later generation
would not have proved the earlier destructive write was absent.

The new fence preserves that entire snapshot on refusal. It leaves the current
UUID intact when advance succeeds, allowing the same flight's subsequent
checkpoint/reservation/finalization work. The existing +25/wrap rule, eligible
limits, progress-clear fields, quotas, charges, status, cooldown and cache table
semantics are unchanged.

Only exact numeric zero from the owner prelock creates private refusal evidence.
The per-flight helper latches it after repository settlement, preserving existing
deferral/five-minute local fallback and suppression of stale cleanup even when
admission replaces the error. Permanent stop keeps precedence. Exact UPDATE
zero remains ordinary budget-changed; malformed/missing counts now deliberately
produce a fixed contract failure instead of the legacy generic budget-changed
classification. Forged text, query/serialization errors and uncertain commit
replies never become trusted ownership evidence.

## Verification

Focused unit checks pass seven suites / 121 tests. Expanded production-factory
isolated PostgreSQL and loopback checks pass twelve suites / 100 tests, covering
both claim/advance lock orders, preservation of retained progress, rollback of
refused singleton bootstrap, queued/locked/updated stop and configuration/restore
claim invalidation through the existing controls.

Rotation controls cover eligible 0, 25, 60 and 300, wrap boundaries and shrinking
populations, with exact UUID/charge/status/cache preservation. Transactions retain
repeatable-read isolation and the existing 15-second statement / one-second lock
limits. A real concurrent repeatable-read replacement produces PostgreSQL 40001;
it is preserved as an error and cannot mint exact-zero ownership evidence.

For delayed and lost replies after a real COMMIT, advance remains durably applied
once, with one UPDATE and one COMMIT attempt. A replacement claim can commit
before that older acknowledgement arrives. No replay, claim recovery or charge
refund occurs. Generic/unknown failures retain existing cleanup authority and
the original failure classification.

The loopback worker regression preserves progress/rotation, published cache and
the earlier charged response after replacement, with zero provider requests,
zero clients created, no stale finish and no second advance during cooldown.
Initial worker authority is explicitly synthetic; replacement uses a real
owner-session claim. Database serialization tests prove the real claim boundary.
Existing checkpoint, reservation, manual-cache and finalization controls pass.

## Ownership review and remaining limits

The complete leaf, private refusal, SQL, repository adapter, claim helper and
worker path were reviewed. Exactly two inventory source entries changed: the
budget repository and new advance repository. Their actual source/analysis
digests are pinned to the existing applicable unresolved review; the checkpoint
entry retains that review. The baseline, server parser, classification, gate and
100-review limit are unchanged. The gate passes with productionCompatible false;
this grants no production inventory-writer authority.

The fence rejects old advances serialized after replacement. An earlier advance
can commit first and acknowledge later. It does not provide a global cache fence,
revoke accepted provider work, constrain older binaries/physical rollback or
change independent manual-cache and read-time maintenance authority. No new
deadline, SQL cancellation or bounded whole-worker shutdown is claimed.

The subsequent [maintenance outcome](adjudication-budget-maintenance-outcome.md)
reproduces and fixes progress pruning after row contention with a singleton
prelock, preserving unclaimed maintenance authority and the existing write
transaction. The next separate investigation is truthful outer-read settlement
after permanent stop. Do not extend either result to independent cache maintenance
or the production inner-admission boundary without its own evidence.

The recommendation stack remains acknowledged private authority, owned prelock
plus guarded mutation, settled private refusal, existing lifecycle/fallback and
no uncertain replay. The cost is one additional short query; the benefit is
preventing an older automatic worker from erasing replacement progress before
the already-fenced later operations reject it.

## Final quality and delivery

| Check | Observed result |
| --- | --- |
| Focused backend units | Seven suites / 121 tests passed |
| Affected isolated PostgreSQL and loopback | Twelve suites / 100 tests passed |
| Fresh full backend unit coverage | 1,924 suites; 62,341 passed, one existing skip; 894.957 seconds |
| Backend coverage S/B/F/L | 89.25 / 86.64 / 90.80 / 89.25 percent |
| Fresh client coverage | 484 files / 7,521 tests passed; 218.08 seconds |
| Client coverage S/B/F/L | 87.90 / 82.04 / 87.69 / 89.57 percent |
| Joint coverage ratchet | Passed with both current reports; baseline unchanged |
| Production client build/browser | Passed; eight Chromium checks |
| Dependency/tooling suite | 72/72 passed; no skips |
| Lint/types, both Knip gates and source/policy/ownership checks | Passed |
| Markdown, staged secret and whitespace checks | Passed |

Neither coverage result is reused. Current backend JSON and client HTML report
hashes are retained privately. Full audits and the candidate/baseline distinction
are recorded in the independent
[compiler assessment outcome](client-compiler-pr-581-outcome.md).

Artifact maintenance reused the verified filesystem inventory and six changed-
directory / 3,541 unreviewed-root-file exclusions. Fresh desktop-linux daemon,
all-container and comparable image reads confirm three unchanged containers and
425 image-tag rows, no remaining Testcontainers, stable image metadata and an
unchanged healthy Classifarr identity/image/start time. No pre-existing artifacts
or images were retired. Only the newly owned detached rebase checkout was removed
through Git after explicit path/head/clean-state checks. All pre-existing
worktrees, recovery/reference assets, current evidence, shared cache/volumes and
other projects remain protected.

Separate design/outcomes, historical follow-ups and Unreleased are updated on
main. PR 581 stays unmerged and deferred; the later conflicting PR 580 was rebased
with identical patch and explicit lease protection, without adopting it on main.
Private regression, SQL/HTTP, ownership, audit and maintenance receipts remain
under .tmp; raw credentials and source evidence are not committed.

Routine execution remains automatic, with no new UI, API, operator CLI trigger,
setting, job, schema, provider permission, routing/learning change, release,
deployment or service restart. Delivery stays on main.
