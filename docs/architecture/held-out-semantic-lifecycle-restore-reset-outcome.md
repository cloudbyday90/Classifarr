# Held-out semantic lifecycle restore reset outcome

Status: implemented on 2026-09-08. See the separate
[design](held-out-semantic-lifecycle-restore-reset-design.md) for research,
options, and the recommendation stack.

## Outcome

Every backup restore now clears the held-out lifecycle source checkpoint and
audit receipt in the same transaction that restores policy configuration. The
two tables remain excluded from backups, and a successful restore leaves no
destination-local cursor that could describe its prior configuration.

The next scheduled lifecycle check reads only the restored durable aggregate
source. It can then defer when evidence is incomplete or invoke the existing
private eligibility audit when its established gate is satisfied. No audit is
run during restore.

The implementation is a focused ESM reset service with fixed SQL statements.
Focused tests verify the exact tables removed and verify that a merge restore,
not only a replace restore, invokes the reset.

## Boundaries preserved

The reset stores and returns no data. It neither creates lifecycle or declared
purpose evidence nor selects, captures, or labels a cohort. It does not run
readiness, frozen-study preflight, semantic retrieval, or AI; alter policy or
configuration; expose an endpoint; or route media.

## Next item

Improve the private eligibility audit's aggregate explanation for a zero
policy-only comparison result. It should distinguish the mutually exclusive
source-quality exclusion classes without exposing library, policy,
configuration, provider, or media identities and without creating a cohort.
That will show what ordinary system evidence must change before the existing
passive gate can proceed, without asking an operator to classify records.
