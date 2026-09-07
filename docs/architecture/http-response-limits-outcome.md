# HTTP response limits outcome

Date: 2026-09-07. See the separate
[design, official sources and alternatives](http-response-limits-design.md).

## Result

The shared ESM HTTP client now supports `maxResponseBytes` for buffered GET, POST,
PUT and DELETE requests. It validates explicit budgets before dispatch, reads
decoded response bytes incrementally, rejects before retaining bytes over budget,
cancels failed consumption and releases the reader lock. A single growing buffer
avoids accumulating one retained object per tiny chunk. Its unused capacity is
zero-initialized. Content-Length does not control enforcement.

Every OMDb request uses a fixed **1 MiB decoded-body budget**, including title,
IMDb-ID, search, health and connection probes. The existing image-download
`maxBytes` option now uses the same reader; image embeddings retain their **10 MiB**
limit. Neither path requires an operator setting or new dependency.

Oversized responses throw `HTTP_RESPONSE_TOO_LARGE` with a fixed message and numeric
budget, including when the upstream HTTP status is an error. No partial body,
request URL, credentials or response headers are retained in that error. OMDb
keeps its existing committed reservation and does not immediately retry, report
missing metadata, claim quota exhaustion or report healthy service. Health
distinguishes oversized responses from unreachable transport using existing fields.

JSON/text decoding happens after bounded consumption. Parsing runs separately from
body I/O, so only malformed, fully received JSON becomes null. An interrupted or
timed-out transfer remains an error. Buffered requests and binary downloads retain
their request deadline through body consumption, with normalized timeout codes.
The custom Undici fetch/Agent pair is disposed after consumption or cancellation.

There are no public endpoint changes, database migrations, new operator steps or
changes to classification routing or independent-study readiness gates.

## Scope and compatibility

An omitted budget preserves the successful size contract for other shared-client
callers. Those include library inventory pages, embedding responses and generated
content; their legitimate maximum sizes have not yet been measured. They remain
unbounded and are not claimed as protected by this change. Successful `httpStream`
responses remain caller-owned streams. Its error body still has no byte budget.
Binary HTTP errors are cancelled without collecting their bodies.

Budgets count decoded bytes, not characters or compressed wire bytes. Compressed
content can therefore fail even when its declared length is small, while valid
compressed content remains acceptable when compression overhead exceeds the
decoded budget. Zero permits only an empty body. Negative, fractional, nonnumeric,
nonfinite and unsafe-integer budgets fail before HTTP dispatch.

The limit bounds retained response bytes and subsequent parser input, not total
process memory. Native transport buffering, the current read chunk, string/JSON
allocation, concurrent requests and decompression work are additional resources.
Unknown provider error wording and existing bounded background retry/fallback
policies retain the prior response-classification behavior.

## Validation

Focused validation passed **97 tests across five suites** in 2.767 seconds.
Tests use real local HTTP and constructed response streams with fixture data;
no real provider credentials or paid requests are involved. Coverage includes:

- Exact and zero boundaries, invalid budgets before dispatch, many one-byte chunks,
  split multibyte UTF-8 and BOM handling, missing/misleading Content-Length.
- Chunked responses, compressed expansion, compression overhead, oversized HTTP
  errors and preservation of normal in-budget error envelopes.
- Cancellation of a continuing server response, cleanup rejection, reader unlock,
  deadlines after headers and custom transport disposal after cancellation.
- JSON/text/empty response behavior, unbudgeted large responses and caller-owned
  successful streaming responses.
- All OMDb request budgets, failure health semantics and one quota reservation
  without immediate retry on a size failure.

Backend typechecking, scoped ESLint, production dependency checks and ESM static
import/mock-shape checks passed. The full backend suite passed **31,438 tests across
1,098 suites** in 206.262 seconds, with two workers and 512 MB idle worker
recycling. Documentation lint passed across 1,083 Markdown files. No client API
contract or database schema changed; existing backend route and quota regressions
were included in the full run.

Final Compose results will be recorded after validation completes.

## Open PR availability

GitHub MCP returned an empty open-PR collection at task start. There was no PR
population for random selection; no closed PR was substituted or merged.

## Recommendation stack and next item

Keep existing TLS and request deadlines, a shared decoded-byte reader, explicit
caller budgets, early cancellation, fixed errors, then provider payload validation
and existing retry/quota admission. This limits metadata/image payload handling
without new dependencies or operator input. The tradeoff is deliberately scoped
coverage: unbudgeted callers still require response-size assessment before caps
can be rolled out safely. A universal small limit could break inventory reads or
valid embedding batches; post-buffer checks cannot prevent the initial allocation.

Next, honor caller cancellation for buffered requests. The existing cloud embedding
adapter passes `signal` to `httpPost`, but the shared request helper currently
ignores that option and creates only a timeout signal. Compose the caller signal
with the request deadline, reject pre-aborted requests before dispatch, cancel
in-flight body reads and ensure explicit cancellation does not enter retry loops.
This is a concrete existing contract gap; it should not add operator configuration.
Assess budgets for remaining providers as a subsequent compatibility task.

No release or tag is created.
