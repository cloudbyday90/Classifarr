# Comparison failure causes design

Date: 2026-10-05. Follow-up to comparison-context retry diagnostics.

## Decision

Capture the failed preparation step and a fixed cause code before the comparison
worker discards its exception. Reuse the existing provider-response classifier.
Recognize selected PostgreSQL/system codes only at database boundaries; distinguish
cached-vector validation from provider validation. Unknowns remain unknown and ask
for a reviewed GitHub report if persistent. Never infer a cause from arbitrary text.

Steps cover readiness/state reads, shared admission, provider inspection, snapshot
reads, source validation, profile build, post-build verification and publication.
Diagnostics are bounded scalar fields, not an exception dump: no SQL, row values,
model names, media, endpoints, credentials, raw stacks or response bodies. Examine
at most four error/cause nodes with cycle/getter protection. Fixed legacy internal
sentinels may be mapped by exact equality, never substring matching.

The shared readiness wrapper gains an opt-in diagnostic hook for this consumer;
other workers retain their existing report contract. The scheduler validates the
fields again before logging and deduplicates by status, reason, step and code.
Repeating the same failure is silent; a different failing step/code is observable.
Only a ready/revalidated result confirms recovery, never a successful preflight.

## Unchanged safety contract

No database migration, API/UI change, new provider request, model pull or automatic
repair. Keep single-worker admission, the six-minute attempt deadline, capped
jittered backoff, ten-minute cache TTL and normal retrieval fallback. Disabled,
empty, importing and backfilling setups remain quiet. Shutdown/caller cancellation
does not become a fault; a deadline expiry is distinct from operator cancellation.
Failed preparation clears unsafe context as before; busy admission may preserve
only an already valid cache entry. Restart resets the existing in-memory state,
not a durable recovery budget. The diagnostic has no authority to retry a write.

## Alternatives and recommendation stack

| Choice | Pros | Cons / decision |
| --- | --- | --- |
| Fixed step + cause code | Useful and safe support evidence | Unknown exceptions still need investigation; implement |
| Raw exception dump | More detail | May leak provider/database data; reject |
| Change limits/retry policy | Might make one symptom disappear | No causal evidence; defer |

Recommended stack: existing admission → bounded preparation → allowlisted failure
diagnosis → reason-specific guidance → verified recovery. Next: use new evidence to
address a demonstrated recurring cause, not broaden repair or resource limits.

## Official research

Discovered and opened through MCP web search/navigation on October 5, 2026:

- [Node 24 errors](https://r2.nodejs.org/download/release/v24.21.0/docs/api/errors.html):
  stable codes and nested causes are preferable to arbitrary error-message parsing.
- [Node 24 AbortSignal](https://r2.nodejs.org/download/release/v24.21.0/docs/api/globals.html):
  preserve cancellation reasons and distinguish operation deadlines.
- [PostgreSQL error codes](https://www.postgresql.org/docs/current/errcodes-appendix.html):
  SQLSTATE is stable across localization; reported 18.6 when retrieved.
- [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html):
  log useful reasons, sanitize untrusted inputs and avoid secrets; diagnostics must
  not disrupt the application. No new UI is needed for this logging-only change.

## Open PR trial

MCP returned open PRs 555 and 556. A cryptographic random draw selected
[#555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`5545605b53c854de8847b44e24fa083ff4218080`. Trial its exact client declaration change
(`@types/node` 24.19.1 → 26.6.4, `undici-types` 7.24.6 → 8.9.0) separately, under
pinned Node 24.21.0/npm 12.2.0. Preserve install policy and test the runtime-major
guard and frontend typecheck. Revert if incompatible; do not merge or edit the PR.
The [DefinitelyTyped version policy](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md)
ties declaration major/minor versions to the represented library API.

## Validation plan

Inject faults at every boundary; cover nested/cyclic/getter-hostile exceptions,
unknown codes, timeout/cancellation precedence, redaction, unchanged backoff and
safe-cache invalidation. Exercise actual local HTTP provider failures and isolated
PostgreSQL errors, not only mocks. Run quality gates, rebuild local Compose without
cache, dump the isolated schema and evaluate health/ownership/resources. Do not
inject failures into the user's database or contact Unraid.
