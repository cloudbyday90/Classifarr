# Gateway queue-task correlation outcome

Implemented and locally verified, 2026-10-15. No release or production rollout.

The [design](ollama-task-correlation-design.md) adds task-scoped diagnostic context,
a strict application-to-gateway source header and nullable immutable binding
fields. Gateway UUIDv7 ownership and fingerprints remain separate. Task context
does not alter consent, claims, attempt limits, cooldown, cancellation or recovery.

## Verification

Real HTTP and isolated PostgreSQL integration passed eight suites / 193 tests,
including the actual queue processor-to-provider path, generation/stream/embed/warm,
concurrent tasks, spoofed options, malformed/duplicate headers, database constraints,
v5-to-v6 preservation and old-writer refusal, including identical task IDs from
different credential-bound installations.

Focused backend checks passed 14 suites / 313 tests. Server typecheck, test/security
lint, development/production dependency analysis, static imports, ESM mock-shape
checks, migration checks, reviewed ownership gate, Markdown lint and copyright
checks passed. The first full backend run passed 59,031 tests and failed only the
ownership gate before its reviewed digests were updated. The full rerun passed
1,853 suites / 59,032 tests, with one skipped. Frontend source is unchanged; its
production build passed inside Docker. No full frontend test rerun was needed.

Before replacement, created `data/backups/gateway-task-correlation-before-20261015.dump`;
SHA-256 `5CB1A8862B87455CF427B3C39B031FFABC8B5D3A1E656315DB6D3945015202D5`.
`pg_restore --list` succeeded (1,933 lines); no restore-test claim.

The first focused run identified an unscoped options compatibility mismatch;
the adapter now omits absent source options and strips caller overrides. The
literal-provider-boundary guard then correctly flagged the new adapter. Reviewed:
it delegates only to `createGatewayClient`, never creates a direct provider
transport, enables routing or adds fallback. The explicit reviewed list was updated.

The ownership gate required review of two changed source digests. The gateway
ledger changes only its required schema version from 5 to 6; its owner/provider/
request fences and completion SQL are otherwise unchanged. The queue processor
adds an async diagnostic scope around its unchanged dispatch/failure/completion
body. Neither changes claim predicates, writes, retries or recovery authority.
Only those source digests were updated; analysis digests and existing unresolved
writer-debt classifications remain unchanged. This is not a claim that the
whole repository is production-compatible.

## Packaged image and local evaluation

No-cache build with required clean-source provenance and running-image protection:

- Source: `433d19efc33536b92326485cb40f0557dced3e18`.
- Candidate: `sha256:d5ed7fcb8f85dfa3d06f80c81c109386baafff0c46ea8a7490290b0ef76fd64b`.
- Prior local image: `sha256:acf440a9e99f471605843c62d0e27b9df9d744e4c13c1399349ffce3bf78a229`;
  source `f38a338de31f90be80fcfb52e27c3df6437d1ed0`, preserved under a rollback tag.

`run-ollama-gateway-rehearsal.mjs` passed on the immutable candidate with the
normal application entrypoint, isolated PostgreSQL, no external network and no
published ports. Eight actual queue-scoped application requests persisted task
7001/attempt 2 across the existing generation, streaming, embedding, warming and
verification/study fixture calls. The interrupted stream retained its complete
task 7002/attempt 3 binding after SIGKILL/restart; no replay occurred. No source
header reached the provider. The main fixture made 19 synthetic calls, the
completion fixture four, and the TLS-identity fixture two (zero wrong-pin calls).
Offline recovery and provider-stop receipts retained their previous protections.
The disposable container and data directory were removed and absence verified.

The real Docker boundary/stop rehearsal passed on owned idle synthetic containers:
running/stopped observations, changed-start refusal, a single fixed stop, stable
configuration/network evidence and repeat-stop refusal. It made zero inference
calls, removed only its exact owned containers/networks and verified cleanup.
This is not evidence that shared Ollama is exclusively controlled.

The separate-container network rehearsal passed: private-CA TLS from the
application to the gateway, one synthetic provider request, direct provider
access refused and the declared container/start binding retained with UUIDv7.
All three owned containers, both internal networks and disposable data were
removed, with cleanup verified. This fixture tests the unchanged network boundary;
the task-source propagation assertions are in the first packaged rehearsal.

Local Compose replacement used `--no-build --no-deps --pull never --force-recreate
--wait --protect-running-image`. The running image/source matched the candidate;
it was healthy, with zero restarts and no OOM. `/health` and `/` returned 200;
unauthenticated `/api/libraries` returned 401. UID/GID 1000, read-only root,
no-new-privileges, 2 GiB limit and the existing data/media mounts were retained;
there was no Docker socket mount or gateway/routing environment configuration.
The application database still has no `ollama_gateway` schema. Workload settings
and counters stayed `when_idle / 0 daily calls / 0 daily tokens / 0 reserved /
revision 2`, including the unchanged next-check timestamp. A short idle sample
was 666.4 MiB / 2 GiB and 1.78% CPU, not a peak-load or performance guarantee.
The unrelated Harmoniarr container was untouched.

The candidate is a local development build, not a published-release upgrade test.
The later outcome-only commit does not alter the packaged runtime. Secret scanning
of the staged implementation passed; no secrets, release tags or version changes
were added.

## Open PRs

GitHub MCP open-PR enumeration returned none for Classifarr on 2026-10-15.
No PR was selected, merged or represented as implemented.

## Limits and next opportunity

This remains optional gateway support. Direct clients, scheduler/study jobs
outside queue tasks and historical records are not retroactively correlated.
No Unraid/shared-provider changes, new inference budget, live recovery, release
or production backfill is included. Source context is a bounded authenticated
caller assertion, not a cross-database verified queue claim.

Next: a bounded, read-only task-to-gateway history view with installation-scoped
access and clear correlated/uncorrelated states, followed by a reviewed routing
rollout. Do not use trace metadata as permission for provider lifecycle control.
