# Shared OMDb pacing design

Decision: September 29, 2026. Implementation is unreleased; no deployment.

## Root cause and scope

OMDb daily quota is transactional, but `omdbLookup.mjs` spaces requests using
process-local state. Another worker, restart or recovery probe bypasses that
timing. Provider wait hints are not shared with other callers. Merely deferring
the next request would introduce another defect: after an IMDb miss, the title
lookup could be deferred and the IMDb request repeated on every retry.

Use the existing PostgreSQL configuration lock to coordinate one durable pacing
record with daily credit admission. Retain the existing one-second local floor
as policy, not a claimed OMDb account-wide limit. No database lock spans sleep or
HTTP. A pacing wait returns without charging credit or an item attempt. The
existing scheduler resumes work; no process-local request queue is required.

Bound and validate Retry-After values, persist only timing and credential context,
and ignore late observations from replaced credentials. Recovery probes share
the same admission and transfer valid wait evidence when verification rotates
the generation. Keep explicit connection tests outside this automatic boundary.

An IMDb-not-found continuation contains a source digest, credential generation,
configuration ID and observation time, not titles, keys or response bodies.
Persist it only inside the current retry claim/source transaction. Revalidate
source, age and configuration before skipping the already-completed ID lookup;
clear it on terminal outcomes or source changes. It is a short-lived hint, not
positive metadata or permission to route. This preserves second-lookup progress
through waits and restarts without introducing a general response cache.

Read-only readiness uses the existing waiting category and retry-time fields.
Quota fields retain their daily-budget meaning. Keep the pausable SWR display,
current API shape and accessible status presentation.

## Official sources and tradeoffs

Sources were discovered with search tools or existing repository references and
opened for verification in September 2026.

- [OMDb API](https://www.omdbapi.com/) documents distinct IMDb-ID, title and search
  requests and HTTPS support. Its public page does not establish a per-second
  account-wide guarantee; the one-second floor remains our conservative policy.
- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) defines Retry-After as
  delay seconds or an HTTP date. Untrusted headers become bounded timing only;
  no upstream URL, credential or payload becomes an execution instruction.
- [PostgreSQL locking](https://www.postgresql.org/docs/18/explicit-locking.html)
  supports short, consistently ordered transactions. Configuration selection,
  pacing and quota reservation share the existing lock; HTTP runs after commit.
- [PostgreSQL transaction timeouts](https://www.postgresql.org/docs/18/runtime-config-client.html)
  supplies per-transaction lock/statement/idle/transaction limits, avoiding
  indefinite waits without changing global database settings.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22)
  describes concise, polite status updates. Reuse the current status UI instead
  of announcing every admission attempt. This is not a new WCAG conformance audit.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| PostgreSQL admission and existing scheduler | Shared across workers/restarts; no new service; atomic credits | Small transaction per HTTP attempt | Adopt |
| In-memory sleep queue | Simple within one process | Restart/multiple-process/probe bypass; waiting work accumulates | Replace |
| Redis or a separate request broker | Dedicated rate-control infrastructure | New deployment, recovery and ownership boundaries | Not justified here |
| Reserve both lookup credits in advance | Easy two-step scheduling | Charges unused title lookups and reduces usable quota | Reject |

Recommended stack: small Node ESM policy/store/continuation services,
PostgreSQL locks and database-clock deadlines, existing claim-fenced retry
processing, Express contracts and Vue/SWR observers. Admission spacing is not
exact network-arrival spacing, and external applications or old binaries are not
coordinated. Unknown ingestion ownership remains untouched.

## Verification

Use deterministic policy tests and disposable PostgreSQL for simultaneous callers,
restart, rollback/uncertain commit, quota exhaustion, configuration replacement,
stale responses, probes versus lookups, verified-generation transfer, read-only
readiness and second-lookup continuation. Test malformed headers, no-key setup,
no HTTP before commit and preservation of attempts, source and claim guards.
