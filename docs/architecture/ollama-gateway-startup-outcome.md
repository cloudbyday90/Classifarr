# Ollama gateway startup outcome

Date: 2026-10-14. Work on `main`, no release and no live gateway activation.

## Implementation

The [design](ollama-gateway-startup-design.md) adds opt-in private-file application
startup, an application-wide scoped lifecycle and verified HTTPS between the
application and gateway. Missing configuration preserves direct mode; invalid
configuration refuses startup. Restore remains independent. Cancellation and
closure retain uncertain durable attempts instead of falling back to direct HTTP.

The gateway can bind an explicit private IPv4 interface only with TLS; plaintext
remains loopback-only. Trust and certificate identity checks cannot be disabled
through configuration. Endpoint/model allowlists, response limits, cooldowns and
UUIDv7 ledger semantics remain. No schema, consent or release version changed.

## Verification in progress

Focused startup tests passed (34), and real HTTP/PostgreSQL integration passed
(83 tests across gateway, application routing and TLS). Those include wrong trust,
IP mismatch, unsupported destinations, startup listener/timer inheritance and
shutdown retaining two attempts with an uncertain marker. No shared provider was
contacted. The test certificate generator uses a temporary OpenSSL configuration
to avoid ambient machine settings; no private key is committed.

The first full backend run exposed the expected changed-source ownership reviews
for startup and the selected environment allowlist. Both diffs were reviewed:
database admission, schema checks, SQL authority and restore exclusion remain.
Only their digests and explicit rationales were updated; no classifications,
analysis digests or unresolved writer debt were cleared. The existing source
boundary test now reads files in bounded batches of 32 to avoid serial I/O timeout.

Final suite, image, network rehearsal and local replacement results are recorded
after completion below. Do not treat this intermediate document as a passed build.

## Recommendation and boundaries

Recommend native Node HTTPS with private-CA verification, modular ESM scoped
startup, the PostgreSQL 18 UUIDv7 ledger and independent network ACLs. This avoids
an extra TLS proxy but requires operator certificate management and IP SAN upkeep.
TLS does not prevent admission bypass; provider isolation must be deployed and
tested independently. Gateway-to-provider HTTP is confined to a trusted isolated
network/loopback in the supported topology, not an untrusted LAN.

Next: design evidence-based recovery for uncertain gateway work before live
cutover. A restart, timeout or model listing cannot prove inference has stopped.
Do not add a blind clear-lock retry or reset preserved attempts.

GitHub MCP enumeration found zero open PRs; none could be randomly selected and
none was merged. The recovery-change skill guided explicit cancellation/uncertainty
contracts, ownership review, real transport/database checks and image rehearsal.
Unraid and shared Ollama remain unchanged.
