# HTTP response limits design

Date: 2026-09-07. Follows the
[OMDb response classification](omdb-response-classification-design.md).

## Problem and scope

The shared HTTP client currently buffers JSON/text responses before interpreting
them. OMDb's field validator runs after that allocation. Binary downloads also
check their existing size limit only after buffering the entire image.

Introduce a small ESM byte reader that enforces a caller-supplied limit while
consuming `Response.body`. Wire it into shared buffered requests through
`maxResponseBytes`, and into binary downloads through the existing `maxBytes`.
All OMDb title, IMDb-ID, search, health and connection requests receive a fixed
1 MiB decoded-body budget. Image embeddings retain their existing 10 MiB budget,
now enforced during transfer. Neither budget requires operator configuration.

Other shared-client callers include library inventory pages, model lists,
embeddings and generated content. Their successful JSON/text response sizes have
not been inventoried. Preserve their existing behavior when no limit is supplied;
do not impose OMDb's metadata budget on those different contracts. Successful
streaming generation responses retain caller-owned consumption and cancellation.

## Official research and recommendations

Sources were discovered through web tools and read on September 7, 2026. GitHub
MCP was used independently to inspect open PR availability.

- The [WHATWG Fetch Standard](https://fetch.spec.whatwg.org/) distinguishes encoded
  and decoded sizes and explains that content decoding makes Content-Length
  unreliable. Count bytes yielded by the response stream; do not use a declared
  length as the enforcement boundary. This also covers missing headers, chunked
  bodies and compressed expansion.
- The [WHATWG Streams Standard](https://streams.spec.whatwg.org/) defines reader
  cancellation and lock release. Cancel rejected consumption before disposing a
  custom transport and always release the reader lock, including after failure.
- [Node.js AbortSignal documentation](https://nodejs.org/api/globals.html)
  documents deadline signals and cancellation. Keep the request deadline active
  through body consumption, cancel rejected bodies, and preserve timeout failures
  instead of treating incomplete JSON as absent evidence.
- [OWASP API4: Unrestricted Resource Consumption](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)
  recommends maximum payload sizes and resource limits. Enforce bytes before
  decoding strings or parsing JSON; do not retain partial provider payloads in
  errors. This is a scoped boundary, not a claim of complete process memory or
  decompression CPU protection.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) recommends
  documented API behavior and avoiding breaking changes. Document the new option,
  error contract, units and unbounded callers. Applying that guidance does not
  imply W3C conformance certification.

## Reader and error contract

Only `undefined` omits a budget. An explicit budget must be a nonnegative safe
integer and must be validated before dispatch; zero permits only an empty body.
Read decoded byte chunks, reject before retaining bytes above the limit, cancel
the reader on failure and release its lock. Grow one buffer geometrically within
the configured budget so tiny chunks cannot create an unbounded chunk-object list.
Do not allocate the whole budget before receiving data.

Decode UTF-8 only after successful bounded consumption. Keep the existing
JSON-versus-text selection and malformed-JSON result for compatibility. A failed
or interrupted transfer must remain an error, not a JSON parse miss. Oversized
success and error bodies produce `HTTP_RESPONSE_TOO_LARGE`, with a fixed message
and numeric budget only; no URL, headers, credentials or partial body are retained.

OMDb must neither retry oversized bodies immediately nor turn them into a miss,
quota exhaustion or healthy evidence. The existing background retry policy and
committed quota reservation remain in force. Health reports the size failure
through its existing message and healthy/reachability fields. No endpoint or
classification routing authority is added.

## Alternatives and recommendation stack

| Option | Benefit | Cost or limitation | Decision |
| --- | --- | --- | --- |
| Check length after buffering | Minimal code | Allocation has already happened | Replace |
| Trust Content-Length | Cheap precheck | Missing/misleading/compressed lengths bypass intent | Reject as enforcement |
| One small cap for every provider | Broad immediate coverage | Can break large legitimate inventory and embedding responses | Defer pending inventory |
| Shared byte reader with explicit caller budgets | Reusable, testable, preserves unrelated contracts | Unbudgeted callers still need follow-up | Adopt |

Recommended stack: existing TLS transport and deadlines, streaming byte accounting,
early cancellation, bounded buffer growth, fixed errors, then response validation
and existing retry/quota controls. No dependency or database migration is needed.

## Validation plan

Test exact boundaries, zero/invalid budgets, split multibyte UTF-8, many small
chunks, missing/misleading lengths, compressed expansion, malformed JSON,
oversized HTTP errors, reader cancellation and lock release. Use local HTTP
fixtures to verify deadline failures after headers and custom-TLS cleanup.
Retain unbudgeted response and successful streaming compatibility. Verify every
OMDb request supplies its budget and that size failures keep one reservation and
do not trigger immediate retries. Run the full backend checks, then rebuild local
Compose without cache and use only credential-free HTTP fixtures and authenticated
read-only application smoke checks. Record results separately in the outcome MD.
