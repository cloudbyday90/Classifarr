# Comparison-context retry diagnostics design

Date: 2026-10-05. Scope: diagnostic messages, not cache or ownership policy.

## Evidence and decision

The reported local warning `f2b18acb-18d5-4e37-8638-57d658a358d9`
contains only `status: deferred`. The worker already returns a reason, but the
scheduler drops it. The historical cause cannot be reconstructed from that row.
Current read-only probes show inventory readiness and memory admission passing;
this does not prove the optional comparison cache recovered.

Preserve a fixed, allowlisted reason and matching operator guidance in scheduler
logs. Expected resource contention is informational; unknown memory, low memory,
failed readiness checks and other degraded outcomes remain warnings. Log when
the reason changes, not every retry. Emit recovery only after ready/revalidated,
never merely because a preflight probe passed. Disabled and ordinary import or
backfill waiting remain silent. Unknown text is replaced, never interpolated.

## Safety and bounds

No provider call, new poll, database mutation, schema, permission or threshold
change. Keep the existing single background worker, six-minute attempt deadline,
jittered backoff, cache TTL and ordinary retrieval fallback. Restart resets only
in-memory log deduplication as before. Cancellation and not-due runs do not claim
success. The diagnostic formatter is a small ESM module of fixed strings.

An unknown failure asks for a GitHub issue with a reviewed bug report and image
version if it persists. No automatic upload, credentials, raw exception, provider
URL, media data or speculative root cause belongs in these fields.

## Research and alternatives

[OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html),
revisited through the web service on 2026-10-05, recommends useful event context
and reasons while excluding sensitive data and sanitizing untrusted fields.

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Fixed reason and guidance | Explains the existing safety decision | Cannot reconstruct old reports; recommend |
| Dump raw exceptions/state | More debugging detail | May expose secrets/media; reject |
| Raise memory limits or bypass admission | Might run sooner | No evidence this is needed; reject |

Stack: existing admission → bounded worker → safe reason-specific logs → actual
ready/revalidated recovery confirmation. Next: capture a sanitized origin code for
generic unavailable failures without exporting raw provider or database errors.

## Verification

Test each deferred reason, unknown-field redaction, duplicate suppression,
reason changes, quiet normal waiting, and recovery only after verified readiness.
Read-only local observations are distinct from a live optional-cache build.
