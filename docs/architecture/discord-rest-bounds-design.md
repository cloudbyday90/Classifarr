# Discord REST response bounds — design

Date: 2026-10-04. Status: implementation contract; no release or deployment.

## Evidence and scope

The installed `@discordjs/rest 2.6.2` clears its request timer after receiving
headers, before parsing the body. Its 5xx retry path does not consume that body.
The previous Undici update fixes transport defects, but does not impose an
application response-size limit or a deadline through body consumption.

Apply one shared client factory to the notification bot, connection tests and
temporary discovery clients. Preserve Discord's request serialization, payloads,
authentication, route buckets and rate-limit handling. Do not replace its nested
Undici 6 transport with the application's separate Undici 8 transport.

## Contract

- No client, timer or request is created by this adapter until an existing caller
  needs Discord. An unconfigured/disabled bot still fails admission before login.
- Wrap the SDK's public `DefaultRestOptions.makeRequest` extension point. Finish
  reading every response, including errors, before returning it to the SDK.
- Each dispatched attempt has a 15-second deadline through body consumption and
  a 4 MiB received-body limit, independent of `Content-Length`. Reject an oversized
  declared length early. Use the existing bounded body reader, not unbounded JSON
  or text accumulation. These REST endpoints exchange JSON, not media downloads.
- Permit at most 16 active attempts per client; reject excess work before sending.
  Do not introduce another queue. Existing SDK route/rate-limit queues are outside
  this cap and deadline; this is not an installation-wide memory or queue bound.
- The SDK's outer timer is a 16-second backstop. The adapter owns the normal
  deadline and removes its timer and cancellation listener on every outcome.
- Client destruction closes admission permanently and aborts all active requests.
  Calls reaching the adapter later from an SDK queue fail without network I/O.
  Do not destroy the process-global dispatcher or other clients' connections.
- Completion means the entire body has been received within both budgets. Preserve
  status and headers, including rate-limit headers, in the buffered response.
- Failures introduced here have fixed messages/codes, without response content,
  credentials, URL, caller-supplied abort reasons or raw nested exceptions.

## Outcomes and retries

| Outcome | Handling |
| --- | --- |
| 401/403/404 | Let the SDK retain its existing permanent-error behavior |
| 429 | Preserve headers/body; let the SDK own `retry_after` and bucket waits |
| Complete 5xx | Body settled first; existing SDK retry count remains unchanged |
| Deadline, oversized body, malformed JSON, cancellation | Fail without automatic replay |
| Client closed or capacity exceeded | Reject before sending; no internal retry |
| Other transport failure | Sanitized error; retain the SDK's existing `ECONNRESET` retry classification only before response headers |

Do not give a new timeout/cancellation error the SDK-retryable `AbortError` name.
A notification POST may have succeeded remotely before its response was lost;
this change must not add retries for that uncertain outcome. Existing SDK retry
policy for complete 5xx/pre-header connection reset is unchanged, not a claim of exactly-once
notification delivery. No durable job, persisted cooldown, automatic recovery,
configuration revision or ownership migration is introduced. Restart discards
in-flight work; this adapter never replays it.

## Recommendation stack and tradeoffs

1. **Bound the current SDK transport (selected).** Keeps payload/rate-limit
   compatibility and fixes body lifetime locally. Costs bounded buffering and a
   small adapter to maintain; exceptionally large legitimate replies fail clearly.
2. **Replace Discord's REST stack.** Offers deeper control, but duplicates API,
   multipart and rate-limit logic. Not justified for this defect.
3. **Only lower the SDK timeout.** Small change, but still leaves body consumption
   outside the deadline. Insufficient.

Next: design persistent notification delivery receipts and duplicate prevention.
The three notification senders save the message ID only after the remote send,
leaving a send/saved-receipt gap. The installed SDK defaults `enforceNonce` to
false. Discord offers nonce uniqueness checks for a short recent window, not
unlimited retry safety. Later review caller-level admission, SDK rate-limit waits
and ephemeral-client fan-out. Do not silently retry uncertain notifications here.

## Verification plan

First reproduce a response that sends headers promptly but exceeds the SDK's
timeout while streaming its body. Then use real loopback HTTP with the installed
adapter to test stalled/dripping bodies, declared/chunked overflow, malformed JSON,
403, 429, 5xx, cancellation, destruction, capacity, unchanged POST payloads and
healthy requests following each failure. Test admission and cleanup wiring with
mocks, and run server lint/type checks and the backend regression suite.

## Official sources

Discovered through web search and retrieved on 2026-10-04. Runtime details above
were also checked against the installed SDK; moving `main` documentation does not
establish that every newly documented option exists in this pinned version.

- [Discord.js REST options](https://discord.js.org/docs/packages/rest/main/RESTOptions:Interface):
  supported request adapter extension and SDK-owned retries/rate limiting.
- [Discord.js 14.27.0 default REST options](https://discord.js.org/docs/packages/discord.js/14.27.0/DefaultRestOptions:Variable):
  reuse the public default transport rather than importing private package paths.
- [Discord rate limits](https://docs.discord.com/developers/topics/rate-limits):
  honor provider headers and retry delays; avoid repeated invalid requests.
- [Discord message creation](https://docs.discord.com/developers/resources/message):
  `nonce` and `enforce_nonce` support short-window duplicate prevention, not a
  durable delivery receipt or an indefinite idempotency guarantee.
- [Undici guidance](https://github.com/nodejs/undici): consume or cancel response
  bodies explicitly; body mixins buffer full responses.
- [Undici dispatcher](https://github.com/nodejs/undici/blob/main/docs/docs/api/Dispatcher.md):
  body idle timeout is not an overall response deadline.
- [Node.js AbortSignal](https://nodejs.org/docs/latest/api/globals.html):
  use one-shot abort listeners and clean up cancellation resources.
