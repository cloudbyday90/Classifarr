# Cache-aware retry dispatch design

## Problem and decision

Retry processing claims an item before checking provider availability and stops
the batch on a provider wait. Cached work behind that item can be delayed. Cache
identity also includes mutable provider-health timestamps, invalidating useful
responses after health updates.

Use a bounded read-only page before claiming web-search retries. Reuse the claim's
eligibility predicate, including movie/TV scope, active libraries, source-conflict
authority, credentials, due times and existing dependency cooldowns. Read at most
50 candidates and 150 cache keys. Inspect current provider pacing without taking
admission locks. Only a likely cache hit or available request slot proceeds to an
atomic, ID-targeted claim. The executor rechecks cache and reserves credits under
the existing configuration/provider locks; a preview grants no authority.

A priority/creation/ID cursor prevents a waiting page from indefinitely hiding
later cached work. The cursor is an in-memory optimization, not ownership: a
restart safely starts from the head, and all claims remain database-fenced.
Continue after admission races, not after arbitrary provider failures. Preserve
existing OMDb, rejection and dependency-cooldown behavior.

Reuse one coalesced, unreferenced timer per service. New work may shorten a wait;
notifications during processing are retained for the next wake. A page continuation
waits at least one second, and long provider waits are rechecked within five
minutes. This bounds Node timer delays and notices configuration/cache changes
without a new daemon. Empty eligible queues schedule no additional wake-up.

Cache identity version 2 excludes root-level routing/health telemetry, retaining
request options, nested provider settings and credential generation. Existing
version-1 entries expire naturally; do not trust an ambiguous legacy cache key.
Cache peeks are read-only and do not increment usage or hit counts.

Validation exposed two related boundary mismatches: nullable database years must
be omitted from the optional search field, and retry trace IDs are bounded text,
not necessarily UUIDs. An additive usage-column type migration preserves existing
UUIDs as text and aligns usage with route/health trace storage. Otherwise the
best-effort usage writer silently loses cache-hit records and request completion
telemetry. Malformed requests retain per-item failure handling instead of blocking
the entire preview page.

## Alternatives and recommendation stack

| Approach | Pro | Con |
| --- | --- | --- |
| Claim then defer every item | Simple | Writes during waits; hides cache hits |
| Bounded read-only planning, selected | Preserves existing authority; bounded memory and writes | Extra read queries; restart rescans a page |
| Persistent per-item dispatch index or external broker | More precise large-backlog scheduling | Schema/index synchronization or new infrastructure |

Keep modular Node ESM services, PostgreSQL atomic claims/admission, the existing
scheduler and Vue status presentation. Measure large-backlog costs before adding
a persistent index or broker. No new API or client polling loop is needed. W3C
status guidance supports keeping ordinary waits non-interrupting and avoiding a
stream of alerts for read-only skipped candidates.

## Official research, September 29, 2026

URLs were identified using online search and official documentation links.

- [PostgreSQL SELECT](https://www.postgresql.org/docs/current/sql-select.html?trk=article-ssr-frontend-pulse_little-text-block): SKIP LOCKED is useful for queue consumers, not a consistent global snapshot; preview must not replace atomic claims.
- [Node timers](https://nodejs.org/api/timers.html): delays outside the supported range can become one millisecond; timers do not guarantee precise execution time, and unref avoids keeping a process alive.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages): communicate waiting status programmatically without moving focus or unnecessary interruption.
- [Docker Compose build](https://docs.docker.com/reference/cli/docker/compose/build/) and [up](https://docs.docker.com/reference/cli/docker/compose/up/): rebuild with `--no-cache`, then recreate with `--no-build --wait`; preserve the existing mounted data.
- [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints): inspect enforced container limits and usage, not host free memory; CPU is unrestricted unless explicitly limited.

## Acceptance

Test cache hits behind blocked work and beyond a full page, restart/rescan,
credential and cache expiry races, concurrent claims, no credit/attempt charges
for planning, stable identity after telemetry changes, changed search options,
timer coalescing/cancellation and no-provider setup. Validate real PostgreSQL,
fresh/upgrade installation, complete regression and the requested no-cache local
Compose rebuild. Document exact results separately; create no release.
