# Automatic gateway retention assessment

Design, 2026-10-15. Supersedes the proposed administrator-driven cleanup command
following the user's request for repeatable automatic processes. No new approval
file, purge command, privileged deletion function, UI control or migration.

## Decision

The optional standalone gateway assesses history at startup and every five
minutes after the preceding check completes. Assessment does not depend on a
browser, status polling or provider traffic. A separate one-connection read-only
pool prevents diagnostic failures from poisoning the admission writer. One SQL
statement provides a consistent view of fenced ledger identity and aggregate
record categories; no provider calls, LLM decisions or writes.

Distinguish three questions: capacity pressure, retention eligibility, and physical
disk reclamation. At 80% of the existing 100,000-binding cap, signal approaching
capacity; at 100%, signal full. These are conservative project defaults, not an
industry standard or measured workload forecast. Calculate candidate and protected
counts using the exact archive eligibility expression. A default 90-day horizon
is an assessment policy, not permission to delete. `retentionDays` may be set from
1 to 3650 in existing gateway configuration; changing it requires restart.

Active/uncertain, missing-outcome, completion-observed, lifecycle-linked and recent
records remain protected. Never infer completion from age. Missing legacy active
bindings or resident-counter mismatch block the assessment's cleanup conclusion.
High occupancy with no candidates means capacity is blocked by protected history,
not permission to loosen safety. Report projected remaining rows if all current
candidates were eventually removed, without claiming cleanup happened.

## Automatic lifecycle and bounds

Native PostgreSQL UUIDv7 assessment references, database observation/cutoff times,
policy values and fixed reasons make each result explainable. Cache only the latest
result. Database counts survive restart; the cached observation does not. Startup
always rechecks. A single timer runs checks with no overlap or queued catch-up;
failure retries only at the next regular interval. No write attempts are retried.

Use a maximum of one diagnostic connection, five-second connection/query timeout,
four-second SQL timeout and read-only connection default. Stop the timer before
closing the pool. Ignore late results after shutdown. Never hold a transaction
across timer ticks or acquire the offline gateway lock for assessment.

Authenticated `/gateway/status` includes the cached aggregate assessment, its
freshness and next scheduled check. Status reads never trigger an assessment.
Missing/failed/stale checks are explicit, never healthy-looking zero counts.
Only aggregate counts and a check reference are shared, not installation names,
task IDs, row IDs, prompts, responses, fingerprints or provider credentials.
Transition-only structured process logs record decision changes and recovery from
unavailable checks. Existing Docker log retention governs durability; this is not
a persistent trend store. Existing admission decisions, lifetime attempts,
cooldowns, ownership and unknown work are unchanged.

Completion means automatic assessment with accurate, reproducible reasons and
zero ledger mutation/provider I/O. No physical cleanup, automatic archive, live
gateway activation, global database optimization or production deployment.

## Research and alternatives

Official sources discovered and opened through MCP on 2026-10-15:

- [PostgreSQL maintenance](https://www.postgresql.org/docs/18/routine-vacuuming.html):
  deletion leaves dead row versions; ordinary vacuum makes space reusable and
  generally does not shrink files. VACUUM FULL rewrites and locks the table.
- [PostgreSQL size functions](https://www.postgresql.org/docs/18/functions-admin.html):
  total relation size includes indexes and TOAST. Row occupancy is not disk usage.
- [Prometheus alerting](https://prometheus.io/docs/practices/alerting/):
  prefer actionable symptoms and monitor the monitoring process itself.
- [Prometheus forecasting](https://prometheus.io/docs/prometheus/latest/querying/functions/):
  linear prediction needs observations over time. Defer exhaustion forecasts until
  a bounded, trustworthy sample history exists; do not extrapolate a single count.
- [S3 lifecycle safeguards](https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-and-other-bucket-config.html):
  lifecycle expiration blocks pending/failed replication. Our architectural
  inference: automatic deletion must await verified archive success, not mere age.
- [PostgreSQL UUIDv7](https://www.postgresql.org/docs/18/functions-uuid.html?trk=public_post_comment-text):
  use native time-ordered references. No new database or table is needed here.

| Approach | Benefit | Cost/risk |
| --- | --- | --- |
| More manual commands | Explicit operator control | Ongoing administration; easy to miss capacity pressure |
| Delete by age | Simple unattended behavior | Loses uncertain work; no verified archive; not selected |
| Automatic assessment then gated lifecycle (selected) | Repeatable and explainable; no page visit | Detection first; archive/restore evidence and deletion still need automation |

Recommended stack: modular ESM policy/repository/monitor, PostgreSQL 18 single-query
snapshots and UUIDv7, one bounded read-only diagnostic connection, cached status
and transition logs. No new infrastructure or dependency required.

Next: automatic archive creation and isolated verification with persistent machine
receipts, then idempotent bounded cleanup consuming those receipts. Keep protected
records and lifetime budgets intact. Expose concise results through the existing
Classifarr status UI when the optional gateway moves beyond local-only trials;
do not add another administrator workflow.
