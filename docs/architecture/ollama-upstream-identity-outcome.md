# Authenticated upstream identity outcome

Work in progress, 2026-10-15. Not a release or production deployment.

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
Packaged image checks remain pending.

The local pre-replacement backup is
`data/backups/gateway-identity-before-20261015.dump`, SHA-256
`8AB7E8D4139537C45EB1062AB7F76AE05DBD73C40A0C3904F28762D3E44BB4D0`.
Its archive listing is readable (1,933 lines); this is not a restore rehearsal.
Exact image/source identifiers, local replacement checks and limitations will
be recorded here before handoff.

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
