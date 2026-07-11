# Policy Engine Evidence Diagnostic Cutover

## Status

Implemented July 11, 2026.

## Decision

Rename the policy-engine debug message emitted after related-evidence pattern
scoring from `Pattern scored via related evidence (Phase 4)` to
`Pattern scored via related evidence`.

The message now identifies the actual evidence operation rather than the
delivery sequence that originally introduced it.

## Scope

The operation is unchanged:

- related evidence is scored for the selected library;
- the calculated pattern score is used without transformation;
- the diagnostic continues to contain only library ID, evidence count, and
  pattern score;
- policy weights, constraints, and candidate ranking are unaffected.

## Official Guidance Reviewed

- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  recommends precise, unambiguous names for diagnostics. The evidence-scoring
  operation is the stable meaning of the message.
- [NIST SP 800-228 Update 1](https://csrc.nist.gov/pubs/sp/800/228/upd1/final)
  supports traceable, risk-managed changes. The direct test verifies retained
  score behavior and the bounded debug payload.

## Options Considered

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Retain the delivery label | No code change | Makes normal diagnostics depend on retired project history | Rejected |
| Emit both labels | Eases a temporary search migration | Adds noise and leaves temporary naming in production | Rejected |
| Describe evidence scoring directly | Durable and concise; matches existing fields | Operators see corrected debug wording | Selected |

## Verification

- A policy with related evidence retains its calculated pattern score.
- The debug call retains library ID, evidence count, and pattern score.
- The message is `Pattern scored via related evidence` and contains no delivery
  label.
- The production naming inventory and regression audit are regenerated before
  lowering the baseline.

## Security Outcome

No policy decision, weight, constraint, authorization, or data-access behavior
changed. The debug record remains bounded to the existing non-secret fields;
the cutover removes obsolete terminology without expanding telemetry content.

## Next Step

Audit the legacy-compatibility vocabulary's delivery-era conversion wording and
decide whether it is an internal historical label or a current product contract
before modifying it.
