# Fresh retry lineage producer outcome

November 15, 2026 (America/New_York). Implements the confirmed
[design](retry-lineage-producer-design.md) from main
`68c844ed087d7b85d23767a4a1468c4e0d84b60d`. No release, deployment, production
cleanup or live configuration change is included.

## Result

New retry tasks use the current capture result exclusively. After successful
capture, the retry orchestrator creates a shallow task-building metadata copy.
It replaces lineage with the exact populated capture, or removes the property
when capture is null. Only that copy goes to the existing payload builder.

Source metadata remains unchanged, in memory and in its stored lineage field;
ordinary retry status/outcome writes still occur. Original metadata continues to
reach the existing follow-up, alongside the fresh retry payload. Its enrichment
builder does not consume metadata.retry_lineage, and its existing fields are
preserved. Array metadata compatibility is tested without adding a cloning
framework or new service file for this small orchestration change.

The practical correction is that a source with no current supported references
can no longer queue its inherited original/reference IDs through this producer.
Calling the existing rebinder on that lineage-free task has no lineage effects.
Fresh populated capture retains its existing shape, ordering, direct target
number/string type and consumer behavior.

Null retains its existing **filtered-empty** meaning; it is not proof that both
queries returned zero rows. Capture filters, two SELECTs, query order and
unbounded reference arrays remain unchanged. Capture failure remains failure,
not an empty fallback. The owning transaction rolls back, and cleanup, task
insertion, receipt callback and enrichment follow-up do not proceed after that
failure.

No original-only envelope is invented for reference-free retries. That would
invoke a downstream History outcome write even with empty reference arrays,
changing History links and historic receipt reconciliation. The agreed batch
preserves the existing absence of that additional write.

Locks, eligibility/readiness, duplicate-task protection, budgets, retry counts,
cleanup, receipt hooks, result shapes, scheduling and uncertain-COMMIT handling
are preserved. An accepted COMMIT with a lost reply can still leave a durable
task and a retry_failed result; no uncertain work is replayed or refunded.

## Verification

The baseline passed 95 tests across three existing unit suites. Five private
production-factory PostgreSQL diagnostics reproduced stale payload forwarding
and actual reassignment of unrelated owned fixture rows through the real
rebinder. They also verified lineage-free, fresh populated and failed-capture
controls. These were disposable synthetic rows and direct consumer calls, not a
production incident, attacker path or full provider/routing run.

Before the runtime fix, ten new unit regressions failed; a capture-failure control
passed. The permanent PostgreSQL stale-object regression also failed on the
inherited task field. After the fix, all 106 focused unit tests pass. They prove
source object/array preservation, task-only omission/replacement, exact capture
references, direct target type and unchanged enrichment fields. Existing generic
payload-helper and persistence tests retain their compatibility expectations.

Two targeted PostgreSQL runs cover eight distinct suites and 248 distinct tests.
The final producer suite passes all 15 cases, including:

- Actual retry HTTP response and task JSON, followed by the real rebinder, with
  unrelated request/webhook associations and inherited original outcomes intact.
  HTTP fixtures inject an authenticated principal; credential issuance/login is
  outside these tests.
- Populated current captures for direct numeric/string targets, and filtered-empty
  captures from nonpositive fixture IDs without changing collector admission.
- Both real capture SELECTs timing out on owned locks. Tests assert exact query
  stages, failed table and native SQLSTATE 57014 outside the service's catch.
  Earlier callback DML rolls back; cleanup, receipt and follow-up remain unused.
- Native SQLSTATE 22012 from a post-insertion receipt callback, with the observed
  lineage-free payload checked outside the caught callback and all writes rolled
  back.
- Concurrent retries producing one task/callback, and delayed/lost acknowledgement
  after a real PostgreSQL COMMIT. The durable task remains lineage-free, result
  semantics remain truthful and COMMIT is dispatched once.

Existing target admission, notification cleanup, retry execution, historic receipt
reconciliation, automatic recovery, provider deferral and notification lifecycle
controls pass alongside the new suite. No live database or provider was used.

The first fresh client coverage run had four failures in the existing Vue
subprocess controls, each near its unchanged six-second child deadline, while
other heavy validation ran concurrently. All seven focused controls subsequently
passed. A matching direct diagnostic kept the executable, working directory,
restricted environment, buffer limit and six-second deadline: all seven passed
in 1.16–1.58 seconds. Contention is plausible, not established as the cause. The
failed run is retained; assertions, test limits and dependencies are unchanged.

A second default four-worker run, after the other heavy work finished, still
failed three of the same controls near that deadline. Seven focused controls and
the seven direct probes pass, and all 1,232 client input file hashes match the
baseline. This does not establish why full default-concurrency execution fails
on this host. Both failed runs are preserved separately. Astra supports an
additional local two-worker run as bounded verification, with normal CI's
four-worker configuration retained. The installed JSON reporter does not expose
child code/signal/killed fields, so its messages are not treated as that evidence.

