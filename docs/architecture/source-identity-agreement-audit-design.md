# Read-only source identity agreement audit

## Design — 2026-10-11

The next stage of [identity reconciliation](source-identity-reconciliation-design.md)
is an audit, not automatic approval. Existing candidate lookup already reads every
bounded source declaration, typed TMDb matches and candidate details. Reuse that
operation and its reference/time/source revision; do not add a worker or duplicate
provider reads. A small pure ESM projection reports whether all parent identifiers
agree in TMDb, and every reason that prevents that conclusion.

Catalog agreement requires one available, source-declared TMDb work, at least one
external-ID confirmation, and exactly that same typed work for every declaration.
Missing results, unsupported movie TVDB lookups, other-scope results (including
mixed-scope responses), ambiguous lookups, unavailable details and multiple
candidate works all block agreement. Two different direct TMDb declarations cannot
be overridden by several external IDs agreeing on just one. No title, library
name, first candidate or confidence score selects a winner.

This is a parent-ID screening result from one catalog, not independent TVDB/IMDb
verification or proof that conflicting source IDs are aliases. Even a positive
result has `automaticRecoveryEligible: false` and `completeScopeVerified: false`.
It cannot approve, materialize, clear an issue, trigger backfill or select a draft.
Complete episode membership, grouped-season coverage, repeated catalog evidence,
durable system provenance and final owned persistence remain separate work.

## Operational and security contract

Add an optional `identityAudit` to the existing `source_candidates.v1` response;
older clients ignore it and newer clients accept older responses without it.
Reuse the administrator-only, no-store, CSRF-protected, rate-limited POST and the
installation-wide source-review advisory lock. Concurrent reviews fail busy; no
queued retry. There is no new GET-side network work, startup enrollment, schema,
cooldown or scheduler state. Fresh/empty installations do nothing. Existing
operator revocations and approval authority are unchanged.

Existing limits remain: five requests per limiter window, one active review per
database, eight source declarations/eight unique candidates, at most eight find
and eight detail reads, one sequential pass, 60-second total deadline, 10-second
TMDb request timeout and 1 MiB response limit. Source and configuration revisions,
active administrator and cancellation are checked before returning. Source adapters
retain their own response bounds; unsupported adapters fail closed. Provider I/O
stays outside database transactions. No automatic retries or durable budget reset.

An outage, rate limit, malformed response, cancellation, lost lock or deadline
returns existing sanitized failure guidance, never partial agreement. A successful
404 lookup is absence of a catalog match, not proof of a stale source identifier.
Missing evidence and contradictions return explicit fixed blockers. Unknown errors
retain the existing generic failure contract; no raw provider errors, credentials
or source URLs are added. Nothing is persisted by the audit. Reads may be repeated
explicitly after a failure; interrupted work has no write to replay after restart.

The client validates the optional contract and rejects contradictory positive
claims. Use a separate audit section and concise live-region result, without
moving focus or selecting a candidate. Keep per-ID lookup details available and
preserve unresolved counts. Cancellation/source changes discard the whole result.

## Verification and next step

Test TV/movie agreement and each blocker, mixed outcomes, malformed contracts,
stale source/configuration/actor, busy/cancel/deadline and no additional reads.
Extend the real PostgreSQL lock/read-only check and HTTP transport tests; verify
keyboard use, announced outcome and 320/390 px reflow. Run both coverage suites,
the ratchet, normal quality gates, no-cache local image evaluation and isolated
schema dump. Do not mutate Unraid or shared Plex/Ollama.

| Option | Advantage | Limitation | Decision |
| --- | --- | --- | --- |
| Reuse candidate lookup for explicit screening | No extra provider calls or background load; explains abstention | Catalog agreement alone cannot authorize recovery | Implement now |
| New background audit scheduler | Can eventually cover deployments unattended | Needs durable admission, provenance and whole-scope proof | Defer |
| Automatically approve one popular candidate | Fewer clicks | Conceals missing or contradictory declarations | Reject |

Next, combine only positive parent screening with complete scoped evidence under
one fresh revision, then design durable system verification and bounded backfill.
Do not migrate local human approvals into other installations.

## Official research and PR trial

Sources discovered and opened through MCP on 2026-10-11:

- [TMDb Find By ID](https://developer.themoviedb.org/reference/find-by-id) returns
  multiple object types and supports TVDB for TV, not movies. Typed scope matters.
- [Node 24 AbortSignal](https://nodejs.org/docs/latest-v24.x/api/globals.html)
  documents deadlines and composed cancellation; preserve the existing transport.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  supports programmatic announcements without moving focus.
- [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) describes
  declaration version alignment with the represented library.

Fresh open-PR enumeration returned #555/#556. `Get-Random` selected
[PR #556](https://github.com/cloudbyday90/Classifarr/pull/556), still at
`a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`. Retest its exact Node types 26.6.4 /
undici-types 8.9.0 diff locally. Registry metadata has no lifecycle scripts for
these packages. Restore the trial if Node-24 typechecking or the runtime-major
guard fails; do not weaken either guard. No merge, version bump or release.
