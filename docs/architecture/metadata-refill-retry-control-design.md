# Metadata refill retry control — design

Date: 2026-09-30. Follow-up to the [retry co-load finding](retry-coload-resource-outcome.md).

## Reproduced failure

Using the actual retry processor, HTTP error handling and disposable PostgreSQL
schema, an injected OMDb 503 with `Retry-After: 3600` creates a durable future
wait. The ordinary metadata-refill query still selects that analyzed item because
OMDb is enabled and its metadata is absent. A previously queued metadata task
also enters optional-provider enrichment without checking that wait. These are
two failing regression tests, not an inference from the no-op resource adapter.

## Decision

Give the existing retry controller sole responsibility for repeated optional
metadata enrichment after an item has an OMDb, web-search or legacy Tavily retry
record. A small shared, static SQL policy is used by bounded refill selection
and current-source payload preparation. No new timer, queue or singleton is needed.

- Missing local `content_analysis` remains eligible for its first local pass.
- Already analyzed items with retry records do not create redundant standard
  enrichment tasks, regardless of whether the retry is waiting, due, processing
  or terminal. Due times, credential recovery and exhausted/skipped decisions
  remain the retry controller's responsibility, not a second retry loop.
- At execution, read the same policy from the database alongside current source
  identity. Discard caller-supplied flags. Already-queued tasks can finish local
  analysis and independent TMDb work without entering optional-provider work.
- TMDb observation eligibility, source-conflict fencing, task claims, music
  exclusion, ingestion handoff and bounded cursor progression remain intact.
- Database read errors propagate; they do not become permission to call a provider.
- No retry deadlines, attempts, credentials, quotas or claim fields are rewritten.

This is admission based on the current database snapshot, not exactly-once HTTP
execution or a new distributed lease across all enrichment paths. A retry created
after the task's source read may overlap already-started provider work. Existing
provider pacing and write fencing remain necessary. Terminal records remain
effective while retained; explicit retry/reconciliation and existing retention
behavior are unchanged. A no-result adapter that creates no retry record is not
covered by this rule and must not be presented as a recovered provider.

The prior AI readiness change also reused advisory key 2023, already used by
refill/restore coordination. Assign AI readiness its own unused key 2025 and add
key-uniqueness plus real-lock regression tests. Keep existing refill/restore and
runtime-maintenance contracts unchanged. Deploy with normal instance replacement;
mixed old/new versions can use different AI mutexes, although missing-only
settings persistence still prevents overwriting an existing verdict.

## Options and recommendation

| Option | Advantage | Disadvantage | Decision |
| --- | --- | --- | --- |
| Slow refill polling | Smaller apparent load | Still bypasses retry policy and wastes tasks | Reject |
| Copy retry due/credential logic into refill | Could select only currently due work | Competing controllers, drift and duplicate calls | Reject |
| Suppress every task for a waiting item | Simple | Blocks local analysis and independent TMDb work | Reject |
| Shared retry-control policy at selection and execution | Small, restart-safe, respects existing recovery | Retained terminal records need explicit retry; snapshot is not a lease | Recommend |

## Official research

Reviewed through online source discovery in September 2026:

- [Amazon Builders' Library: timeouts, retries and jitter](https://d1.awsstatic.com/builderslibrary/pdfs/timeouts-retries-and-backoff-with-jitter.pdf):
  retries at multiple layers amplify load; choose one retry point and preserve
  bounded backoff. Applied here by respecting the existing retry controller,
  not introducing another timer or changing its delay policy.
- [AWS retry-with-backoff guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html):
  bound retries and consider idempotency. Refill observation must not reset
  retry budgets or turn terminal outcomes into new attempts.
- [PostgreSQL 18 SELECT](https://www.postgresql.org/docs/18/sql-select.html):
  `SKIP LOCKED` supports queue consumers but does not provide a general consistent
  view. Existing claim-time checks remain authoritative; selection is only a hint.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html):
  future UI should distinguish waiting, completion and failure without moving
  focus. This backend change preserves current state reporting and introduces no
  new UI or accessibility-conformance claim.

## Recommendation stack

1. Prove both failures, apply the shared policy, test recovery and independent work.
2. Cover provider early-return paths that create no retry record. In particular,
   OMDb's in-memory daily-limit short circuit and type-mismatch return need durable,
   bounded outcomes; missing credentials should not create runnable refill demand.
   Do not turn an intentional disabled provider into an endless retry queue.
3. Exercise those outcomes through a bounded provider-failure adapter in the
   isolated resource study, reporting unique items separately from attempts.
   Keep live CPU/PID limits unchanged until the corrected workload is measured.
4. Show a concise provider-wait reason and next action in existing status views.