The complete local two-worker run passes all 488 files / 7,588 tests, including
the seven Vue controls, without increasing deadlines or changing selection,
isolation, dependencies or checked-in configuration. Its regenerated coverage
is 87.92% statements, 82.17% branches, 87.70% functions and 89.60% lines. This is
bounded local evidence, not a default-concurrency pass or a diagnosis of the
earlier failures. Both fresh coverage reports pass the unchanged coverage
ratchet. The [official Vitest CLI](https://vitest.dev/guide/cli.html), discovered
and opened through MCP, documents this worker-concurrency option.

All fourteen normal quality gates pass, including typechecking, server/client
lint, dependency analysis, ownership, policy language/maintenance, npm flags,
static imports, mock shapes and copyright. The fresh production build passes;
its eight browser cases and nineteen Chromium shared-form/pgvector cases pass.

Fresh backend coverage passes 1,955 suites / 64,070 tests with one existing skip:
89.36% statements, 86.86% branches, 90.91% functions and 89.36% lines.

Astra reviewed the design and implementation. Its verification concern about
proving the exact failed capture was addressed with query-stage and SQLSTATE
evidence; no review blockers remain. It performed read-only reviews, not test
execution. The ownership report contains no affected protected-write candidate;
its gate passes without changing manifests, parser/baseline, classifications,
unresolved debt or review cap.

Root/client audits retain zero findings; the server retains five known LOW
findings in the Jest/deepmerge chain. No dependency, install policy, scanner
exception, severity or expiry changed.

## Research, tradeoffs and final recommendation

The [design's official sources](retry-lineage-producer-design.md#official-research-and-independent-assessment)
were discovered/opened through MCP on November 15. PostgreSQL documents the
scope of locks and statement snapshots; OWASP object-reference guidance requires
object authorization rather than relying on identifier complexity. Application
inference: fresh producer data must not be confused with durable reassignment
authority. W3C provenance/unavailable-data guidance supports documenting origin
and absence accurately, without inventing additional actionable links. No UI or
conformance claim follows.

| Approach | Benefit | Cost or limitation |
| --- | --- | --- |
| Route-only clearing | Small public surface | Leaves automatic/direct producers inconsistent |
| Task-only current capture or omission | Fixes the reproduced stale-inheritance path with existing leaves | Collector and consumer limitations remain |
| Original-only envelope on empty capture | More reference-free replacement links | Adds outcome writes and completion obligations; excluded by the agreed scope |
| Atomic owner-checked rebinding | Stronger downstream authority/completion | Needs separate decisions on moved references, legacy tasks and uncertain outcomes |
| BIGINT/UUID migration first | Different or wider ID domain | Does not repair stale authority or partial reassignment |

Recommended stack: existing exact target admission, current capture or omission
for new task lineage, preserved failure/no-replay behavior, then an explicit
consumption-ownership and atomic-completion contract before ID expansion.

## Delivery and maintenance

No PR was open at intake or delivery recheck. No closed PR was reused, PR merged
or unrelated/fresh branch rebased. Unreleased and separate design/outcome
documents accompany delivery on main. The pushed commit must pass the unchanged
CI configuration, including normal client concurrency and the same-run
installation/routing receipt; local bounded execution does not replace it.

Maintenance used the pinned daemon and a fresh metadata inventory without
following reparse points; protected asset trees remained unexpanded. Recovery
assets, current evidence, toolchains, four worktrees and shared resources were
preserved. Unverified old artifacts stayed excluded. This batch retired no
files/images, pruned no containers/volumes/shared caches and claims no reclaimed
capacity.

All fifty initial container identities and image references remain present.
Image/tag entries remain 478 with no entries added or removed. The detailed
pre-heavy-work snapshot's 51 containers retain exact image, start time, state
and observed health at handoff. Shared activity added two stopped containers
between initial intake and handoff (50 to 52); those observations are not
attributed to this batch or treated as cleanup authority.

## Limits and next item

Historical metadata and already queued payloads remain unchanged. Generic payload
helper callers still preserve supplied lineage under their existing contract.
The current collector filters values, has no new size bound, and does not lock
reference rows. A fresh capture is only an observation of association at that
time.

The existing consumer still parses IDs permissively, updates references by ID
without an ownership precondition, and performs separate writes after the new
History INSERT. A moved reference can be overwritten; a later error can leave
partial durable changes, and updated:false from outcome recording is not treated
as failed completion. This batch makes no terminal-authority or atomicity claim.

Next, define what permits consumption to reassign a reference: how current owner,
source/item/task proof and already queued legacy payloads should be handled.
Settle refusal versus partial application and the transaction/completion boundary
before implementing that consumer repair. Keep provenance-only empty captures,
capture limits/admission, broader BIGINT support and UUID migration separate.

Separately investigate default four-worker Vue subprocess startup on this local
host. Focused/direct and bounded full execution pass, but the two default local
coverage runs remain failed evidence. Do not call this fixed or alter the
six-second/eight-second controls without a separately justified harness change.
