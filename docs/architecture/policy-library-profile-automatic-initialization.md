# Automatic Library-Profile Native Policy Initialization

## Outcome

Classifarr now completes native-intent conversion for an existing destination
that has no legacy presets without an operator dialog, policy-name convention,
or per-installation configuration. The connected media-server library supplies
the baseline evidence because it is the destination's source of truth.

The automatic baseline is deliberately narrow:

- Current observed genres establish advisory destination identity.
- The library media type is retained as advisory identity evidence.
- Current observed studios may be stored only as helpful compatibility hints.
- Existing review thresholds and routing configuration are preserved.
- Hard limits, avoid rules, learning writes, provider calls, AI output, and
  metadata/RAG evidence are excluded.

## Design

The shared `policyNativeIntentConversionContract` resolver has two paths:

1. Existing preset attachments use the established legacy conversion contract.
2. An empty legacy contract uses `policyLibraryProfileInitialIntent` when its
   persisted profile is current, non-empty, and has observed genre identity.

Candidate discovery and transaction-gated application call the same resolver.
This prevents a dry-run from approving a different contract than the one that
is actually written. The active header remains `native_intent` and `inferred`,
while each generated rule records `media_server_library_profile` provenance.

When a profile is missing, stale, or insufficient, reconciliation generates
the connected profile, reloads bounded candidate input once, and either
converts or persists a retryable deferred outcome. Repeated technical failures
use capped exponential backoff instead of becoming a permanent maintenance
state. No unsafe profile condition produces a native write.

## Recommendations

Use PostgreSQL advisory locks for cross-replica ownership and retain the
per-policy transaction lock for the write. PostgreSQL documents advisory locks
as application-defined locks and notes that session-level locks are released
when the session ends; this matches a bounded scheduler-owned maintenance
worker. [PostgreSQL: Explicit Locking](https://www.postgresql.org/docs/17/explicit-locking.html)

Keep each retry idempotent and treat a failed write as a non-authoritative
outcome. OWASP recommends enforcing business-flow integrity and testing abuse
or error paths, which supports revalidating the current candidate under the
transaction boundary instead of trusting a prior report. [OWASP: Business
Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)

Retain only counts, stable IDs, timestamps, and fingerprints in support
records. OWASP's logging guidance recommends recording sufficient event context
while avoiding sensitive data exposure; raw library/profile values therefore
remain out of reconciliation state, alerts, and migration metadata. [OWASP:
Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

## Alternatives

| Approach | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Require an administrator to declare the first policy | Maximum explicitness | Breaks unattended cutover and does not scale to existing installations | Rejected |
| Infer from policy or library names | Simple implementation | Installation-specific, fragile, and not evidence-based | Rejected |
| Use AI/metadata/RAG to create the baseline | Potentially richer labels | Nondeterministic, quota-dependent, and expands authority unsafely | Rejected |
| Use the current connected-library profile with bounded rules | Deterministic, platform-agnostic, and aligned with actual placement | Cannot establish identity for an empty or evidence-poor library | Adopted |

## Verification

- Unit tests cover a current profile, missing/stale/insufficient profile
  deferral, legacy-path separation, retry state, and automatic refresh/reload.
- The local Compose verification rebuilds without cache, waits for the
  scheduler-owned reconciliation opportunity, and confirms all eligible
  zero-preset policies gain a single active native intent without manual state
  deletion or database intervention.
