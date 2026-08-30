# Policy Destination Competition Coverage Outcome

Implemented: 2026-08-29.

## Delivered

The destination-competition preview now returns a separate comparison-coverage
contract. It distinguishes a complete active-competitor comparison from a
capped comparison without revealing how many additional competitors exist.

The UI uses this contract to explain whether its "no shared eligibility"
result is complete for the current active same-media-type destination set or
whether additional active destinations were excluded by the fixed cap.

## Operator Interpretation

- **Complete coverage** means every active same-media-type competitor fit
  within the fixed comparison cap. It remains a bounded historic preview, not
  a routing guarantee.
- **Capped coverage** means at least one additional active same-media-type
  competitor exists beyond the evaluated cap. Do not treat absence of shared
  eligibility as a complete destination-safety conclusion.
- The card is advisory only. It cannot identify a destination, expose rules,
  change a policy, invoke AI, route media, or change learning.

## Verification

The implementation has pure contract, persistence, service, integration, Vue
component, boundary-inventory, lint, type, build, full-suite, coverage-ratchet,
and security-diff coverage. The final commit records the executed results.

## Follow-up

The next high-value item is a bounded **cohort freshness indicator**: explain
when the historic sample is empty or stale without exposing any media record,
timestamp, or destination identity.
