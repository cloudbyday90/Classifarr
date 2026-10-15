# Gateway queue-task correlation outcome

Implemented, verification in progress, 2026-10-15. No release or production rollout.

The [design](ollama-task-correlation-design.md) adds task-scoped diagnostic context,
a strict application-to-gateway source header and nullable immutable binding
fields. Gateway UUIDv7 ownership and fingerprints remain separate. Task context
does not alter consent, claims, attempt limits, cooldown, cancellation or recovery.

## Verification

Real HTTP and isolated PostgreSQL integration passed eight suites / 193 tests,
including the actual queue processor-to-provider path, generation/stream/embed/warm,
concurrent tasks, spoofed options, malformed/duplicate headers, database constraints,
v5-to-v6 preservation and old-writer refusal. Further gates and exact image checks
are in progress.

Focused backend checks passed 14 suites / 313 tests. Server typecheck, test/security
lint, development/production dependency analysis, static imports, ESM mock-shape
checks, migration checks, reviewed ownership gate, Markdown lint and copyright
checks passed. The first full backend run passed 59,031 tests and failed only the
ownership gate before its reviewed digests were updated; the complete rerun is
in progress. Frontend source is unchanged.

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
