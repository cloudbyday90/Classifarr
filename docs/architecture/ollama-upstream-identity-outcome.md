# Authenticated upstream identity outcome

Implemented and locally verified, 2026-10-15. Not a release or production deployment.

Implemented the [design](ollama-upstream-identity-design.md) as optional pinned
HTTPS transport, pre-dispatch peer observations and explicit standalone schema
v5. Automatic recovery remains disabled; TLS identity is not Docker attestation.
See the [operating limits](../operations/ollama-upstream-identity.md).

The user's follow-up added [Classifarr-owned work identity](ollama-work-identity-design.md):
unique UUIDv7 references and credential-derived installation headers for gateway
compute, recorded operation/model, and optional separately keyed HMAC fingerprints.
Unrelated provider activity is not adopted as Classifarr work. Fingerprints do
not grant retry/deduplication authority or allow stopping shared Ollama.

## Verification

Backend unit verification passed: 1,851 suites, 58,944 tests passed and one
existing skipped test (365.828 seconds). Focused gateway/provider-stop checks
passed 10 suites and 255 tests. Real HTTP/TLS and isolated PostgreSQL integration
checks passed seven suites and 176 tests, including ownership-header spoofing,
separate installation fingerprints and untracked outside activity using the same
model. Type checking, server test/security lint, development/production dependency
checks, ESM imports/mock contracts, migration checks, copyright and Markdown
checks passed. The inventory ownership gate passed after review of the changed
standalone ledger; its existing `productionCompatible: false` debt remains.
No frontend/API presentation contract changed; the production frontend build
passed as part of the no-cache Docker build. No dependency/version changes.

The local pre-replacement backup is
`data/backups/gateway-identity-before-20261015.dump`, SHA-256
`8AB7E8D4139537C45EB1062AB7F76AE05DBD73C40A0C3904F28762D3E44BB4D0`.
Its archive listing is readable (1,933 lines); this is not a restore rehearsal.

## Image rehearsal

Clean source `f38a338de31f90be80fcfb52e27c3df6437d1ed0` was built with local
Compose `build --no-cache --require-provenance --protect-running-image`:

- Immutable Docker image ID:
  `sha256:acf440a9e99f471605843c62d0e27b9df9d744e4c13c1399349ffce3bf78a229`.
- Platform manifest:
  `sha256:8bf49ef31972cd9fd1b54935c1ef1ed515fde97b8f02875e1a7214048a57b1ff`.
- Image configuration:
  `sha256:a3b04fd3ae3c084c6b31417e000b659b84f6ec33736e00c26e65215988bb3f71`.

The network-none packaged gateway rehearsal passed with real TLS, PostgreSQL and
the standalone gateway CLI. It observed committed UUIDv7 peer/work records before
two synthetic HTTP requests, killed the gateway during the second request, and
verified preserved uncertainty/attempts and zero replay after restart. A wrong
pin sent zero HTTP requests and remained blocked after restart. Existing routing,
stream/embed/warm, credential reload, offline recovery and provider-stop regression
rehearsals also passed. The busy-response case waited the real cooldown; no attempt
counters were reset. All generated containers/directories were removed and checked.

The first new fixture run failed on a numeric-versus-text attempt assertion.
The packaged application installs PostgreSQL type parsers; the fixture now makes
that comparison explicit. Only the external `/tmp` test fixture changed after the
build, not application source, dependencies, database SQL or image contents. The
corrected fixture passed against the same immutable image. Its failed-run container
and data directory were also confirmed removed.

Separate internal-network rehearsal passed: one synthetic compute request,
client-to-gateway TLS, direct provider access blocked, and recorded request binding.
That fixture's gateway-to-provider leg uses HTTP; the network-none rehearsal above
proves the new upstream TLS path. Real Docker Desktop stop/boundary fixtures passed
against owned idle containers with zero inference; generated networks/containers
were removed. These are local synthetic checks, not shared Ollama/Unraid validation.

## Local application evaluation

The prior local image
`sha256:d58468e5327def5618d8bbdadd99aea4ad8d3aaa55160dca014e1a3423a7ab1f`
is retained as
`classifarr-local-rollback:e40d7d032b105b07222c2946210a1a46f28a5798196f10ce2e90e121fb3e1eb5`.
Local Compose replacement passed using `--no-build --no-deps --pull never`, with
the retained rollback verified first. The container reports the exact image and
source above, healthy, zero restarts and no OOM. Health and UI return HTTP 200;
unauthenticated libraries return 401. User `1000:1000`, read-only root filesystem,
no-new-privileges, 2 GiB limit and original data/media mounts are preserved; no
Docker socket or gateway/routing environment variables were added.

The application database still has no `ollama_gateway` schema. Evaluation settings
remain `when_idle`, zero daily calls/tokens, zero reserved calls, revision 2 and
the unchanged next-check timestamp. Post-start samples were 718.3 then 535.8 MiB
of 2 GiB; CPU settled to 0.49% in the second sample. These are short observations,
not a sustained-load measurement. The unrelated Harmoniarr container was not modified.

## Limits

The gateway is still optional and disabled in the normal application. Direct
clients are not retroactively fingerprinted; there is no production backfill or
Unraid/shared-provider configuration change. No prompt, key or provider response
was added to the durable work record. TLS proves peer key possession, not Docker
ownership or stopped work. Unknown attempts remain held for the reviewed procedure.
No automatic cancellation, deduplication, retry or shared-provider restart was
introduced. These checks do not establish sustained memory/performance behavior,
a published-release upgrade, or a restored production backup.

## Open PRs

GitHub MCP search for open Classifarr pull requests on 2026-10-15 returned none.
No PR was selected, merged or represented as implemented.

## Next opportunity

First propagate Classifarr queue/task references into the gateway-owned work
record and diagnostics, then plan an explicit rollout. Direct clients remain
outside this optional prototype. For a separate dedicated-provider deployment,
enforced provisioning with exclusive per-instance key ownership and durable
create/start intents remains necessary before automatic lifecycle recovery.
Shared Ollama stays unmanaged; unrelated work must never be cancelled or retried.
