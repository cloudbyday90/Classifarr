# Native Profile Refresh Failure Classification

## Decision

Native profile-refresh failures now use a fixed, server-owned classification
contract before they change durable outbox state. The contract deliberately
does not persist exception messages, stack traces, provider responses, or
media-server payloads.

It recognizes three classes:

- `permanent_configuration`: a Classifarr-owned missing profile-service
  capability. It is terminal on the current claim and cannot create a native
  recovery successor.
- `transient_dependency`: a bounded allowlist of network timeouts, connection
  failures, aborts, and retryable HTTP status codes. It uses the normal bounded
  worker retry and may create a delayed native successor after a terminal row.
- `unknown`: all other errors. It uses the existing bounded retry and delayed
  successor behavior for backward-compatible hands-off recovery. The following
  circuit-policy component will aggregate repeated unknown terminal failures
  and stop recovery at a durable threshold.

Persisted failure codes are fixed identifiers, not a serialization of the
error. The native planner reads the newest fixed identifier with terminal
history and applies a pure allowlist decision. It accepts legacy
`profile_refresh_execution_failed` records so upgrading installations keep
their existing automatic recovery behavior. A missing or unrecognized stored
code fails closed and cannot create a successor.

## Research

Research was retrieved from official sources on 28 July 2026, newer than the
requested June 2026 baseline. Microsoft recommends distinguishing transient
from persistent failures, using bounded retries with backoff, and applying a
circuit when repeated calls are unlikely to succeed. [Microsoft transient
fault handling](https://learn.microsoft.com/en-us/azure/well-architected/design-guides/handle-transient-faults)
and the [Circuit Breaker pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker)
support a fixed classification boundary before a durable circuit decision.

Google recommends retrying only transient failures for idempotent operations,
using truncated exponential backoff and jitter, and avoiding retries of
authorization or invalid-request failures. [Google Cloud retry
strategy](https://docs.cloud.google.com/storage/docs/retry-strategy) supports
the non-retryable configuration disposition.

OWASP advises structured server-side error handling and logging that avoids
exposing sensitive internal implementation details. [OWASP Improper Error
Handling](https://owasp.org/www-community/Improper_Error_Handling) and the
[OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
support persisting only the fixed failure vocabulary.

## Options Considered

### Persist Raw Error Details and Decide in the Planner

Pros: could classify more cases later without worker changes.

Cons: makes durable state depend on unstable implementation text, risks
sensitive-detail retention, and lets old errors change meaning after an
upgrade. Rejected.

### Treat Every Error as Permanent

Pros: prevents repeated work immediately.

Cons: temporary database, network, or service outages would require an
operator to recover a healthy system. Rejected.

### Retry Every Error Indefinitely

Pros: simplest worker path and preserves automatic recovery.

Cons: repeats known bad configuration, wastes scheduler capacity, and makes a
persistent failure invisible until it causes secondary effects. Rejected.

### Fixed Classification With Conservative Unknown Recovery

Pros: stops known local configuration failures immediately, keeps transient
and existing unknown failures hands-off, preserves upgrade behavior, and gives
the next durable circuit a stable input.

Cons: unknown failures can continue through the current delayed successor path
until the aggregation/circuit component is added. Selected.

## Final Recommendation Stack

1. Keep classification in one pure ESM service, with fixed identifiers and no
   dependency on a browser, configuration name, library label, or error text.
2. Mark only Classifarr-created configuration errors non-retryable in this
   component. Do not infer permanence from arbitrary `TypeError` messages or
   provider text.
3. Continue the existing finite worker retry and delayed successor for known
   transient and legacy/unknown failures.
4. Read the persisted failure identifier in the same planner transaction that
   would enqueue a successor; block unrecognized identifiers rather than
   guessing their meaning.
5. Add a durable per-library/source-revision aggregation and circuit state
   before declaring unknown recurring failure recovery complete.

## Implementation Outcome

`policyProfileRefreshFailureClassification.mjs` owns the fixed classification,
the Classifarr-created configuration error, and native terminal-successor
eligibility. `policyProfileRefreshOutboxWorker.mjs` supplies the classified
failure code and retryability to the durable worker repository. A missing
profile reader or generator is now terminal on its first claim.

`policyProfileRefreshOutboxWorkerRepository.mjs` atomically applies the
non-retryable disposition while preserving claim-token ownership. Its default
remains retryable for all existing callers. The failure-history repository now
returns a bounded fixed failure code with the terminal count, and the native
planner records a blocked successor result when a permanent or unrecognized
failure is found.

## Security Outcome

- Error messages, stacks, HTTP bodies, media metadata, and library names never
  enter outbox failure storage or planner decisions.
- Only allowlisted internal failure identifiers can be persisted by the worker
  repository.
- Successor eligibility is evaluated server-side in the same transaction as
  enqueueing and fails closed for missing or unrecognized persisted codes.
- A non-retryable failure still requires the current claim token, so a stale
  worker cannot overwrite another worker's result.

## Verification

Focused tests cover configuration, dependency, and unknown classifications;
raw error exclusion from worker logs; immediate terminal persistence for a
non-retryable error; failure-code history retrieval; legacy recovery; and
blocked native successor scheduling for permanent configuration failure.

## Next Step

Implement **durable native profile-refresh failure aggregation and automatic
circuit policy**: store a compact per-library/source-revision failure state,
open it at a fixed threshold, delay half-open probes, reset it after a success
or source revision change, and compact obsolete terminal history without
requiring an operator or browser action.
