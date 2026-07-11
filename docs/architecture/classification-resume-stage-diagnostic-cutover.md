# Classification Resume Stage Diagnostic Cutover

## Status

Implemented July 11, 2026.

## Decision

Change the `classificationProgressStageQueries.resumeFromStage` failure log
message from `Failed to get resume phase` to `Failed to get resume stage`.

The query already reads `current_stage`, returns a stage value, and logs the
successful resume state as a stage. The error message now describes the same
domain object consistently.

## Scope

This is an internal diagnostic-only change. It does not alter:

- the task queue query;
- the `current_stage` or `stage_index` schema;
- the returned stage or `null` behavior;
- API responses, WebSocket events, or client state;
- retry, authorization, or error-handling behavior.

## Official Guidance Reviewed

- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  recommends precise, unambiguous operational names. The diagnostic must use
  the same `stage` noun as the queried and returned data.
- [NIST SP 800-228 Update 1](https://csrc.nist.gov/pubs/sp/800/228/upd1/final)
  supports traceable interface changes. The change has focused error-path
  coverage and does not expand the diagnostic payload.

## Options Considered

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Keep the existing diagnostic | No code change | Contradicts persisted and returned terminology | Rejected |
| Log both terms | Transitional familiarity | Retains an obsolete delivery term and adds noise | Rejected |
| Use `resume stage` only | Matches the durable contract and remains concise | Operators see the corrected wording | Selected |

## Verification

- The resume query returns the same stage for a valid task.
- A rejected database query returns `null` and logs the durable diagnostic with
  the existing bounded context: task ID and error message.
- The production naming inventory and regression audit are regenerated before
  lowering the baseline.

## Security Outcome

No data, access control, or request processing behavior changed. The error log
continues to contain only the existing task ID and error text; the cutover
removes ambiguous terminology without broadening diagnostic exposure.

## Next Step

Audit the remaining `phase` references in production services, beginning with
the policy-engine debug diagnostic, and distinguish historical delivery text
from actual runtime contract names before each direct rename.
