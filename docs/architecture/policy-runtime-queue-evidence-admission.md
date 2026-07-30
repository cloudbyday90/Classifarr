# Policy Runtime Queue Evidence Admission

## Status

Completed as the queue-execution evidence component of Phase 7R.2, Runtime
Evidence Projection.

## Problem

`QueueTaskProcessorService` carries a queued classification payload to the
classification service. Queue payloads are transport records and can outlive
the profile, operator intent, routing state, or other evidence used to make a
current decision. Treating a payload or an earlier projection as current
evidence would create a time-of-check/time-of-use gap and could expose raw task
data to a later decision boundary.

The runtime evidence projection is already deterministic and side-effect-free,
but it had no queue-specific admission boundary. This component closes that
gap without changing worker, classifier, routing, provider, or persistence
behavior.

## Official Guidance Reviewed

- [CWE-367: Time-of-check Time-of-use Race Condition](https://cwe.mitre.org/data/definitions/367)
  describes the risk when a checked resource changes before use. Queue work
  must rebuild current evidence rather than rely on a stored projection.
- [OWASP API3: Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
  recommends allowlisted, schema-based data handling and minimal returned
  structures. The admission contract accepts an explicit evidence-field
  allowlist and omits task IDs and payloads from its result.
- [OWASP API10: Unsafe Consumption of APIs](https://owasp.org/API-Security/editions/2023/en/0xaa-unsafe-consumption-of-apis/)
  recommends validation and sanitization before data reaches downstream
  components. Queue payloads do not cross this evidence boundary.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports testable security controls that reduce and prevent recurring
  defects. The contract is deterministic and has regression coverage for ready
  and blocked states.

## Options Considered

### Reuse A Projection Stored With The Queue Task

Pros:

- Avoids rebuilding the projection at task execution.

Cons:

- Allows profile, intent, routing, or evidence freshness to drift after enqueue.
- Couples task payload/storage to policy evidence and increases raw-data
  exposure risk.

### Pass The Full Queue Payload Into The Projection

Pros:

- Gives later code access to all task fields.

Cons:

- Treats transport data as evidence.
- Increases the chance of raw title, provider, or request data crossing into
  diagnostics and automation decisions.

### Selected: Fresh Allowlisted Queue Evidence Admission

Pros:

- Rebuilds the existing runtime projection from current allowlisted evidence.
- Rejects cached projection and automation-decision fields.
- Produces a fingerprint bound to an opaque task fingerprint and retry attempt.
- Preserves the existing worker behavior until the automation-decision task
  wires the contract deliberately.

Cons:

- Requires the future queue executor to supply current evidence inputs.
- Does not itself run classification or enforce an automation outcome.

## Final Recommendation Stack

1. Keep queue payloads as transport-only data.
2. Rebuild a fresh `policy.runtime_evidence_projection.v1` result for each
   classification execution attempt from allowlisted evidence fields.
3. Reject `evidenceProjection`, `projectionFingerprint`, and
   `automationDecision` inputs as cached decision state.
4. Bind fresh evidence to an opaque task fingerprint, task type, and attempt;
   never return raw queue IDs or payloads.
5. Wire the admission result into the automation decision contract only in the
   subsequent runtime decision component, with no provider lookup or side
   effect in this module.

## Implementation Outcome

- Added `policyRuntimeQueueEvidenceAdmission.mjs`, an ESM-only, pure service.
- Admits only `classification` tasks and validates bounded task context.
- Accepts only projection-supported current-evidence fields.
- Reuses the existing projection and audit contracts, including sanitized
  projection fingerprints.
- Produces an execution fingerprint from the opaque task fingerprint, task
  type, attempt, and fresh evidence fingerprint.
- Blocks invalid task context, cached decision/projection data, unsupported
  evidence input, and invalid projections without returning a usable
  projection.
- Audits the exact fresh-projection fingerprint and allowlisted public queue
  and evidence shapes, preventing modified evidence bindings or raw task fields
  from being trusted by the next decision component.
- Registered the module as a required runtime contract surface in the Phase
  7R.1 decision inventory.

## Security Outcome

- No provider calls, queue mutations, classification execution, routing,
  learning writes, policy writes, or database reads are performed.
- Raw queue IDs and payloads are excluded from the result and enforced by the
  audit contract.
- Expected blocked outcomes remain valid, auditable, fail-closed results.
- A ready result requires a valid evidence projection and matching execution
  fingerprint.

## Verification

- Focused tests verify fresh bounded admission, fingerprint changes when
  evidence changes, cached-input rejection, unsupported task rejection, and
  tamper/raw-payload audit failures.
- Projection, automation-decision, and inventory suites verify reuse of the
  existing evidence and policy contracts.

## Follow-On Contract

The Phase 7R.3 queue decision adapter now consumes a ready admission, enforces
its execution fingerprint, and binds the decision to its fresh evidence. See
[Policy Runtime Queue Automation Decision](policy-runtime-queue-automation-decision.md).
