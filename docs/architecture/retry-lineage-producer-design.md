# Fresh retry lineage producer design

November 15, 2026 (America/New_York). Agreed complete first batch from main
`68c844ed087d7b85d23767a4a1468c4e0d84b60d`. The first behavior boundary is
confirmed: use fresh capture or explicit absence, without adding provenance-only
links. Final shared understanding was confirmed before runtime implementation.

This follows [exact retry-target admission](retry-target-admission-outcome.md).
The existing positive INTEGER target contract remains unchanged.

## Established gap

The retry transaction locks its source History row and runs the existing
eligibility and duplicate-task checks. It reads current request/webhook links
before clearing them and inserting the new classification task.

`captureRetryLineage` returns a new object for populated normalized ID lists, or
null if both normalized lists are empty. The orchestrator currently assigns
metadata.retry_lineage only for a truthy capture. A null result therefore leaves
an inherited lineage object in place, and buildRetryPayload forwards it to the
new task. Later classification preserves that field and invokes the rebinder
after inserting the replacement History row.

Three baseline unit suites pass 95 tests. Five private diagnostics using the
production database factory and isolated PostgreSQL establish:

- A source with no current supported references can queue inherited reference IDs
  and an inherited original classification ID. Calling the actual rebinder then
  moves unrelated owned fixture rows and updates the inherited original outcome.
- An already lineage-free retry omits the field and creates no provenance-only
  replacement link through the rebinder.
- Populated fresh capture replaces inherited fields for both admitted direct
  numeric and canonical string targets.
- Capture rejection rolls back earlier eligibility-callback DML, queues nothing
  and invokes no enrichment follow-up.

These are synthetic local reproductions, including a direct rebinder call; they
are not a demonstrated production incident, attacker path or full AI/routing run.
The diagnostic fixtures preserve the current History constraints.

## Confirmed behavior and minimal implementation

For newly queued retries, use only the successful current capture in the metadata
supplied to the existing payload builder. Create a shallow task-building copy
immediately after capture. Replace its lineage with the exact populated capture,
or remove the property when capture is null. Pass that copy only to
buildRetryPayload. Reuse the existing orchestration and modular payload/state
leaves; a new helper or file is unnecessary for this small ownership correction.

Do not mutate or rewrite source metadata to sanitize the new task. Keep the
original metadata object for other existing uses, including postcommit follow-up.
The follow-up also receives the fresh retry payload separately. Its current
enrichment builder does not read metadata.retry_lineage; all of its displayed and
queued fields must remain unchanged.

This also means successful populated capture no longer mutates the original
in-memory metadata object's lineage as an incidental side effect. Array metadata
remains an array for other users; the existing payload builder reads named fields
and does not serialize its numeric keys or inspect the container's array identity.
Prove that compatibility explicitly rather than introducing a cloning framework.

Fresh populated captures retain their current shape, ID types, ordering and
consumer behavior. In particular, a canonical string direct target remains a
string in freshly captured original_classification_id. Do not add a schema
version, new payload field, synthetic original ID, receipt, read, or SQL statement.
Leave generic payload-helper callers and the existing consumer untouched.

## Absence, failure and completion

Null means **filtered-empty capture** under the existing collector. It is not
proof that both queries returned zero rows: toPositiveInt still filters rejected
values. Preserve that parser/filter behavior, the two SELECTs and their order,
and their existing unbounded result arrays. This batch adds no lineage size limit
or stronger exact-reference validation claim.

Do not catch a capture/query rejection as absence. Failure still escapes through
the owning retry transaction and yields the existing retry_failed envelope.
Cleanup, task insertion, receipt callbacks and postcommit follow-up must not
proceed after capture failure; earlier transactional writes must roll back.

For valid work preserve row/identity locks, source eligibility/readiness,
duplicate-task checks, cleanup order, budget rules, task insertion and retry
counts, receipt hooks, source status/outcome updates, enrichment follow-up and
result shapes. Skipped targets never reach this payload assembly.

Keep waiting for the ordinary transaction. Delayed or lost COMMIT acknowledgement
can leave a durable task with a failure result; add no detached work, refund,
consumer replay or new recovery authority. Existing transaction, scheduling,
cancellation, resource and attempt limits remain unchanged. The task retains its
existing queue lifecycle; there is no new retention or recovery process.

Successful filtered-empty capture omits lineage rather than emitting an envelope
containing only original_classification_id. The latter is actionable: the
rebinder would add replacement_classification_id to the original History outcome,
which History presentation and historic receipt reconciliation consume. The user
chose to preserve the existing absence of that additional write for this batch.

## Explicit limits and next boundary

Current capture observes associations; it does not establish lasting reassignment
authority. Its separate SELECTs do not lock the reference rows. Another writer
can move a captured row before cleanup or consumption. The existing rebinder:

