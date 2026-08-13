# Candidate-Bound Verification Remediation Readiness

## Status

11R.5 is complete on 2026-08-12. It adds an administrator-authorized,
read-only report that correlates candidate-bound verification aggregate health
with the current configured provider-admission path and anonymous active-policy
configuration readiness.

The report does not call a provider, test provider availability, expose
provider identity or model identity, read classification records, disclose AI
content, or mutate policies, routing, retries, learning, or configuration.

## Problem

11R.4 makes status-only verification outcome changes observable, but an
elevated rate alone cannot tell an operator whether the current configuration
can admit strict candidate-bound verification or whether active policies have
the native intent and routing prerequisites that deterministic classification
needs. Reading item history, provider diagnostics, or model responses to answer
that question would overexpose operational data and could encourage metrics to
be treated as routing authority.

## Official Research Basis

This implementation was reviewed against official guidance available in August
2026:

- OWASP recommends least privilege, deny-by-default authorization, and
  validating permissions on every request. The report therefore requires an
  administrator JWT role or an API key with `admin` permission at the route,
  rather than relying on a hidden client control. [OWASP Authorization Cheat
  Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- NIST's AI RMF Manage guidance calls for documented risk treatment,
  post-deployment monitoring, and response or recovery planning. The report
  distinguishes an observed trend from the current conditions needed to assess
  remediation readiness; it does not infer a cause from the aggregate.
  [NIST AI RMF Manage Playbook](https://airc.nist.gov/airmf-resources/playbook/manage/)
- OWASP logging guidance requires data minimization and restricted access to
  sensitive operational records. The report uses fixed status IDs and counts,
  never historic provider output, prompts, titles, policy names, library names,
  provider identities, models, endpoints, or credentials. [OWASP Logging Cheat
  Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

## Decision

Add `GET /api/stats/candidate-bound-verification/remediation-readiness?days=1..30`.
The endpoint is authenticated by the existing stats router and then requires
administrator authorization. It returns a versioned, fixed-shape report:

```json
{
  "version": "classification.candidate_bound_verification_remediation_readiness.v1",
  "aggregateHealth": {
    "driftStatusId": "elevated",
    "currentOutcomeCount": 24
  },
  "providerAdmission": {
    "statusId": "admitted",
    "admitted": true,
    "configurationOnly": true,
    "providerAvailabilityChecked": false,
    "providerCalled": false
  },
  "policyReadiness": {
    "evaluatedPolicyCount": 6,
    "readyPolicyCount": 5,
    "notReadyPolicyCount": 1,
    "allActivePoliciesReady": false,
    "statusCounts": [
      { "statusId": "ready", "count": 5 },
      { "statusId": "routing_unavailable", "count": 1 }
    ]
  },
  "readiness": {
    "statusId": "policy_readiness_required"
  },
  "sideEffects": {
    "providerCalled": false,
    "classificationRead": false,
    "policyMutation": false,
    "routingMutation": false,
    "retryQueued": false
  }
}
```

### Aggregate Health

The report reuses 11R.4's status-only metrics service. Its `driftStatusId` is
limited to `stable`, `elevated`, `insufficient_data`, or `unavailable` and the
only count is the current aggregate outcome total. A drift status is an
observation, not a diagnosis or authority input.

### Provider Admission

The provider section reads a minimum projection from `ai_provider_config`:
the configured provider type and model, fallback flags, and stored budget gate
values. Those values are evaluated locally with the existing provider-authority
and candidate-bound verification-admission contracts. The projection maps to a
fixed public result:

- `admitted`
- `not_configured`
- `budget_paused`
- `fallback_advisory_only`
- `capability_unavailable`

The report does not return the provider, model, endpoint, key, budget amount,
or usage. It also deliberately does not call `aiRouter.getProvider()`: that
method records operational warnings and is allowed to consider live runtime
behavior. This read answers only whether the current stored configuration can
admit strict verification. It is not a provider health, connectivity, quota,
or liveness probe.

### Policy Configuration Readiness

The policy section reduces active policy configuration to anonymous status
counts. For every enabled policy on an active library it checks only:

1. exactly one active native intent exists;
2. that intent has at least one purpose rule; and
3. the library has a configured Arr mapping with type, configuration ID, and
   root-folder path.

The only returned statuses are `ready`, `native_intent_unavailable`, and
`routing_unavailable`. The aggregate query never returns policy IDs, policy
names, library IDs, library names, destination names, profile evidence, or a
classification identity. It does not claim that a live media server is online,
that profile evidence is fresh, or that a specific item is route-eligible.

### Readiness Result

The server derives one of these fixed statuses:

- `ready`
- `aggregate_review_required`
- `provider_admission_required`
- `policy_readiness_required`
- `provider_and_policy_readiness_required`

The fixed recommended steps direct operators to review provider settings,
native policy and routing configuration, and the aggregate trend in that order.
They never enqueue a retry, alter a threshold, or change policy meaning.

## Alternatives

### Expose Item-Level Verification Diagnostics

Pros: could show the operator an apparently direct explanation for an elevated
trend.

Cons: expands the report into classification, candidate, policy, and provider
data; risks retaining or exposing raw model content; and turns an operational
trend into an item-review shortcut.

Decision: rejected.

### Run A Live Provider Health Or Connectivity Check

Pros: could distinguish configuration admission from current service
availability.

Cons: creates an external side effect, adds rate or outage behavior to a
diagnostic read, and conflates provider liveness with contract authority.

Decision: rejected. Existing explicit provider connection checks remain the
appropriate operational surface.

### Automatically Repair Provider Or Policy Configuration

Pros: can reduce manual operator work.

Cons: a metrics report cannot safely choose a provider, change a budget policy,
create intent, or alter routing. Automatic repair would violate deterministic
policy authority and least-privilege operation.

Decision: rejected.

## Final Recommendation Stack

1. Keep candidate-bound outcome monitoring status-only and aggregate-only.
2. Require administrator authorization for the separate remediation read
   model, including admin API-key support.
3. Evaluate strict verification admission from a minimum stored configuration
   projection using the existing server-owned authority contract.
4. Reduce deterministic policy readiness to anonymous counts of native intent
   and routing prerequisites.
5. Keep the report advisory and side-effect-free; provider liveness, policy
   edits, route decisions, and retries remain separate explicit operations.
6. Add a future configuration preflight that warns before a provider save when
   the proposed configuration is valid for general AI work but ineligible for
   strict candidate-bound verification.

## Implementation Evidence

- Pure report contract and configuration-only provider admission:
  `server/src/services/classificationCandidateBoundVerificationRemediationReadiness.mjs`.
- Minimum provider projection and anonymous active-policy aggregate query:
  `server/src/services/classificationCandidateBoundVerificationRemediationReadinessRepository.mjs`.
- Read-only orchestration service:
  `server/src/services/classificationCandidateBoundVerificationRemediationReadinessService.mjs`.
- Administrator-authorized route:
  `server/src/routes/statsRouteCandidateBoundVerificationRemediationReadiness.mjs`.
- Unit, route, and PostgreSQL integration coverage prove the bounded data
  shape, denied non-admin route execution, status behavior, and exclusion of
  test item, library, and policy names.

## Next Task

Proceed with **11R.6 Verification-Capable Provider Configuration Preflight**.
Use the same provider-authority contract to present a server-authored warning
before configuration save when a proposed primary or fallback path cannot
provide strict candidate-bound verification. It must remain advisory for
general AI configuration, must not probe a provider, and must never silently
rewrite provider, model, budget, fallback, policy, or routing settings.
