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
  and mock-shape checks passed. Markdown: **2,212 files**, zero errors before this
  outcome document; copyright: **1,640 files**. Migration/schema integrity passed.
- The first full backend run found a changed-source ownership review for
  `healthCheckAiProvider.mjs`. Its fixed settings SELECT and sanitized read-only
  model-list check were reviewed with the scope/context transport. Only that
  reviewed digest and its written rationale were updated; ownership classification
  and analysis digest are unchanged. Focused ownership tests then passed.

Full-suite rerun, immutable-image rehearsal and post-rebuild results will be added
after those checks finish. No pending check is represented as passed here.

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
