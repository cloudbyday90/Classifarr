# Radarr and Sonarr Add Reconciliation

Reviewed: 2026-10-03. Scope: movie/series routing, not file moves or downloads.

Implementation and validation: [outcome](arr-add-reconciliation-outcome.md).

## Decision

Verify provider identity and destination before calling a route successful.
An HTTP timeout says the response is missing, not that the provider did nothing.
A conflict response is a reason to read the provider, not proof of success.

Use small ESM services for resource verification, safe add-error classification
and the shared lookup/add/read-back sequence. Keep existing routing result
fields and reason IDs; no database migration or deployment change is needed.

## Contract

1. Require a valid positive TMDb/TVDB ID and an absolute destination root.
2. Read the configured provider by that ID. If the read fails or is malformed,
   do not send an add. If an item exists, verify its ID and actual path first.
3. After confirmed absence, send at most one POST. Sonarr lookup must match the
   requested TVDB ID; never substitute the first unrelated search result.
4. Read back once after a successful add, a duplicate hint or an ambiguous
   failure. Require the provider's own positive item ID, matching external ID,
   and actual path below the selected root. If a nonempty `rootFolderPath` is
   supplied, it must agree too. Unknown or mismatched state remains not routed.
5. Known add rejection, such as authentication or ordinary validation failure,
   does not trigger retry or speculative success. Report a fixed, concise error
   without provider response bodies, URLs, API keys or arbitrary exception text.

Filtered GETs use a 10-second timeout; POSTs retain a 30-second timeout. Both
limit decoded response bodies to 2 MiB and reject redirects. The add sequence
therefore uses at most two reads and one write, with no background retry loop.
Configuration defaults and Sonarr metadata lookup remain separate existing work.

Path comparison is lexical, not local filesystem access: use explicit POSIX or
Windows syntax regardless of the Classifarr host. Normalize separators/trailing
slashes, reject relative paths, control characters and dot traversal, enforce
segment boundaries, and compare case conservatively. Do not resolve symlinks,
guess mount aliases, move files, change monitoring or rewrite provider settings.
This can require review for equivalent aliases/case variants; that is safer than
claiming an unverified destination.

## Limits

This proves observed identity and placement, not who created the item, whether
search/download completed, or full settings equality. Another actor can change
the provider afterward. No exactly-once claim is made: Radarr/Sonarr do not gain
an idempotency-key protocol from a local queue token. Existing queue completion
and classification history are unchanged; a false routing result must not be
confused with automatic provider reconciliation being scheduled.

## Options and recommendation stack

| Approach | Advantage | Cost or risk | Decision |
| --- | --- | --- | --- |
| Repeat POST after timeout | Simple | Response loss can repeat effects | Reject |
| Treat conflict as success | Few requests | Wrong identity/destination can appear routed | Reject |
| Bounded read-back verification | Recovers completed adds without another write | Extra GET; unavailable/ambiguous data needs review | Adopt |
| Durable external-action journal/outbox | Can retain intent across longer outages | Schema/lifecycle complexity; still needs provider verification | Consider after this boundary is tested |

Recommended stack: strict IDs → filtered pre-read → one add → bounded read-back
→ identity/path verification → safe routing outcome. Keep existing queue claim
fencing underneath it; do not broaden queue retry authority in this change.

## Official research

- [Radarr API](https://radarr.video/docs/api/) and its
  [published schema](https://raw.githubusercontent.com/Radarr/Radarr/develop/src/Radarr.Api.V3/openapi.json)
  expose filtered movie reads and movie identity/path fields.
- [Sonarr API](https://sonarr.tv/docs/api/) and its
  [published schema](https://raw.githubusercontent.com/Sonarr/Sonarr/develop/src/Sonarr.Api.V3/openapi.json)
  expose filtered series reads and TVDB/path fields. V3 API compatibility is
  distinct from the application version. Destination validation above is our
  conservative policy, not an upstream guarantee of filesystem equivalence.
- [AWS: making retries safe](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/?did=ba_card)
  explains ambiguous responses and caller intent. Applied as a design principle,
  not an AWS dependency or a claim that these providers support idempotency keys.
- [W3C writing guidance](https://www.w3.org/WAI/tips/writing/) favors clear,
  concise instructions and errors. Preserve that in safe operator messages;
  this backend-only change makes no new UI accessibility-conformance claim.

URLs were discovered through web search and official GitHub content metadata,
then the relevant documentation/schema fields were read in October 2026.
