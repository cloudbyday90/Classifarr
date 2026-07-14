# Policy Compatibility Deletion Current Inventory

## Intent

Compatibility removal cannot rely on a manually supplied conversion count or
on a historical migration report. Before an execution plan can become ready,
Classifarr must read the current database state for every enabled policy and
verify that each has exactly one active, valid native intent. This component is
read-only: it never converts a policy, deletes compatibility code, changes
storage, or writes an artifact unless an operator explicitly supplies
`--output`.

The inventory returns aggregate counts and at most 20 policy IDs per finding.
It never includes policy-intent payloads or library names.

## Official-Source Research

- NIST SSDF frames secure development as outcome-based practices and includes
  configuration/change control. A deletion decision should therefore use the
  actual current configuration rather than an assertion copied from an earlier
  workflow.
- NIST SP 800-53 CM-4 requires analyzing changes before implementation. The
  current inventory supplies a bounded pre-change analysis of the active policy
  authority that compatibility deletion would affect.
- SLSA verification guidance requires evidence to satisfy a verifier's
  expectations. The execution-plan boundary therefore rejects absent or
  nonconforming inventory evidence instead of accepting an unverified count.

Sources:

- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
- [NIST SP 800-53 Rev. 5.1](https://csrc.nist.gov/CSRC/media/Projects/risk-management/800-53%20Downloads/800-53r5/SP_800-53_v5_1-derived-OSCAL.pdf)
- [SLSA Verifying Artifacts](https://slsa.dev/spec/v1.2/verifying-artifacts)

## Options Considered

### Reuse The Deletion-Gate Count

Pros:

- no new query or command,
- keeps the existing deletion-gate contract unchanged.

Cons:

- the count is caller supplied and can be stale or incomplete,
- it cannot detect missing, ambiguous, legacy-sourced, or invalid active intent
  authority for an enabled policy.

### Trust A Historical Migration Report

Pros:

- explains prior conversion work,
- adds no database query before planning.

Cons:

- an enabled policy can change after the report is generated,
- it permits a historical result to stand in for present authority.

### Query Current Enabled-Policy Authority

Pros:

- evaluates every enabled policy immediately before plan construction,
- uses the latest validation status and error count for each active intent,
- exposes only bounded diagnostic metadata,
- remains safe to repeat because it is read-only.

Cons:

- requires database availability at planning time,
- deliberately blocks an otherwise complete plan until all enabled policies are
  native-authoritative.

## Final Recommendation Stack

1. Query enabled policies and active intents in one read-only statement.
2. Resolve each active intent against its latest validation record.
3. Accept a policy only when it has exactly one `native_intent` with a valid or
   warning validation state and zero validation errors.
4. Block missing, ambiguous, or non-authoritative authority with count-based,
   bounded diagnostics.
5. Require this validated inventory in both deletion readiness and execution
   planning; do not let a manually supplied zero count bypass it.
6. Keep conversion, approval, and code deletion in their separate controlled
   workflow steps.

## Implementation Outcome

Implemented:

- `policyCompatibilityDeletionCurrentInventory.mjs` provides a pure inventory
  classifier and a database-backed loader.
- The loader reads only enabled policy IDs, active-intent authority metadata,
  and the latest validation status/error count.
- `policyCompatibilityDeletionReadiness.mjs` blocks without a current valid
  inventory, and the execution-plan service repeats the contract check as a
  defense-in-depth boundary.
- `npm run policy:compatibility-deletion-current-inventory` emits the
  read-only JSON report. It can persist an explicitly requested diagnostic
  artifact, and `--require-all-enabled-policies-native` turns the result into a
  non-zero gate when conversion is incomplete.

Example:

```bash
npm run --silent policy:compatibility-deletion-current-inventory -- \
  --output .tmp/policy-storage/current-policy-inventory.json \
  --require-all-enabled-policies-native
```

## Next Step

Use the current inventory as one required input to the compatibility deletion
execution plan. The next component should define a single orchestration path
that collects this inventory, cutover evidence, and deletion gates together so
their freshness cannot drift between separate manual steps.
