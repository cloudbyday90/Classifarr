# Pgvector startup report: design

Research date: 2026-10-12. This follows the compatibility-banner work. It adds
diagnostic evidence, not a new binary-selection or recovery policy.

## Findings and scope

The shell selects the binary before PostgreSQL starts. The AVX recorder later
writes five settings individually; neither status endpoint records the selection
branch or distinguishes another process's saved report. CPU flags describe the
application host, not necessarily an external PostgreSQL host. A recent timestamp
alone cannot establish that a report belongs to the current process/database run.

Retain the existing CPU/binary checks, safe symlink/noexec checks, staging fallback,
non-root support, memory limits and schema behavior. No provider or production
changes, new permissions, automatic restart, or forced extension loading.

## Decision and contract

1. Instrument existing entrypoint branches with fixed reason codes and a UTC
   selection timestamp. Mark this as an embedded-entrypoint report. Missing or
   unrecognized input remains unknown; do not derive a staging failure from CPU
   support alone. No arbitrary environment values are copied into the new report.
2. Record one bounded versioned JSON report alongside the existing settings in
   one parameterized atomic statement. Keep only the latest report, not an
   unbounded history. Add an opaque per-process UUID, recording/selection times,
   build/variant/CPU enums and database postmaster start time. Do not include
   hostnames, connection strings, paths, usernames or credentials.
3. A shared ESM reader serves both authenticated status endpoints. Preserve legacy
   fields; add `pgvectorSelection` to RAG status and `pgvector.selection` to system
   status. Validate the stored report and project allowlisted fields only. Compare
   its reporter UUID and database-start timestamp with the current reader; label
   legacy/malformed/missing, other-process, database-changed and current reports
   explicitly. A current report is still a startup observation, not proof of the
   loaded extension binary or a database health guarantee. No age-based takeover.
   Compare legacy fields too: an older writer can update them without replacing
   the JSON report. Such divergence is `settings_changed`, not current evidence.
4. Display the reference, timestamps, scope and specific safe guidance in System.
   The Dashboard notice uses precise reasons only for a current embedded report;
   older servers keep their conservative fallback wording. A mismatch must not
   turn an old report into advice to change current deployment settings.

No schema migration is required: the bounded settings record uses the existing
text value column. Read failures remain non-critical for diagnostics. The existing
startup catch handles recording failure; it must not claim a persisted report
when the settings table is absent.

## Alternatives, pros and cons

| Approach | Benefit | Cost / decision |
| --- | --- | --- |
| Bounded startup report with current-reader comparison | Precise branch attribution, restart reference, no extra privilege | Last writer wins; mismatches visible, not per-instance history; use now |
| Infer cause from build/CPU flags | Minimal work | Cannot distinguish staging failures; retain only as legacy fallback |
| Full host/container inventory or raw startup logs in API | More detail | Sensitive data, large payloads, privilege coupling; reject |
| Load the extension to prove the binary | Stronger session-specific evidence | Can execute unsafe native code and is not read-only observation; defer |

Recommendation stack: record the actual branch; publish validated scoped evidence;
show reason-specific safe actions; only then consider passive loaded-module
evidence for supported PostgreSQL versions as a separate design.

## Official research

Sources discovered with connected search/GitHub tools and retrieved:

- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  supports event timing, correlation identifiers and reasons, input validation,
  bounded context, and excluding secrets/connection details. Our report is
  operational diagnostics, not a tamper-proof audit or authorization signal.
- [PostgreSQL 18 system information](https://www.postgresql.org/docs/18/functions-info.html)
  documents postmaster start time and session-specific loaded-module information.
  The former identifies a database run; neither proves process ownership.
- [Pgvector portability](https://github.com/pgvector/pgvector/blob/master/README.md)
  warns that CPU-native compilation can fail on other hosts. Preserve compatibility
  controls and do not prescribe enabling execution permissions to optimize speed.

## Verification

Test reason allowlists, unknown/legacy reports, bounds, invalid dates/UUIDs,
cross-process and database-restart comparison, atomic persistence, absence/error
paths, both API projections and client guidance. Use real PostgreSQL in an owned
network-isolated image fixture; test ordinary startup and staging-disabled/invalid
branches. Run current frontend/backend tests, typechecks, lint, ESM checks and
schema dump after a no-cache build. Record actual results separately.

GitHub MCP returned zero open PRs at the start of this batch; no random candidate
was available. No release, tag, new branch or Unraid deployment is authorized.
