# Gateway request-binding outcome

Date: 2026-10-15. Unreleased; local-only implementation.

## Implemented

The standalone gateway saves an append-only UUIDv7 record atomically with each
admitted attempt. Optional administrator-configured Docker daemon/container/image
and exact start references survive completion, cancellation, restart and offline
recovery. Legacy requests remain explicitly unbound. No historical ownership is
invented; no uncertain work is automatically cleared or replayed.

Configuration validation, claim persistence and offline projection are separate
ESM modules. The timestamped version-3 upgrade preserves attempts, cooldowns,
active work and maintenance holds; the fresh standalone schema matches. No
Classifarr application migration or new default background work is introduced.

See the separate [design and research](ollama-request-binding-design.md),
[gateway operations](../operations/ollama-gateway.md) and
[offline recovery procedure](../operations/ollama-gateway-offline-recovery.md).

## Review and verification

- Reviewed every changed SQL statement and the extracted request-binding
  repository before updating the ownership gate's ledger source digest. All
  writes target only the dedicated `ollama_gateway` schema. The completion check
  now also requires the immutable binding's original owner and provider. The
  atomic claim preserves the shared lock/fences and increments a bounded history
  counter without touching inventory, caller budgets or routing. The ownership
  analysis digest is unchanged; this is not approval of historical writer debt.
- Focused unit tests: 9 suites, 240 tests passed.
- Real isolated PostgreSQL/HTTP tests: 5 suites, 129 tests passed, including
  commit-before-dispatch, rollback, lost acknowledgement, cancellation, unknown
  transport, owner changes, least privilege, history capacity, v1/v2 upgrades,
  fresh/upgrade column-and-constraint parity and preserved recovery bindings.
- The first focused run rejected the warm fixture's nonempty response; correcting
  the fake provider to return an empty warm response made the test pass without
  relaxing production validation.
- Full tests, quality gates and image/Compose evaluation are pending below.

## Boundaries and next item

The record proves which configuration admitted a request, **not which container
actually handled it**. No Docker socket is exposed to Classifarr or the gateway.
Automatic recovery remains disabled. The 100,000-record history limit fails
closed and has no purge/reset path; a retention policy is still required before
unattended production use. Capacity tests inject the counter near its boundary,
not 100,000 real requests. Lost replies are simulated after real database writes.

Current PR enumeration returned zero open PRs, so none was selected or merged.
No release, Unraid change, shared Ollama call or live recovery is authorized by
these results. Next: design an exclusive dedicated-provider lifecycle and ingress
authority that binds actual dispatch to an exact start instance, before enabling
machine-authorized stop recovery. Retain offline administrator review meanwhile.
