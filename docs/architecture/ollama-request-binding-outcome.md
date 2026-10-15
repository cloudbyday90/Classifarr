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
- Server type checking, test/security lint, both dependency-usage checks, static
  ESM imports, ESM mock shapes, migration/snapshot integrity, Markdown, copyright,
  reviewed inventory ownership and secret scanning passed.
- The first full unit run started before the reviewed ownership digest was saved:
  58,746 passed, one ownership-gate failure, one existing skip. The corrected gate
  passed independently. The final full rerun passed all 1,848 suites and 58,747
  tests, with one existing skip (524.23 seconds).

## Image and local evaluation

Clean runtime source: `7d9a907ba10b7a07ca1c01a1aa3d37f93455d394`.
No-cache build completed with source provenance and no version/tag release.
Image: `sha256:2b163ae65240da990e4534ad37e6079190db713e50c84d2a03e99322ae6d2954`.
Later outcome-only documentation does not change that runtime source.

- Packaged gateway rehearsal passed: credential reload/revocation, shared provider
  context, streaming, embeddings/warming, abrupt death, restart fencing and
  preserved uncertainty. Nineteen synthetic calls in the main fixture.
- Completion/offline recovery fixture passed: five attempts, four synthetic
  provider calls, real elapsed cooldown, original binding retained through hold
  and resume, UUIDv7 receipts and no provider calls from recovery.
- Docker-boundary rehearsal passed: running/stopped observations and restart pin
  refusal, packaged read-only CLI, no recovery authority. Exact owned resources
  were removed and cleanup verified for both runners.
- TLS/network rehearsal passed: one synthetic compute call saved the exact
  declared Docker container/start reference and UUIDv7; the application network
  could not reach the provider directly. Owned containers/networks/private test
  keys were removed and cleanup verified.
- Local Compose replacement passed: exact image/source above, healthy container,
  HTTP `/health` 200, zero restarts, no OOM, UID/GID 1000, read-only filesystem,
  no-new-privileges and unchanged 2 GiB limit. Initial sample: 308 MiB, 0.73% CPU;
  a later sample was 879.4 MiB, 71.88% CPU while still healthy with zero restarts.
  These are point-in-time observations, not a sustained-load benchmark.
- Gateway/routing environment settings remain absent; no Docker socket mount and
  no `ollama_gateway` schema in the application database. Workload settings before
  and after remain `when_idle`, zero daily call/token limits and reservations,
  revision 2, unchanged next-check timestamp. No shared-provider cutover occurred.

Pre-replacement local backup: `data/backups/gateway-binding-before-20261015.dump`.
SHA-256: `F824BA34557848950F99863C0DEA9BE3C38EDA2E9088B5B5423AC1B178675F2A`.
`pg_restore --list` read 1,933 lines; this is archive readability, not a restore drill.
Previous image retained as
`classifarr-local-rollback:ab2d95c96632a742fdcd6252ad66b741f37ce86509da6d710fc270dc5e5569f0`
(`sha256:401dc1b733e81361b4905eda86baa5cc9271a3cb77a1e26930a5e6a71fdeefe6`).

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

Real PG upgrade tests apply historical v1/v2 SQL, not a published old image. The
packaged rehearsals are fresh isolated databases and same-image process restarts,
not proof of a published-release upgrade. No frontend files changed; the no-cache
image rebuilt the UI, but the frontend test suite was not rerun for this backend
change. The recovery-change skill drove explicit unknown-outcome tests, separated
design/outcome records and image/cleanup verification without authorizing recovery.
