# Policy Runtime Queue Dispatch Cutline

## Status

Completed as the queue-dispatch component of Phase 7R.1, Runtime Decision
Inventory And Cutline.

## Problem

The runtime inventory covered classification retry helpers, but it did not
require the queue components that dispatch classification work: the queue
service, worker loop, task processor, manual mutation service, and scheduled
retry driver. Those components can replay stale work or mistake a completed
classification for a completed route.

Changing queue behavior during an inventory task would create unnecessary
runtime risk. The correct first step is a server-owned, side-effect-free
cutline that makes each execution surface explicit and establishes its future
contract boundary.

## Official Guidance Reviewed

- [OWASP API9: Improper Inventory Management](https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/)
  recommends current inventories and retirement plans for API and integrated
  service surfaces. The queue path is an internal service boundary whose
  decision flow needs equivalent current ownership and documentation.
- [OWASP API5: Broken Function Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/)
  recommends explicit, consistently applied authorization for sensitive
  functions. Queue mutation and dispatch must remain behind server-owned
  automation-decision and manual-outcome boundaries rather than infer authority
  from a task alone.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports secure design, verification, and recurrence prevention. A focused,
  regression-tested inventory closes the observed coverage gap before behavior
  changes are attempted.
- [Microsoft safe deployment guidance](https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/safe-deployments)
  favors small, quality-gated changes with health checks. This change adds only
  validation metadata and focused regression coverage; it does not modify a
  live queue path.

## Options Considered

### Keep Queue Dispatch Under The Existing Retry Stage

Pros:

- No inventory-contract changes.
- Lowest immediate edit count.

Cons:

- Hides the queue service and task processor behind retry helpers.
- Cannot require worker, dispatch, mutation, and scheduled retry surfaces.
- Leaves stale-decision replay and routing-conflation risks untracked at the
  point where classification work is executed.

### Rewrite Queue Behavior During The Inventory Task

Pros:

- Could enforce automation-decision admission immediately.

Cons:

- Changes a live processing path without the next runtime evidence and
  automation contracts being evaluated in this task.
- Expands blast radius across worker lifecycle, retry, persistence, and Arr
  routing behavior.

### Selected: Add A Queue-Dispatch Cutline Only

Pros:

- Makes every live classification-dispatch component visible and testable.
- Separates retained generic queue lifecycle work from policy-sensitive
  dispatch, mutation, and retry behavior.
- Requires explicit stale-decision and classification/routing risk records.
- Preserves runtime behavior while establishing the next safe rewrite boundary.

Cons:

- Requires future runtime work to honor the recorded decisions.
- Does not by itself stop a currently stale task from running.

## Final Recommendation Stack

1. Use `queue_dispatch` for the queue service, worker loop, and task
   processor; keep `queue_retry` for retry and mutation behavior.
2. Keep `queueWorkerLoopService.mjs` as a generic runtime engine primitive.
3. Rewrite `queueService.mjs`, `queueTaskProcessorService.mjs`,
   `queueMutationService.mjs`, and `schedulerOperationalTasks.mjs` around
   current automation-decision state in later runtime components.
4. Require all five queue surfaces in the runtime inventory and fail closed
   when one is missing.
5. Require classification/routing-conflation risks on queue service and task
   processor records.

## Implementation Outcome

- Added the `queue_dispatch` runtime stage to
  `policyRuntimeDecisionInventory.mjs`.
- Added five queue execution artifacts with ownership, authority source,
  cutline decision, replacement target, and bounded risk records.
- Added a dedicated required queue-dispatch surface list and a stable
  `missing_queue_dispatch_surface_artifact` failure reason.
- Preserved the queue worker loop as a retained lifecycle primitive; dispatch,
  mutation, and scheduled retry paths remain marked for contract-based rewrite.
- Added focused regression tests for required queue coverage, stage/decision
  classification, conflation risks, and a missing task-processor failure.

## Security Outcome

- No queue worker, task processor, scheduler, routing, provider, database, or
  policy behavior changed.
- Queue execution paths cannot silently bypass inventory ownership during later
  runtime work.
- Manual requeue and scheduled retries are explicitly recognized as potential
  stale-decision replay paths.
- A completed classification remains distinct from a completed route in the
  queue service and task processor cutline.

## Verification

- `policyRuntimeDecisionInventory.test.mjs` validates default inventory success
  and rejects a missing queue task processor with both queue-coverage and
  routing-conflation issues.
- All default inventory paths resolve from the repository root.

## Next Task

Phase 7R.2, Runtime Evidence Projection, should audit its current projection
inputs against the newly explicit queue-dispatch boundary. It must keep queue
payloads as transport data, re-evaluate evidence and automation decisions at
execution time, and avoid provider calls, routing, learning writes, or browser
controls during evidence projection.
