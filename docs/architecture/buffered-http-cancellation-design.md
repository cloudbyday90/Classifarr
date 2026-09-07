# Buffered HTTP cancellation design

Date: 2026-09-07. This is the next fix identified in the
[response limits outcome](http-response-limits-outcome.md). Implementation and
measured validation belong in the separate outcome document.

## Problem and scope

Cloud embedding adapters and the direct Ollama embedding adapter already pass an
AbortSignal to buffered HTTP requests. The shared helper ignores it, so cancelled
work can continue using sockets, decoding responses and waiting between retries.
Recent changes established reliable provider selection, atomic local OMDb quota,
provider response classification and decoded response budgets. This change builds
on those contracts without adding operator input or classification authority.

Honor the optional signal for buffered GET, POST, PUT, DELETE and binary downloads.
Keep the independent request timeout active through response consumption. Add an
optional signal to the existing retry wrapper and forward embedding signals to it.
Leave caller-owned successful streaming responses under their existing controller.

## Official guidance and decisions

Sources were discovered/read through web tools on September 7, 2026. Living pages
can change; this is a review at that date, not a claim about the rest of September.

- [Node.js 24 AbortSignal documentation](https://nodejs.org/docs/latest-v24.x/api/globals.html)
  documents native timeout and signal composition, including preservation of the
  first abort reason. Use these APIs already supported by the pinned runtime;
  avoid hand-maintained listener/timer lifecycles and new dependencies.
- [Node.js promise timers](https://nodejs.org/docs/latest-v24.x/api/timers.html)
  support cancelling a pending timer with an AbortSignal. Use this for backoff,
  then normalize cancellation without retaining the caller's arbitrary reason.
- The [Fetch Standard](https://fetch.spec.whatwg.org/) specifies early rejection
  for an aborted request and errors the readable response body on abort. Apply
  one composed signal to dispatch and the entire buffered consumption lifetime.
- The [Streams Standard](https://streams.spec.whatwg.org/) specifies reader
  cancellation and lock release. Preserve the existing bounded reader's cleanup
  and dispose the custom Undici Agent after consumption or failure.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) recommends web
  standards, complete API documentation and compatible API evolution. Applying
  this guidance here means documenting the optional signal and error contract;
  no public REST endpoint, response schema or UI change is needed.
- [OWASP API4 resource consumption guidance](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)
  recommends time/resource limits. Our inference is that cancellation should
  complement existing deadlines and byte budgets, including retry waits, instead
  of merely rejecting a promise while underlying requests continue.

## Contract and implementation

A small ESM cancellation utility composes the caller signal and native timeout.
Omitted or null caller signals retain timeout-only behavior; invalid non-null
signals fail before dispatch. Pre-aborted calls fail before serialization or
custom transport allocation. The first signal to abort determines the result:

| Condition | Result | Retry behavior |
| --- | --- | --- |
| Caller aborts, including a custom TimeoutError reason | AbortError / ABORT_ERR with a fixed message | Stop |
| Internal request deadline expires first | ETIMEDOUT | Existing bounded transient retries remain eligible |
| Response exceeds explicit byte budget | HTTP_RESPONSE_TOO_LARGE | Existing size failure behavior |
| Complete upstream HTTP error | Existing status, headers and data envelope | Existing status policy |

Compare the composed reason with the private deadline reason to distinguish the
first source. Do not decide using only the caller's eventual aborted flag: it may
abort after the deadline. Caller cancellation errors contain no original reason,
cause, response body, URL or credentials. The caller can inspect its own signal
if it needs the original reason. Existing transport errors retain their contract.

The retry wrapper checks cancellation before each attempt and before scheduling
another retry. Its promise timer receives the signal. Explicit abort names/codes
take precedence over retryable messages, network codes and HTTP statuses. Both
cloud and direct-host Ollama embedding retry loops pass their existing signal.
Retries cannot undo upstream work already accepted or guarantee avoided billing.
An arbitrary wrapped operation must itself cooperate with cancellation while it
runs; the retry wrapper governs admission and backoff, not its implementation.

## Alternatives and recommendation stack

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Native signal composition plus abortable backoff | One cancellation lifetime, supported runtime APIs, no new dependency | Requires distinguishing caller cancellation from deadlines | Implement |
| Replace timeout with caller signal | Minimal code | A non-aborted caller can remove the deadline | Reject |
| Race a rejection promise against HTTP | Simple caller response | Request/body work can continue after rejection | Reject |
| Custom listeners and timers | Full control | More cleanup and race handling to maintain | Unnecessary here |

Recommended stack: existing TLS verification and quota admission; caller signal
plus request deadline; existing decoded-byte budgets and reader cleanup; fixed
cancellation errors; cancellation-aware retry admission/backoff; provider payload
validation. Preserve the existing inventory and independent-study gates.

## Validation plan

Use real loopback HTTP fixtures for cancellation before headers, during bounded
and unbounded JSON/text/binary reads, and through both native and package Undici
transports. Check pre-aborted dispatch suppression, custom reason sanitization,
first-abort precedence, retained timeouts and connection closure. Exercise the
actual embedding helper with actual retry logic, including cancellation during
Retry-After backoff, and retain regression checks for successful and transient
requests. Run backend checks, rebuild Compose without cache from clean source,
and perform local fault fixtures plus authenticated read-only inventory/settings
smokes. Never use paid provider calls as test fixtures.