- Parses IDs permissively and updates references by ID without current-owner,
  source-item, task or receipt predicates.
- Executes separate reference writes after the replacement History INSERT has
  committed; no transaction makes reassignment and provenance atomic.
- Catches failures, and does not require recordOutcome's updated result to prove
  completion. A later failure can leave partial durable changes.

This producer correction must not claim to repair those cases, make old queued
payloads trustworthy, guarantee source-row absence, or provide atomic terminal
completion. Keep historical source metadata, already queued tasks, reference
capture admission, BIGINT expansion, broader API/Discord boundaries and UUID
migration separate. Do not infer missing ownership from current configuration or
from a prior payload's original ID.

## Verification and delivery

After final shared-scope confirmation, add a failing permanent regression before
editing runtime code. Verify:

1. Inherited object/array/primitive lineage with null capture is absent from new
   task JSON; genuinely absent lineage remains absent. Source objects/metadata
   stay unchanged except for normal retry status/outcome writes.
2. Fresh populated capture wholly replaces inherited fields, preserving raw
   direct target type, exact capture object/reference behavior and generic helper
   compatibility. Check array metadata and unchanged enrichment fields.
3. Real router/service/production-factory PostgreSQL queueing preserves response,
   authorization and receipt behavior. Passing the queued task through the real
   rebinder changes no unrelated request/webhook associations or inherited
   original outcome when lineage was omitted. No provider call is required.
4. Both capture queries' refusal paths prevent cleanup/task/callback/follow-up;
   genuine PostgreSQL failure and rollback preserve earlier owned fixture writes.
5. Concurrency, transaction/receipt rollback and delayed/lost native COMMIT
   acknowledgement retain their existing outcomes and never replay uncertain
   work. Include the new payload's omission in an acknowledgement control.

Run focused tests, fresh backend coverage and normal quality/security gates.
Reuse client evidence only if unchanged inputs and reports are actually verified;
otherwise regenerate it. CI must exercise the pushed commit itself, including
its existing browser, database, installation/routing and scanner gates. Do not
weaken ownership classifications, parser/baseline, coverage ratchets or assertions.

Use the artifact-maintenance skill before heavy work and at handoff, preserving
recovery assets, current evidence, worktrees and shared resources. Write a
separate outcome and Unreleased entry, commit/push on main and inspect that
commit's CI. No PR is open at intake; recheck before delivery and rebase only
genuinely stale applicable Dependabot work. Do not reuse a closed PR or merge one.

Add no UI, endpoint, schema, job, setting, operator CLI trigger, provider call,
live operation, routing/learning authority, historical rewrite, release or
deployment. Existing intentional and automatic application retry paths perform
the work.

## Official research and independent assessment

Discovered and opened through MCP on November 15, 2026:

- [PostgreSQL 18 row locking](https://www.postgresql.org/docs/18/explicit-locking.html)
  describes transaction-scoped row locks. Application inference: holding the
  History row does not prove continued ownership of separately read references.
- [PostgreSQL 18 isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
  distinguishes statement snapshots and transaction behavior. Preserve inherited
  isolation; do not label the existing two reads a new coherent ownership proof.
- [OWASP object-reference guidance](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html?trk=article-ssr-frontend-pulse_little-text-block)
  recommends server-side object authorization rather than relying on identifier
  complexity. Here, removing inherited references prevents this producer from
  silently carrying stale reassignment data; it does not prove full IDOR
  remediation or justify UUID migration as an ownership substitute.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)
  explains provenance and explicit unavailable-data meaning. Application
  inference: document the actual capture source and absence contract; do not
  invent provenance that invokes additional writes. No UI/conformance claim or
  provenance ontology is introduced.

Astra independently supports this producer-only copy and omission boundary,
including the distinction between filtered-empty capture and query failure. It
recommends preserving reference-free outcome behavior and leaving reassignment
ownership/atomicity for a separately agreed batch.

## Alternatives and final recommendation stack

| Option | Benefit | Cost or limitation |
| --- | --- | --- |
| Clear lineage only in a route | Small public surface | Automatic/direct callers and payload construction remain inconsistent |
| Task-only fresh capture or omission | Repairs the established stale-inheritance path at the shared producer | Existing capture filtering and downstream reassignment limits remain |
| Always emit fresh original-only lineage | More replacement provenance for reference-free retries | Adds downstream outcome writes and completion obligations; excluded by the agreed boundary |
| Version and atomically fence all rebinding now | Stronger terminal ownership and completion model | Needs decisions on ownership changes, legacy tasks, refusal and uncertain completion |
| Widen IDs or migrate to UUID now | Broader/different identifier domain | Does not repair inherited authority or partial reassignment |

Recommended stack: retain exact bounded target admission, derive task lineage
solely from current capture or omission, preserve failure/no-replay semantics,
then design explicit reference ownership and atomic terminal completion before
expanding ID domains or migrating identifiers.
