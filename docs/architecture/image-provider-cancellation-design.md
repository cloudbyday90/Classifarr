# Image-provider cancellation design

## Decision and scope

Propagate semantic retrieval's cancellation signal through image admission, retry
backoff, poster downloads and embedding HTTP requests. Keep successful image
evidence, configured models, weights and payload/response limits unchanged.
Cancellation is not a provider failure or permission to return partial success.

The image provider converts movie/TV posters into vectors for similarity retrieval;
it does not generate images. Local sidecar and cloud modes remain optional existing
configuration. No new service, dependency, migration, privilege, template or release
is required. Background embedding persistence without a caller signal is unchanged.

## Official research

Reviewed on 1 October 2026 for the requested September 2026 baseline. These are
current official pages discovered with search, not verified September snapshots.
Only established APIs already supported by the repository's Node 24 runtime are used.

- [Node AbortSignal](https://nodejs.org/docs/latest/api/globals.html): check before
  attaching listeners, use one-shot listeners and clean up after normal completion.
- [Node timers](https://nodejs.org/api/timers.html): abortable promise timers reject
  with AbortError. Reuse the existing signal-aware retry helper and its backoff.
- [Undici](https://undici.nodejs.org/): consume or cancel response bodies explicitly;
  garbage collection is not a reliable connection cleanup strategy. The existing
  bounded native-fetch transport already supports signals during body consumption.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  waiting, results and errors are different states. Preserve cancellation as a
  distinct outcome, not an empty successful result or provider outage. This is a
  backend change, not an accessibility-conformance claim or new UI announcement.

## Alternatives and recommendation stack

| Option | Advantages | Disadvantages | Decision |
| --- | --- | --- | --- |
| Race caller against a timeout only | Small change | Queued/remote requests still run; apparent capacity becomes inaccurate | Reject |
| Disable image evaluation | Removes image traffic | Loses intended visual evidence and changes ranking | Reject |
| Cooperative cancellation across existing boundaries | Removes abandoned queued work and stops local HTTP consumption; preserves normal evidence | Requires signal plumbing and lifecycle tests; remote computation may continue | Recommend |
| Replace provider stack with a new queue service | Could add durable admission control | New operational dependency and unnecessary migration for this defect | Defer |

1. Extract the existing in-process limiter into a small ESM queue module. Remove
   cancelled waiting entries immediately. Use one demand-driven pacing timer, FIFO
   admission and actual start times; cancelled entries reserve no future start slot.
2. Keep active concurrency charged until the underlying operation settles. Never
   free a slot merely because a Promise race rejected while transport is still live.
3. Pass an optional third `{ signal }` argument to `embedImageFromUrl`; keep its
   existing second configuration-overrides argument separate and backward compatible.
4. Reuse existing retry and HTTP cancellation. Check abort before/after asynchronous
   stages to reject late results, stop retries and prevent a cloud POST after a
   cancelled poster download. Caller cancellation must not become text-only fallback.
5. Preserve the breaker's existing AbortError exclusion and return any reserved
   half-open probe on cancellation only in the same breaker generation. Do not
   count cancellation as a successful recovery or reset real failures.
6. Test deterministic queue timing and real loopback HTTP disconnects. No paid
   provider calls or live library mutations are needed.

## Boundaries and limitations

Existing timeouts, retry counts, credentials, endpoints, image byte limits and
embedding response limits remain in force. Abort reasons are arbitrary private
data and are replaced with the existing fixed cancellation error, never logged.

Cancellation closes Classifarr's HTTP request, not necessarily remote inference or
provider billing already in progress. A provider must implement its own server-side
cancellation for that guarantee. Config loading remains an ordinary bounded database
read; cancellation is checked after it, before admission. Non-cancelled queue demand
and limiter replacement on configuration changes are not redesigned in this round.
As before, one active slot covers a logical embedding operation including retries;
pacing spaces operation starts, not each individual retry attempt.

## Requested deployment validation

After code validation, the user requested a local no-cache rebuild. Follow Docker's
[Compose build](https://docs.docker.com/reference/cli/docker/compose/build/) contract
with `--no-cache`, then recreate only the selected service with `--no-build` and
`--pull never`, waiting for health. Docker's
[Compose up documentation](https://docs.docker.com/reference/cli/docker/compose/up/?trk=article-ssr-frontend-pulse_little-text-block)
describes preserving mounted volumes when recreating a service. Retain a database
snapshot and the prior image; do not run volume deletion or pruning. This updates
the local deployment only, not the separate embedding service or a release channel.

The separate [outcome](image-provider-cancellation-outcome.md) records verification
and the next evidence-based work item.
