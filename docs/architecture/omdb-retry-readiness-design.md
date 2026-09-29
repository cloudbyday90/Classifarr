# OMDb retry readiness design

Decision and official-source research: September 29, 2026.

## Findings and decision

Web-search availability cannot explain OMDb. OMDb retry execution has no response
cache, uses a separately configured local daily budget, and reserves each request
atomically immediately before HTTP. An IMDb miss may require a second title
lookup. A preview is therefore eligibility for recheck, never reserved capacity.

Reuse the bounded, read-only readiness infrastructure while keeping OMDb's quota
evaluator authoritative. Add an administrator-only fixed OMDb endpoint; preserve
the web-search v1 contract. Use one native provider selector and one mounted
summary, not two continuously polling panels. Selection is not persisted.

## Contract and safety

- `GET /api/queue/omdb-retry-readiness`: the existing v1 count envelope with scope
  `omdb`, maximum 50 inspected pending rows and a sanitized `quota` projection.
  One extra row detects partial coverage; there is no whole-backlog count.
- Reuse structural item, identity, library, attempt, credential, due-time and
  dependency-cooldown guards. OMDb uses its own cooldown, not web-search's.
- Quota reports an allowlisted status, nullable used/limit and nullable local
  reset estimate. Missing/disabled, rejected or invalid configuration never
  appears as available. Credentials, IDs, titles and response bodies stay private.
- Preserve existing UTC budget semantics: an earlier dated count is logically
  reset on read, without writing; undated counts are retained. An exhausted
  undated count has no promised reset time. A future reset date is invalid.
  A retry estimate cannot precede an exhausted local budget's reset; missing
  configuration or reset provenance suppresses that estimate.
- OMDb never reports cache-ready work. A remaining request does not reserve one
  request for every ready row. Show local usage, not the upstream account balance.
- Each provider has isolated 30-second caching and single-flight observation;
  read-only transactions and local deadlines remain. No quota reservation,
  attempt, maintenance, provider probe or new worker is introduced.
- The selected view alone uses visible-minute memory-only SWR. Switching unmounts
  the old observer; late results cannot overwrite the new provider. Pause carries
  across selection and applies
  to the display, not background work. Stale/failed data hides readiness/actions.

## Official research

URLs were discovered through online search and checked during this work.

- [OMDb API](https://www.omdbapi.com/) documents IMDb/title lookups and movie,
  series and episode types; it also documents HTTPS support. This work makes no
  provider requests and does not change the existing HTTPS transport.
- [OMDb key registration](https://www.omdbapi.com/apikey.aspx) lists a 1,000/day
  free tier. Do not hardcode this for every account: use saved local configuration.
  These pages do not establish an upstream UTC reset guarantee; label local
  scheduling estimates accordingly.
- [W3C pause/stop/hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide)
  supports user control of automatic updates. Keep the pause control and native
  labeled selector; avoid hidden background polling of the other provider.
- [W3C use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color) and
  [status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  inform labeled counts, concise polite status and stable keyboard focus.
- [PostgreSQL session settings](https://www.postgresql.org/docs/18/runtime-config-client.html)
  support transaction-local read-only and deadline settings, not global changes.

## Options and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Provider-specific reader with shared bounded summary/UI | Reuses guards; preserves different quota semantics; one active poll | Partial snapshot, not execution authority | Recommended |
| Treat OMDb as another web-search provider | Less apparent UI work | Incorrect cache/quota/cooldown behavior | Reject |
| Persist all readiness or poll both full queues | Whole-backlog convenience | Invalidation, storage and repeated work | Not justified |
| Probe OMDb from dashboard | Live connectivity evidence | Consumes requests and couples display to provider failure | Reject |

Stack: PostgreSQL bounded read-only snapshots; existing OMDb quota evaluator;
small ESM projection/services; fixed Express routes; named client API methods;
memory-only Vue SWR; native selection and CSS chart; unit, PostgreSQL and browser
regressions. No new dependency, migration, release or live deployment is needed.

## Follow-up

Evaluate OMDb pre-claim admission: currently it can claim a retry before learning
that quota is unavailable, then persist a deferral. Reuse the quota evaluator in
a bounded worker scheduling hint before claim, retaining atomic quota reservation
and ownership checks at execution. Do not use the cached dashboard snapshot as
write authority. Verify that exhausted/off providers cause no new claim just to
defer it, restored configuration resumes eligible work, concurrent workers cannot
overspend the last request, and a second title lookup still requires reservation.
