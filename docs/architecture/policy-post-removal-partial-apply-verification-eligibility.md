# Policy Post-Removal Partial-Apply Verification Eligibility

## Intent

A controlled compatibility-removal apply can stop after one or more reviewed
paths have already applied. This is an exceptional state, not successful batch
completion. Classifarr may verify the bounded applied prefix so that the
operator has reliable evidence about what changed, but that verification must
never authorize another removal batch or a completion audit.

This document implements roadmap task **8R.19.2**. It preserves the existing
completed-apply path and defines a separate, non-authorizing partial-apply
verification result.

## Official-Source Research

- [OWASP Top 10:2025 A10 - Mishandling of Exceptional Conditions](https://owasp.org/Top10/2025/A10_2025-Mishandling_of_Exceptional_Conditions/)
  recommends validating exceptional states close to where they occur and
  failing securely rather than continuing from an uncertain transaction.
- [NIST SP 800-128](https://csrc.nist.gov/pubs/sp/800/128/upd1/final)
  treats controlled change and continuous monitoring as part of maintaining
  system integrity. Applied paths therefore need current, bounded evidence
  before their state can be trusted.
- [NIST SSDF](https://csrc.nist.gov/projects/ssdf) frames secure development as
  outcome-based practices that include protecting software from tampering and
  tracking security requirements, risks, and design decisions.
- [SLSA verification guidance](https://slsa.dev/spec/v1.2/verifying-artifacts)
  recommends verifying artifacts against known expectations before use. The
  existing fingerprint-bound review and runtime-evidence artifacts provide the
  local control-plane equivalent.

## Recommendations

### Recognize Only a Bounded Applied Prefix

Accept partial verification only when the apply evidence proves all of the
following:

1. The halt reason is one of the controlled apply halt reasons.
2. The stopped entry is the first entry after a non-empty, contiguous prefix of
   valid applied results.
3. The halt reason and apply status agree.
4. The batch count, checked count, entry order, result order, action IDs, and
   canonical repository paths agree.
5. The original removal review was ready, valid, and bound to valid review,
   execution-plan, and execution-gate fingerprints.

Pros:

- preserves evidence for paths that did change;
- contains the exception to the smallest observable scope;
- rejects forged, reordered, or ambiguous apply results.

Cons:

- evidence producers must retain the stopped entry and review context;
- partial results require stricter structure than completed results.

### Scope Post-Removal Evidence to Applied Paths

For partial verification, import scans, runtime checks, and focused and full
validation must declare exactly the applied-prefix paths. Evidence that includes
an un-applied path, omits an applied path, or has no declared scope is blocked.

Pros:

- prevents a later un-applied path from being mistaken for verified work;
- keeps provenance and diagnostics specific to the actual change.

Cons:

- partial-evidence producers must include explicit `checkedPaths` metadata.

### Separate Verification From Authorization

Emit a distinct `verified_partial_apply` state with
`authorizationEligible=false`. Its only next step is resolving the bounded
apply blocker. The existing `verified` state remains the sole input accepted by
next-batch authorization and completion paths.

Pros:

- preserves useful evidence without failing open;
- makes the operator action explicit;
- retains the completed-batch authorization contract unchanged.

Cons:

- consumers must handle one additional non-terminal verification status.

## Final Recommendation Stack

1. Reuse the existing fingerprint-bound runtime-evidence artifact.
2. Evaluate complete apply evidence exactly as before.
3. For a partial apply, accept only a known stopped state with a valid contiguous
   applied prefix and intact review/gate provenance.
4. Require exact applied-path scope for partial import, runtime, and validation
   evidence.
5. Return `verified_partial_apply` only when that bounded evidence passes.
6. Set `authorizationEligible=false` and route only to blocker resolution.
7. Keep next-batch authorization and completion audits restricted to the
   existing fully verified state.

## Implementation Outcome

Implemented in this task:

- a modular apply-evidence eligibility evaluator;
- partial-prefix and evidence-scope checks in runtime verification;
- a non-authorizing partial verification result and next step;
- artifact and authorization regression tests proving a partial result cannot
  authorize another batch or completion path.

Not implemented:

- automatic retries of a stopped entry;
- adapter execution;
- storage or Git mutation;
- authorization of a later removal batch from partial evidence.
