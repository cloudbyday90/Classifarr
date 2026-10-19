# Qualification rehearsal input binding design

Date: 2026-10-19. Approved local-only scope; no release or production recovery.

## Goal and boundary

Extend the existing committed-input boundary to all five qualification routes:
`--qualification`, `--cleanup`, `--catalog-qualification`, `--catalog-memory`
and `--catalog-memory-baseline`. Scheduling/rotation remains the next increment.
This improves evidence integrity, not production archive performance. Fresh
installations gain no background work, schema, service, purge authority or UI.

Bind the twelve existing fixture files and three direct entrypoints to clean Git
bytes and an independently inspected immutable image ID/revision. Stage through
the existing private volume helper, seal files before database startup, remove
the writable stager, and inspect read-only executable mounts on every consumer.
Keep writable configuration, archive/receipt/catalog outputs and private restore
scratch separate. Do not mount over packaged application code or dependencies.

## Official research and alternatives

Retrieved through search/GitHub MCP on 2026-10-19:

- [Docker volumes](https://docs.docker.com/engine/storage/volumes/) documents
  read-only mounts and inspecting their actual read/write state. A read-only
  consumer alone is insufficient while another container retains write access.
- [SLSA artifact verification](https://slsa.dev/spec/v1.2/verifying-artifacts)
  requires expected artifact identities and authenticated provenance. Local
  hashes, clean source and OCI labels are useful integrity checks, not signatures
  or a SLSA level claim; a compromised host/daemon/image remains outside this proof.
- [markdownlint 0.42.0 notes](https://github.com/DavidAnson/markdownlint/blob/b67636d47f335cf124990faae4a72c5e9fadd613/CHANGELOG.md)
  describe regex-denial-of-service protection and parser/rule updates.
  Its [manifest](https://github.com/DavidAnson/markdownlint/blob/b67636d47f335cf124990faae4a72c5e9fadd613/package.json)
  supports Node >=22, ESM and the existing Promise API.

Recommendation stack: committed Git inputs, fixed manifest/entry policy,
builtin-only same-process pre-import verification, sealed read-only named
volumes, independently validated output framing, real isolated PostgreSQL
scenarios, and exhaustive ownership-fenced cleanup.

Compared with unbound worktree copies, this detects stale/changed inputs before
execution but adds startup I/O and closure maintenance. Compared with a second
launcher process, same-process verification preserves direct-child PID identity
and memory attribution; it requires explicit tests for indirect launch paths.
Packaging every fixture into the application image would simplify copying but
couple test-only tooling to production artifacts; retain the existing separation.

## Contracts and weak points

- The driver preloads `cleanupQueryDiagnostics.mjs` and launches
  `archiveEvidenceVerifier.mjs` through fixed paths. Verify their complete sealed
  closure before importing the driver. This is verified launch closure, not an
  independent child attestation. No added wrapper process or inherited Node flags.
- Keep max-three arguments and 32 KiB per argument for existing studies. Permit
  exactly `archiver normal catalog measure` only for the qualification driver,
  checked host-side and after manifest-digest verification inside the bootstrap.
- Empty logs from a running worker are pending within the existing deadline;
  stopped empty, malformed, duplicate, failed or mismatched binding logs refuse.
  Accept no limits, boundary, diagnostic or metric before the expected first
  binding. Preserve source JSON and worker NDJSON body bytes after validation.
- Preserve worker/native-child topology, actual export/COPY observations before
  signals, cancellation, persisted attempts/cooldowns and publication ambiguity.
  Do not retry uncertain writes or refund attempts to advance a scenario.
- Preserve 256 MiB/0.5 CPU/32 PID archiver-cleanup and 1536 MiB/1 CPU/64 PID
  verifier envelopes, equal memory/swap, network-none, no ports, no source
  socket/configuration in verifiers, and bounded scratch. Read-only socket
  mounts still permit SQL; only synthetic role/configuration authority is used.
- Measured and unsampled catalog-wide runs use the same new subject. Worker
  elapsed time starts at the unchanged child spawn; host elapsed and lifetime
  cgroup peaks also include bootstrap overhead. Baseline means unsampled, not an
  older image. No direct performance comparison with historical unbound runs.
- Try every exact owned cleanup and source recheck after failures. Missing
  containers are harmless; foreign ownership, failed removal or residual labels
  fail completion. Abrupt host loss may leave labeled resources; no new cleanup
  daemon or automatic destructive recovery is authorized.

## Random PR and dependency scope

Random choice from open PRs 566, 565, 564, 563 and 562 selected
[PR 562](https://github.com/cloudbyday90/Classifarr/pull/562), head
`daf9a4b6dfa306ebb425dd3379025f287bee7f88`, based on `aab6e238`.
Implement its root-only markdownlint update locally, without merging. Pin exactly
0.42.0. Remove only the stale root `string-width` 8.2.0 override so the parent's
exact 8.3.0 request is honored; retain all other security overrides. The earlier
[pin audit](dependency-pin-audit-2026-10-08.md) already identified that downgrade.
Registry metadata agrees with upstream and adds no install lifecycle scripts.
Review all transitive lock changes, full-scope audit and strict-script install.
Keep MD012/MD047, file selection and retired vulnerable dependency guards intact.

## Verification and completion

Add positive/negative bootstrap, indirect closure, exact sandbox, output startup
framing and cleanup regressions; retain common/default binding and memory tests.
Run dependency tooling, complete Markdown checks and affected repository gates
without blanket ownership refresh. Commit the implementation before native tests
so clean-source binding is meaningful. Rebuild Compose without cache and run
all qualification cases, cleanup alias and sampled/unsampled catalog-wide paths
against that exact local image. Verify real restore/protection/attempt assertions,
zero external provider calls and all owned-resource cleanup. Protect the existing
local image/data before refreshing only the local application service, check
health and unchanged optional-provider guards. Record actual results, failures,
skips and identities in a separate outcome document; commit/push on main without
tags, release, PR merge, Unraid or shared Ollama changes.
