# Failed-task identity checks

## Finding and scope

On 13 October 2026, a failed movie classification on Unraid still referenced a
TMDb record returning 404. The same credentials successfully read configuration.
The task predated the release; the newer diagnostic correctly identified its
missing record. Upgrading diagnostics did not repair catalog identity.

Official Disney and BBFC records establish that Endgame Encore is a real 2026
re-release with multiple presentations. They do not establish a replacement
TMDb ID, a catalog merge, or the identity of the operator's particular item.
Do not silently replace editions, guess from titles, or alter Plex/Unraid data.

The first implementation closes the evidence gap in Command Center, for any
failed movie or TV classification regardless of library or media server. It
checks the **saved typed ID**, without classification, routing, remapping,
attempt resets, history edits, provider writes, or background recovery.

## Options and recommendation stack

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Repeat classification | Existing action | Repeats the same missing-ID failure | Not a diagnostic |
| Substitute a title match | Low operator effort | Wrong work, edition or library-learning evidence | Reject |
| Check the saved ID separately | Fresh actionable evidence, no data mutation | Does not establish a replacement | Implement now |
| Reviewed replacement with durable receipt | Auditable recovery | Needs authoritative evidence, lineage and replay protection | Next step |

Use existing Vue controls, named API functions, authenticated Express routes,
small ESM service/provider modules, parameterized PostgreSQL reads and the shared
bounded HTTP transport. The manual check needs no dependencies or schema changes.
The separate [self-healing design](queue-metadata-self-healing-design.md) adds
durable background rechecks and conservative same-ID recovery.
The [external-ID evidence extension](queue-identity-evidence-design.md) now adds
bounded candidate reads after a current 404. It supersedes the original one-read
limit below with a maximum of five reads under the same ten-second deadline,
adds linked-source revision checks and does not authorize replacement writes.

## Contract

- The explicit administrator action posts an empty body to
  `/api/queue/task/:id/metadata-check`. No external request occurs on render,
  polling, hover, GET, or refresh of queue status.
- Require an ordinary administrator access session, no API key or scoped token,
  and a currently active administrator in the database, checked again after I/O.
  Existing application CSRF protections apply; POST does not bypass them.
- Read only failed, unclaimed classification tasks at `metadata_fetch`, without
  a routing link, with a known metadata failure code and valid typed TMDb ID.
  A generic legacy failure is eligible only when its saved stage is known.
- Never accept a provider URL, replacement ID, media type, title or actor from
  the request body. Movie and TV use their separate fixed details endpoints.
- One in-flight check per application process; five requests per minute per IP.
  Use the shared TMDb limiter, one request, a ten-second provider deadline
  including limiter waiting, a 1 MiB decoded response limit and no redirects.
  Disconnect aborts work. No retries, job queue, persistent cooldown, retained
  provider-body cache or restart recovery: there are no writes to recover.
  Rate limits are process-local, not a distributed installation quota.
- Re-read the task's PostgreSQL row version and the provider configuration after
  I/O. Reject changed task/configuration or revoked actor; a concurrent retry,
  dismissal, ownership claim or ID edit must not receive an apparently current
  result. No locks/transactions span provider I/O. The result is an observation,
  not authorization for a later retry or replacement.
- Validate successful details against the exact ID and media type. Distinguish
  available, missing, unconfigured, authentication, throttling, timeout, network,
  TLS, malformed/oversized response and unknown failures. Legacy errors remain
  historical unknowns even when today's independent check returns 404.
- Return only the typed identity, task reference, saved failure code, bounded
  current observation, timestamp and minimal validated candidate. Never return
  credentials, configuration hashes, raw exceptions, provider bodies or URLs.
- UI hides technical evidence until requested, announces results and errors,
  clears results when the task changes, ignores late responses and cancels on
  unmount. A successful check never implicitly retries the task.

Completion means an administrator can distinguish a still-missing record from
a provider/configuration problem without changing durable task state. Fresh
installations have no matching task and perform no work. Existing retry and
memory/ownership safeguards remain unchanged.

## Next: reviewed identity repair

Before adding writes, establish the originating request and authoritative typed
replacement evidence. Bind an expiring server-held preview to actor, exact task
revision, original/replacement identities and configuration. Confirmation must
revalidate authority and consume the preview atomically with a durable audit
receipt. Preserve original history, reject routed/claimed/changed tasks, and
separate identity approval from an explicit routing-capable retry. Recover a
lost response by reading the receipt, never by repeating an uncertain add.
Ambiguous history linkage and edition semantics must remain unresolved.

## Official research (retrieved 13 October 2026)

These are current living documents, not an archived October snapshot.

- [TMDb errors](https://developer.themoviedb.org/docs/errors): 404 means a missing
  resource, not proof of deletion, merge, or replacement.
- [TMDb finding data](https://developer.themoviedb.org/docs/finding-data): title
  search and external-ID lookup are distinct evidence sources.
- [Disney release page](https://movies.disney.com/avengers-endgame/) and
  [Disney's Encore report](https://thewaltdisneycompany.com/news/russo-brothers-avengers-endgame-doomsday/):
  the theatrical re-release exists; neither supplies a replacement catalog ID.
- [BBFC edition record](https://www.bbfc.co.uk/release/avengers-endgame-encore-q29sbgvjdglvbjpwwc0xmtixmzk2):
  multiple classified presentation lengths reinforce edition ambiguity.
- [OWASP transaction authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html):
  significant transaction details and confirmation belong under server control.
- [PostgreSQL locking](https://www.postgresql.org/docs/current/explicit-locking.html):
  use transactional locks for future mutations; do not hold them across HTTP.

## Validation

Test real HTTP status/body/redirect/cancellation behavior, stale task and
configuration results, actor revocation, concurrency, safe failure projection,
unchanged rows in isolated PostgreSQL, route authorization, and rendered UI/API
contracts. Record build, tests and deployment limitations in the separate outcome.
