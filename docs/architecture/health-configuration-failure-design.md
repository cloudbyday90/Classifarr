# Health configuration-read failures: design

Date: 2026-10-12. Follows [health freshness](health-observation-freshness-outcome.md).

## Evidence and alternatives

Radarr, Sonarr, Discord and AI health checks catch database errors and return
`not configured`. Other checks expose database error messages as provider errors.
Neither establishes that credentials are absent or that a provider is down.
The detailed services endpoint also omits Arr groups without instances, which
would hide a failed configuration read even after correcting its status.

| Option | Pros | Cons |
| --- | --- | --- |
| Treat failed reads as absent configuration | Simple | Misleading; can encourage unnecessary credential changes |
| Report every read failure as provider down | Visible | Attributes an unperformed probe to the provider |
| Explicit unknown with safe diagnostic context (chosen) | Distinguishes uncertainty and gives an action | Adds a small diagnostic contract; does not repair the database |
| Retry immediately or reuse old credentials | May mask brief outages | Extra traffic, stale configuration and overlapping work |

## Recommendation stack and contract

1. Use one small ESM configuration-read boundary for all ten configured health
   checks: Discord, AI, Radarr, Sonarr, media server, TMDb, OMDb, Tavily, RAG and
   image embeddings. Validate the result rows before interpreting absence.
   Only successful empty/disabled configuration reads can report inactive.
2. A failed read returns `unknown`, a current attempt timestamp, preserved last
   success and previous status, null latency, and a bounded `failure` object.
   Never reuse cached credentials or call a provider after failed admission.
   Do not copy stale instance lists into current results; show an unknown Arr
   group in the detailed endpoint when membership could not be read.
3. Distinguish allowlisted transient connection/resource failures, schema/access
   failures, cancellation and unknown failures. Codes describe the observation,
   not a claim that retry will succeed. Schema/access errors require startup,
   migration or database-role investigation, not re-entered provider credentials.
   Unknown/unexpected failures should include the safe code and check time when
   reported upstream. Never forward raw SQL errors, query text, credentials,
   URLs, stacks or provider payloads through this new boundary.
4. Log bounded service/stage/code/check-time context on a failure transition,
   using the existing health cache to suppress repeated identical failures.
   Console-only logging avoids querying an already failing database; synchronous
   or asynchronous logging failure must not change health. Unknown image health
   must not send a recovery notification.
   Keep the safe reason visible in System, preserve last-success history and
   avoid showing unobserved RAG counts or image mode as facts.
5. Keep provider-probe results distinct from configuration failures. Existing
   provider timeouts, one configuration read per check, heartbeat cadence,
   parallelism, caches, authentication, memory limits and database readiness stay
   unchanged. No immediate retries, new timers, background repair or writes.

## Bounds and lifecycle

Admission is per existing service check. Failed configuration admission performs
one existing database read and zero provider calls. No new concurrency, attempts,
timeouts, response payload storage or durable cooldown is introduced. PostgreSQL
read limits and provider timeouts remain those of the existing callers. Diagnostic
codes and messages are fixed allowlists, independent of exception size/content.
Fresh installs retain normal inactive states after successful reads. Restart
starts unknown; a subsequent successful read/probe clears the diagnostic.

No migration, backfill, ownership lease, remote write, cancellation mechanism or
configuration-revision fence is added. Cancellation is reported as incomplete,
not provider failure. Reads can be repeated by existing scheduling or explicit
refresh; no write is replayed. Configuration changes during in-flight checks and
completion ordering remain the next deferred item. Non-configuration RAG catalog
and image-evidence fallback semantics are outside this narrowly scoped change.

## Official sources

Discovered and opened with MCP on 2026-10-12:

- [OWASP error handling](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html)
  recommends generic external errors with server-side investigation support.
- [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  supports event context, exclusion of sensitive data, safe encoding and handling
  logging failures without preventing application operation.
- [Kubernetes Pod lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)
  distinguishes unknown state when observation is unavailable. Applying that
  distinction to configuration admission here is our design inference, not a
  Kubernetes requirement for this application.
- [PostgreSQL error codes](https://www.postgresql.org/docs/17/errcodes-appendix.html)
  recommends stable SQLSTATE codes rather than parsing localized error messages.
  We map an explicit subset to safe application codes, not raw exception details.

## Completion and verification

Prove rejection/invalid-result/empty/disabled/success outcomes across all checks,
zero provider admission after failed reads, history preservation, successful
recovery, sanitized output/logs and unknown group HTTP aggregation. Verify UI and
named API contracts without new polling. Run focused tests then coverage/quality
gates, no-cache local Compose replacement, exact-image checks and isolated schema
dump; record evidence separately. No Unraid, Plex or shared Ollama mutation.

GitHub MCP returned zero open PRs at the start of this work. None can be randomly
selected unless that changes. No PR merge, release, tag or version bump is planned.

## Explicit ownership-review change

The static ownership gate found three new indirect-query sites in
`healthCheckExternalApis.mjs`. Reviewed all three literal provider selections,
the configuration-read boundary and the unchanged SQL factory/store. Each selects
the provider's fixed active-row SELECT (ordered ID, limit one); no inventory DML,
caller-controlled identifier or configuration persistence is introduced. Added
only this file's exact digest/analysis entry under `read_only_health_configuration`.
No existing digest, unresolved classification, parser, baseline revision or gate
rule is changed. The failed initial coverage run will not be counted as a pass.
