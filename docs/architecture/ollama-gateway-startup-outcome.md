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

## Verification

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

The final backend rerun passed **1,844 suites, 58,494 tests**, with one existing
skip, in 328.08 seconds. Backend type checking, ESLint, normal/production dependency
checks, static imports, mock-shape checks, schema/migration integrity and ownership
checks passed. The routing owner no longer needs an explicit Knip composition
entry: normal startup now reaches it. No coverage baselines were regenerated.

The initial full run had 58,493 passing tests and the single stale ownership-review
failure noted above. A first attempt to add a separate review group exceeded the
manifest's existing 100-group cap; the two reviewed rationales were instead added
to their existing groups without raising the cap. The focused TLS rerun also
proved that an ambient `NODE_TLS_REJECT_UNAUTHORIZED=0` does not bypass the client's
explicit verification. That environment change was limited to the test and restored.

## Local protection and image

Before replacement, created ignored/private archive
`data/backups/gateway-startup-before-20261014.dump`, SHA-256
`57CB038AAD0DD3D69AD30A8C9B4744A9120BB6D9E79F440B6CDABEFD9B02DDCF`.
`pg_restore -l` read 1,933 lines; this is readability, not restore verification.
Evaluation consent remained `when_idle`, zero daily calls/tokens/reserved calls,
revision 2 and unchanged next check `2026-10-09 16:50:11.617278-04`.

The no-cache Compose build used clean runtime implementation commit
`9ffe1509ce816160845ea6e0226969e4866dac19`. Immutable image:
`sha256:1a75706182ba3b0518b3badf1ef3df841f61dce8c3e662c6cdf00d3c7018018a`.
Its OCI revision matches. Frontend compilation passed during the build. Later
root fixture, Knip configuration and outcome-only changes do not alter packaged
runtime code. Gitleaks found no leaks in the implementation commit.

Baseline image `sha256:0a0a72ae4b98b5e8e17b1626a6baa0847510aae75160e1b7717a85e9fd02232a`
is preserved as
`classifarr-local-rollback:993bf020c3e4270de80b5c302a6b5382469ff30ef2ad7289a7ebc6c96db44be5`.
No image pruning, data deletion, production activation or release was performed.

## Packaged rehearsals

The existing network-none packaged rehearsal passed **19 synthetic compute calls**:
application context, generation/embedding/warming, credential rotation/revocation,
private-file/JSON/symlink refusal, cancellation, UUIDv7 continuity and uncertain
attempt preservation after abrupt death. Cleanup verified removal of
`classifarr-schema-check-913c8843-9d6c-4b9e-9038-f05e00e1a31d` and its data directory.

The new network rehearsal passed against the same immutable image: **one synthetic
compute call through HTTPS**, native dynamic ESM import-time/timer context, later
HTTP listener context, closure fencing and **blocked direct provider TCP access**
from the application container. The positive gateway call proved the provider was
running before the negative direct-access test. Two internal Docker networks
separated the application and provider; only the gateway joined both. No ports
were published. Additional containers ran as `1000:1000` with read-only roots,
temporary writable storage, dropped capabilities and bounded CPU/memory/PIDs.

The gateway fixture retains the normal packaged entrypoint and fresh isolated
PostgreSQL. The separate application fixture calls packaged startup with injected
no-op database admission/runtime; it is not a second full production worker
deployment. Its dedicated synthetic gateway database uses the fixture database
owner; least-privilege gateway SQL is covered by the separate 19-call rehearsal.
This demonstrates the tested Docker topology, not the existing Unraid/LAN firewall,
published-release upgrades, real model quality or proof of remote GPU cancellation.

Two initial fixture setup failures were corrected without changing production
code: Docker refused `cp` into a read-only root (fixtures now stream to writable
tmpfs as UID 1000), and default file logging needed `LOG_DIR=/tmp/logs` in the
minimal application container. Both failed runs cleaned up their owned resources.
The final network run verified cleanup for label reference
`9c5d516c-0f17-4c4b-a5ec-4d1bf65739fd`, including containers, both networks, private
temporary certificates and the isolated database directory. No user data was
deleted. No shared provider or real model was contacted.

## Local replacement evaluation

Local Compose was recreated without pulling or rebuilding after the rehearsals,
using the exact image above. It returned healthy and HTTP 200 at `/health`, with
zero restarts and no OOM kill. The read-only root, user `1000:1000`,
`no-new-privileges` and 2 GiB memory limit remained in place. An initial sample
was 690.2 MiB / 2 GiB with 13.05% CPU during startup, not a load benchmark.

The saved consent and next-check values recorded above were unchanged. No gateway
environment configuration or gateway schema exists in the normal local
application database. The unrelated Harmoniarr container was not replaced.
Final Markdown checks covered 2,215 files; copyright checks covered 1,645 files.
Frontend unit/coverage and the full unrelated database integration matrix were
not rerun; frontend compilation and the scoped real-database tests were run.

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
