# Atomic stale-classification handoff

## Decision — 2026-10-10

Fix the scheduler's proven handoff defect before offering identity repair from a
failed maintenance task. Previously it reset every old `awaiting_decision` row to
`pending`, then separately inserted tasks. An insert failure left a pending
classification with no work. Tasks also omitted the originating history ID.
The observed legacy Unraid metadata failure has no explicit history link; title
or catalog-ID similarity is not sufficient authority to reconstruct it.

Use a small ESM repository and one data-modifying statement inside a transaction:
lock up to 100 eligible history rows with `FOR UPDATE SKIP LOCKED`, insert tasks,
and reset only rows represented by the insert's `RETURNING` result. Each new
payload includes `source_classification_id`. That field is diagnostic provenance,
not permission to replace a decision, rebind requests or replay routing.
History and queue references are decimal strings in JSON to preserve PostgreSQL
bigint identity without JavaScript number rounding.

## Contract

- Keep the existing daily schedule and seven-day threshold. Fresh installations
  with no eligible rows do nothing. At most 100 rows are admitted per invocation;
  a larger backlog continues on later scheduled runs, with no drain loop.
- Only `awaiting_decision` rows with explicit movie/TV type, positive TMDb ID and
  a nonempty title qualify. Null identity must not fall through to title guessing.
- Row locks serialize admission for the same history record. Successful rows
  become pending in the same commit; subsequent runs cannot admit them again.
- A history metadata receipt records the task ID and admission time in the same
  commit. Any existing `stale_cleanup` key prevents another automatic admission,
  even after a later status change or task retention cleanup. Recovery of those
  tasks remains a separate operator action; retry budgets are not reset. Existing
  metadata is preserved; non-object metadata is ineligible rather than coerced.
- This is per-history admission, not global deduplication of every task for a
  catalog ID. Unmodified older schedulers do not participate in this contract.
- The transaction has a ten-second statement timeout and one-second lock timeout.
  No HTTP, provider body, credential, title or raw SQL error is logged. There are
  no remote effects inside this maintenance operation; normal worker safeguards
  continue to govern subsequent execution.
- Before commit, failure, timeout or disconnect rolls back both writes. After a
  commit whose acknowledgement is lost, the changed status and task reference
  prevent this scheduler from admitting the same history row again. No immediate
  retry loop is added. Unknown errors remain visible with a fixed failure code.
- Completion means a queued task and its pending history transition committed
  together, not that classification or routing succeeded. No old tasks or IDs
  are rewritten. No schema migration, deployment repair or production run is
  needed to enable this behavior after upgrade.

## Unresolved source IDs are a separate repair domain

The read-only local cross-reference replay on 2026-10-10 inspected 11 current
observations: ten `agreement_with_missing_mappings`, one `no_typed_matches`.
31 lookups yielded 19 typed matches and 12 missing mappings; eight lookups also
returned another media type. Metadata presence does not establish a whole-work
identity. This sample is not a fresh Unraid count and does not prove all remaining
cases share one cause. Preserve source grouping across all libraries/adapters;
do not erase unmatched provider IDs or apply a scalar override to combined works.

Next: fresh source-layout and typed catalog-scope preview, followed by durable
administrator review and scope-aware consumers. Legacy failed-task identity
repair must separately bind its actual task revision and explicit operator intent;
it cannot infer a missing history relationship. See the
[mapping design](source-catalog-mapping-plan-design.md).

## Options and recommendation stack

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Reset then enqueue | Simple | Lost work on failure; unbounded pass | Replace |
| One large transaction over the backlog | Atomic | Long locks and resource spikes | Reject |
| Bounded atomic handoff with provenance | Recoverable and testable | Large backlogs take more daily runs | Implement first |
| Guess legacy links or replacement IDs | Clears errors quickly | Can repair or route the wrong work | Reject |
| Verified scoped mapping review | Preserves grouping accurately | Requires source-layout evidence and consumer changes | Next identity feature |

## Official research

Retrieved through MCP on 2026-10-10:

- [PostgreSQL 18 SELECT](https://www.postgresql.org/docs/18/sql-select.html): row
  locking and `SKIP LOCKED` support queue-style consumers; data-modifying CTEs
  communicate through `RETURNING`. The design updates each history row only once.
- [TMDb finding data](https://developer.themoviedb.org/docs/finding-data): text
  search and external-ID lookup answer different questions. Missing `/find`
  results do not prove missing descriptive metadata or justify title guessing.
- [OWASP transaction authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html):
  enforce state transitions and bind significant transaction data server-side.
  Apply that to future identity confirmation rather than trusting a client label.

## Independent PR trial

Fresh enumeration found open #555 and #556; random selection chose
[#555](https://github.com/cloudbyday90/Classifarr/pull/555), immutable head
`4cbffcb7dd726af152382a1f92edb9dc326fe349`. Trial the exact client declaration
updates: `@types/node` 24.19.2 → 26.6.4 and `undici-types` 7.24.6 → 8.9.0.
Registry integrity matches the reviewed patch; neither declares install scripts.
Do not change the Node 24 runtime or weaken its compatibility gate to retain a
Node 26 declaration update. [Definitely Typed versioning](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md)
aligns declaration major/minor with the represented library. Revert the trial if
incompatible; do not merge the PR or create a release.
