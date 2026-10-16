# Gateway archive capacity and interruption qualification

2026-10-16. Approved scope: local synthetic qualification and fixes for reproduced
defects, not live cleanup, a release, or activation on Unraid/shared Ollama.

## Decision and research

Keep the existing Node ESM/PostgreSQL 18/native UUIDv7 stack and isolated workers.
Extend the existing image rehearsal with separate modular fixtures, real bounded
worker containers and observed process interruption. Do not add production fault
injection switches, administrator controls, dependencies or new tables.

Official URLs were discovered by search and opened on 2026-10-16. The connected
MCP web search returned an empty error twice; the built-in web search supplied
the official results instead. GitHub MCP returned no open Classifarr PRs.

| Approach | Benefit | Cost / decision |
| --- | --- | --- |
| Actual constrained containers and native tools | Exercises memory, storage, subprocesses and durable restart behavior together | Slower local tests; selected |
| Mock failures or manually changed SQL alone | Fast, deterministic narrow-state coverage | Cannot establish a real worker interruption; complementary only |
| Raise limits until tests pass | May accommodate larger history | Changes approved operating policy and masks boundaries; not selected |
| Existing snapshot and isolated restore stack | Reuses reviewed ownership and recovery contracts | Not a replacement for off-host application backups; selected |

PostgreSQL describes consistent concurrent dumps and exported snapshots in
[pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html). Its
[restore warning](https://www.postgresql.org/docs/18/app-pgrestore.html) reinforces
keeping the trusted-schema/data-only restore inside the isolated verifier.
Docker documents that [tmpfs consumes the container memory budget](https://docs.docker.com/engine/storage/tmpfs),
that [equal memory/swap limits disable swap](https://docs.docker.com/engine/containers/resource_constraints),
and that [container kill sends SIGKILL](https://docs.docker.com/reference/cli/docker/container/kill/).
Those properties must be observed in the fixture, not inferred from a successful
small restore.

## Contract and scenarios

Normal installations remain unchanged. Only explicitly owned disposable test
containers, databases and volumes are eligible. No live credentials, provider
requests or published ports; source, coordinator and verifier have no network.
Keep the coordinator at 256 MiB/0.5 CPU/32 PIDs and verifier at 1.5 GiB/one CPU/
64 PIDs with 1 GiB tmpfs. Capture kernel resource limits and peak/event counters.

Exercise a 99,998-binding fixture, concurrent synthetic admissions reaching
100,000, real export/restore, and three generations with two retained verified
copies. Populate all seven tables and preserve the admission/recovery cycle.
Native UUIDv7 generates all new fixture row identities. Synthetic bulk inserts
establish history; they do not represent actual provider calls.

Separately test content above 256 MiB, the 1 GiB archive reservation boundary,
and insufficient actual free space. Binding count is not a byte guarantee:
wide records/fanout can exceed the independent content limit first. A safe
bounded refusal is required; this does not qualify that oversized shape as
successfully restorable. No automatic increase of timeouts, sizes or resources.

Observe a committed export job, the real packaged pg_dump process and a partial
file before killing the coordinator. Restart must preserve the attempt and mark
the uncertain export interrupted, never infer safety from an expired deadline.
Observe real pg_restore/private PostgreSQL before killing the verifier. Restart
gets fresh tmpfs and may repeat this read-only verification of the same archive;
it must not create another export attempt or accept a partial result. Graceful
cancellation must wait for child exit and preserve persistent cooldowns.

Use explicitly disclosed filesystem/SQL state reproduction for the narrow
receipt-publication and retirement boundaries. Never claim those are real
kill-at-instruction tests. Verified copies, immutable history and lifetime
inference attempts remain intact except for declared synthetic admissions.
Every result retains `purgeAuthorized: false`.

## Admission, failure and completion

### Reproduced revision defect

The baseline capacity exercise exposed intermittent export rejection and an
oversized export retried immediately instead of respecting cooldown. A real
PostgreSQL regression test, reversing only returned count rows, reproduced
different revisions for identical admission state and counts. PostgreSQL does
not guarantee [unsorted row order](https://www.postgresql.org/docs/current/queries-order.html)
or [UNION branch output order](https://www.postgresql.org/docs/current/queries-union.html)
(official pages opened 2026-10-16). The previous revision hash serialized the
count object in database-return order.

Normalize the seven count keys in their original serial-query order before
hashing. This preserves existing serial-order hashes. For existing jobs,
recognize a legacy hash only if it matches the exact current admission JSON and
counts in one of the fixed seven-key permutations (at most 5,040 encodings).
Include proven aliases in unchanged checks, cooldowns and the combined attempt
budget. Do not rewrite old rows, manifests, receipts or deadlines. New job
ordinals use the greater of matched row count and persisted maximum attempt;
the existing SQL three-attempt constraint remains the final bound.

Canonicalizing alone is simpler but could refund legacy retry budgets. Treating
every old job as the same revision would block genuinely changed history.
Exact, bounded compatibility matching is selected instead. This is schedule
identity, not an integrity proof: full content hashes and restore verification
continue to govern archive acceptance and rotation.

### Unchanged operational policy

Existing scheduling remains initial nonempty, daily changed history, or hourly
at 80,000 bindings. One coordinator owns its dedicated advisory lock. Existing
three-attempt revision limit and persisted five-/30-minute retry waits remain.
Fresh/empty, unchanged and pending histories do no new export work. Identity or
configuration drift stays blocked. Cancelled export is failed with cooldown;
unknown termination is interrupted/pending; an invalid archive cannot replace a
verified one. A verifier restart is not evidence that an export writer stopped.

Bound each fixture command and observation window. Stop only exact owned test
containers and verify cleanup, including failure paths. If a boundary is missed,
fail that exercise rather than claiming coverage. Record actual image revision,
sizes, timing, memory and skipped cases in a separate outcome document. Run
affected quality checks, no-cache local Compose build and local health evaluation.
Commit/push main only; no release or merge.

Next depends on the results: address any measured capacity/crash gap first, then
design bounded receipt-backed live-history cleanup with fresh eligibility checks
and archive pins. This work does not grant purge authority.
