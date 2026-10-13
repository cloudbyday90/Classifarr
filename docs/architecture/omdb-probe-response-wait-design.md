# OMDb probe response waits

Decision: 2026-10-12. Unreleased; no production deployment or release.

## Cause and contract

System-health and automatic SSL-recovery checks reserve a daily credit and obey
shared pacing, but their JSON-only transport discards new `Retry-After` advice.
An HTTP 429/503 or successful response can therefore leave subsequent callers
unaware of the provider's requested wait. Ordinary lookups already save it.

Use the existing response observer and PostgreSQL pacing store, with an injected
database instead of a second persistence implementation. Add an optional response
metadata callback to the bounded health transport. Only admitted OMDb probes
install it; other health callers retain their existing behavior.

- No new work on empty/disabled installations. No schema, dependency, endpoint,
  background timer, historical backfill, or UI contract change.
- One admitted request, one response observation, no extra provider request or
  credit debit. Await observation before returning the probe result. Pass only
  status and headers, never response bodies, into the observation callback.
- Observe completed success and HTTP-error responses. Network/TLS failures,
  cancellation, body-size rejection and incomplete responses have no completed
  response in the current HTTP client; do not fabricate wait evidence for them.
- Reuse the parser: bounded 256-character header, integer seconds or IMF-fixdate,
  thirty-day maximum, sixty-second fallback for HTTP 429 without a positive valid
  delay. These are existing application policies, not an OMDb-specific SLA.
- Save only for the committed admission's configuration ID and credential
  generation while it remains active. A key edit, replacement or disable during
  HTTP cannot impose the old response's delay on a new configuration. Never
  shorten a matching wait. Share it across lookup, health and SSL callers using
  the same database; separate installations sharing an API key remain uncoordinated.
- Preserve the one-second admission floor, daily accounting, local SSL single
  flight and existing cadence. Shared admission limits rate, not total in-flight
  concurrency. Requests admitted before the new observation cannot be recalled.
- HTTP stays outside transactions: fixed HTTPS target, verified TLS, no redirects,
  ten-second deadline, 1 MiB decoded body. Persistence reuses one-second lock,
  five-second statement, ten-second idle and fifteen-second transaction limits.
- Persistence failure emits the existing fixed, deduplicated warning. It neither
  retries the request nor turns valid provider evidence into a provider outage.
  The committed credit and base pacing remain, but the unsaved longer wait cannot
  be promised across callers or restart. Do not log headers, credentials or errors.
- Permanent auth/quota responses keep their existing classification; transient
  HTTP rate limits still defer recovery. A confirmed miss proves TLS recovery
  only, not healthy metadata retrieval. Unknown/malformed responses stay unknown
  or deferred. Do not weaken credential, ownership, TLS or memory safeguards.
- A crash before persistence may lose new wait advice but never refunds the
  admitted credit. A committed wait survives caller recreation and process restart.
  No retry of uncertain writes or reconstruction of unrecorded historical traffic.

Completion means both admitted probe paths publish waits to the same fenced store
and subsequent independent callers defer without spending another credit or
sending HTTP. Existing response classification and configuration fencing remain.

## Research and options

Official sources discovered and opened with MCP search on 2026-10-12:

- [RFC 9110, HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)
  defines `Retry-After` as seconds or an HTTP date before a follow-up request.
- [RFC 6585, section 4](https://datatracker.ietf.org/doc/html/rfc6585)
  permits rate-limited responses to carry that advice without specifying the
  provider's identity or accounting scope. Store wait metadata, not a cached 429.
- [OWASP API4 resource consumption](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/)
  recommends bounded execution and third-party resource consumption. Keeping the
  existing request, body and transaction bounds is our application of that advice.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Shared bounded response observation | Consistent waits, restart-safe, no new infrastructure | One short write when a wait is present; not atomic with remote HTTP | Adopt |
| Process-local cooldown | Simple | Lost on restart; competing callers bypass it | Reject |
| Retry immediately inside the probe | Can mask a transient failure | Extra spending, conflicts with requested wait | Reject |
| Reuse attributable lookup results | Fewer synthetic requests | Needs credential, age and outcome policy | Next investigation |

Recommended stack: existing quota admission, bounded transport metadata callback,
shared observer factory, credential-fenced PostgreSQL cooldown, unchanged safe
result classifiers. Do not broaden this increment into probe-cadence changes.

## Verification plan

Test callback-once semantics on success/HTTP failure and no callback for incomplete
responses; parser limits and sanitized persistence failures; both admitted paths
using committed context. Real loopback HTTP plus disposable PostgreSQL must prove
cross-caller waits, no extra debit, reconstruction persistence, longer-wait retention,
and credential/disable races. Run regression and quality gates, then an exact
no-cache image with isolated fixtures and backed-up local Compose replacement.
Record results and evidence limits separately in the outcome document.
