# Scoped Ollama application routing outcome

Date: 2026-10-14. Development on `main`; no release or production activation.

## Implemented

The [design](ollama-application-routing-design.md) is implemented with two small
ESM modules: an explicit lifecycle owner and an asynchronous scope/borrowed-client
lease. Existing generation, connection, embedding, warming, health, verification
and study leaves consult the binding before their direct transport paths.

Foreground generation and background inspection/verification/studies use separate
credentials. Closed/replaced contexts cannot fall back to direct HTTP. Invalid
replacement closes both old transports. Saved endpoints and model roles are
checked before dispatch; gateway mode does not pull models or enter direct retry
wrappers. Warming retains models for five minutes and reports that value.

No startup flag, schema migration, consent change, additional scheduler or new
inference is enabled. Existing gateway admission IDs remain time-based UUIDv7.
The main application, Unraid and shared Ollama retain their current routing.

## Evidence

- Real loopback HTTP with isolated PostgreSQL: **75 tests passed** across the
  existing gateway suite and the new application-routing suite. Covered ordinary
  leaves and the singleton, fresh health settings, both model roles, background
  study/verification factories, listener/timer context inheritance, closure,
  valid/invalid replacement, transport cancellation, unchanged uncertain attempts,
  cooldown and no direct retries. No shared provider was called.
- Focused unit/contract checks: **176 tests passed** across eight suites, including
  factory escape/revision fencing, parallel/nested scopes and the literal endpoint
  source inventory. That inventory is a review tripwire, not a network firewall or
  proof about dynamically constructed paths outside these tested entry points.
- Backend type checking, normal/production dependency checks, ESLint, static import
  and mock-shape checks passed. Markdown: **2,213 files**, zero errors;
  copyright: **1,640 files**. Migration/schema integrity passed.
- The first full backend run found a changed-source ownership review for
  `healthCheckAiProvider.mjs`. Its fixed settings SELECT and sanitized read-only
  model-list check were reviewed with the scope/context transport. Only that
  reviewed digest and its written rationale were updated; ownership classification
  and analysis digest are unchanged. Focused ownership tests and the standalone
  gate then passed. The initial full run had 58,437 passing tests, one failure
  (this review), one skip, and no other failing suite.

The final full backend unit rerun passed: **1,843 suites, 58,438 tests**, one
pre-existing skip, in 431.576 seconds. No coverage baseline was regenerated.

The recovery-change skill guided explicit uncertainty/cancellation contracts,
real HTTP/PostgreSQL checks and the isolated packaged-image rehearsal. No security
or ownership baseline was silently refreshed. Gitleaks scanned the implementation
commit with redacted output and found no leaks.

## Local protection

Before replacing the local container, created
`data/backups/gateway-application-routing-before-20261014.dump` (ignored/private),
SHA-256 `F6EB412D6678E248B051F4DB45F84AEE2334F2072410914060BEA46F7F1C7CA6`.
`pg_restore -l` read 1,933 lines; this is archive readability, not a restore drill.

Baseline image:
`sha256:e2f0f7a2a16e56f983e50866e3dda1c61aaf25b802f9fad2495f8a39f69fbc6c`.
Local evaluation consent before replacement remained `when_idle`, zero daily
calls/tokens/reserved calls, revision 2, unchanged next-check time. No gateway
schema or gateway environment configuration was present in the application.

## Image and local evaluation

The no-cache Compose build used clean implementation commit
`e6aaa2800c24c4b5b0d244d3fde706b76ca3473f`. Immutable image:
`sha256:0a0a72ae4b98b5e8e17b1626a6baa0847510aae75160e1b7717a85e9fd02232a`.
Its OCI revision label matches that commit. Later outcome-only edits do not
change packaged code; Markdown is excluded from this build context.

The packaged Linux rehearsal passed with **19 synthetic compute calls** against
that image. It exercised application scope, foreground/background clients,
borrowed study/verification factories, HTTP listener/timer inheritance, replacement
and closure, both warming paths, streaming and embeddings. Existing credential
rotation, private-file/JSON/symlink rejection, least-privilege database access and
restart checks passed too. Abrupt death during call 19 retained the same UUIDv7
request and 19 attempts, with no twentieth dispatch. No shared provider or real
model was contacted; no source/dependency overlay was used.

The isolated fixture used network `none`, 2 CPUs, 2 GiB memory, 512 PIDs and no
published ports. Cleanup verified removal of the exact owned container
`classifarr-schema-check-8bf8166c-d682-4fea-acbc-62900c5243bb` and its data directory.
This proves same-image restart behavior, not published-release upgrade safety,
real-model quality, remote GPU cancellation or a network-wide bypass firewall.

Local Compose replacement uses that exact image and returned healthy. `/health`
returned HTTP 200, with zero restarts and no OOM kill. The 2 GiB memory cap,
1,536 MiB V8 heap, read-only root, user `1000:1000` and `no-new-privileges` remain.
An initial memory sample was 463.4 MiB, not a load/performance benchmark.
Consent and next-check values above were unchanged. The application still has no
gateway schema, gateway environment variables or running gateway CLI.

Rollback is preserved under
`classifarr-local-rollback:d1a71bd233af7b34d2a7d603acc95bf3c211230f46880c345d895744eb3d423e`,
pointing to the baseline image above. No images were pruned, user data deleted,
or Unraid/shared Ollama settings changed. The unrelated Harmoniarr container was
not replaced. Frontend compilation passed during the build; frontend unit/coverage
and the full unrelated database integration matrix were not rerun.

## PR and recommendation

GitHub MCP enumeration found **zero open PRs** in `cloudbyday90/Classifarr`; there
was nothing eligible to randomly select or implement. No PR was merged.

Recommended stack: modular ESM leaves, Node 24 asynchronous scope, explicit
foreground/background provider contexts, authenticated gateway and PostgreSQL 18
UUIDv7 admission. This avoids a broad constructor rewrite and global HTTP
interception; the cost is a required whole-application lifecycle boundary and
careful async/factory-lifetime tests.

Next: explicit opt-in startup activation that binds HTTP listeners, timers and
workers together, with validated configuration, TLS and network restrictions
that prevent cross-installation bypass. Keep it local until deployment scope is
approved. This change alone does not coordinate the currently running Unraid and
test installations.
