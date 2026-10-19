# Default gateway archive test input binding

## Approved scope

Extend committed-input protection to the no-flag archive/catalog/retention
rehearsal only. Keep the common five study modes and the separate qualification,
cleanup and scheduling families distinct. This is local test tooling, not a new
admin function, production self-healing, permission to purge, or a release.

The smallest failure is a rehearsal attributing a result to an immutable image
while executing different working-tree fixture code. Catalog verifiers currently
mount that code directly from the host; producer copies are separately mutable.
The prior CI run also exposed a fresh-checkout bug: the binding tests and stager
assume an ignored `.tmp` directory already exists. Fix the precondition in both
the runtime helper and test setup, and test an actually empty working directory.

## Contract and weak points

- Bind exactly seven committed regular Git blobs: `archiveRestoreInput.mjs`,
  `onlineArchive.mjs`, `archiveProtection.mjs`, `catalogArchive.mjs`,
  `catalogLateFiles.mjs`, `catalogRetention.mjs`, `catalogRetentionGuards.mjs`.
  The last file of each catalog pair is helper-only. Record image ID, image
  revision and fixture revision independently; preserve row-mode's parity rule.
- Add one explicit archive/regression policy, using the existing version-2 test
  manifest and bounds. Seal a private input volume with the existing isolated
  stager; remove its writable mount before any workload. Every fixture executor
  mounts that volume read-only. Never cover packaged `/app` code or dependencies.
- The builtin-only bootstrap verifies the host-command-pinned manifest digest
  before interpreting it or importing copied code. Preserve no-follow reads,
  exact file closure, original arguments and existing byte/argument limits.
- Check and remove exactly the independently expected leading binding record.
  Preserve all remaining output bytes: retention capture returns a bare UUIDv7,
  other steps return text, and verification returns a JSON receipt. Reject
  missing, mismatched, repeated and failed binding records, not just a `passed`
  string. Do not import generated output or broaden the receipt argument bound.
- Generated state stays in existing owned archive/receipt/catalog stores and
  private `/tmp` scratch. Default fixtures need no shared results volume. The
  packaged archive verifier needs no copied-code mount; pin and inspect its
  original command separately. Catalog verifiers receive neither source socket,
  source configuration, credentials, Docker socket nor external networking.
- Preserve UID 1000, read-only verifier roots, dropped capabilities,
  no-new-privileges, 1536 MiB/no swap, one CPU, 64 PIDs and bounded scratch.
  Source stays a disposable real-entrypoint PostgreSQL container: 2 GiB/no swap,
  two CPUs, 512 PIDs and no network/ports. Staging remains 128 MiB/no swap,
  half a CPU, 16 PIDs and no network. Inspect actual commands and mounts.
- Preserve private restore-input checks, restricted roles, receipt crash and
  downgrade refusal, inventory/file tampering, corruption, protection pins,
  interrupted retirement, large integers, timestamps, cancellation and attempts.
  Existing fixture clock changes and legacy formats remain explicitly synthetic;
  they do not prove elapsed cooldowns or a published-image upgrade.
- One invocation, no automatic retries. Dirty source, changed inputs and malformed
  evidence permanently fail that invocation. Cancellation/crash produces incomplete
  evidence, never success. Reruns use fresh synthetic resources, not refunded live
  attempts. No schema, retry, retention, schedule or provider setting changes.
- Attempt every cleanup action even if another fails, with exact-name and label
  fences. Recheck committed source on success and failure before cleanup completes.
  Only report overall success after owned containers, volumes and disposable data
  are verified gone. Abrupt host/process loss can leave labeled resources; this
  tooling is not a cleanup daemon or protection against a compromised trusted host.

## Research, alternatives and recommendation

Official sources discovered through MCP and reviewed on 2026-10-19:

- [SLSA 1.2 verification](https://slsa.dev/spec/v1.2/verifying-artifacts)
  requires expectations independent of the evidence being checked. We apply that
  principle to image, fixture and command identity; this is not a SLSA attestation.
- [Docker volumes](https://docs.docker.com/engine/storage/volumes/) permits
  simultaneous writable and read-only consumers. Therefore sealing and removing
  the stager matters; an RO verifier alone does not protect a mutable producer.
- [Docker bind mounts](https://docs.docker.com/engine/storage/bind-mounts/)
  exposes host paths directly and can obscure packaged image files. Replace host
  executable binds with the sealed volume, without obscuring application files.

Copy-time hashes are simpler but leave later drift possible. Extending every
rehearsal at once closes more gaps but combines unrelated staging and upgrade
contracts. The selected default-family batch reuses the proven boundary with
seven maintained inputs and small staging overhead. The output adapter adds a
protocol boundary; exact mixed-format tests are mandatory. Broadening production
recovery or reducing checks has no evidence from this tooling change alone.

Final stack: committed blobs → independent image/fixture identities → sealed
read-only inputs → command-pinned pre-import checks → lossless validated output
framing → unchanged native archive assertions → exhaustive owned cleanup.

## Verification and completion

Add positive and fail-before-side-effect bootstrap coverage, complete closure
checks, receipt/UUID/text framing, bounded arguments, sandbox mutation checks,
fresh-directory staging and failure-cleanup contracts. Run gateway tooling,
affected backend/preflight/security-workflow contracts, lint/types and policy
gates. Run the full unchanged default native scenarios and a common-runner smoke
against an exact committed image. No-cache Compose rebuild, protected backup and
local readiness evaluation follow; never enable optional services or real Ollama.
Record exact subjects, failures, skips and limitations in a separate outcome.
Keep main, update Unreleased, commit and push; no tag, release or PR merge.

Next: bind the separate qualification/cleanup rehearsal family, followed by
scheduling/rotation, before using all of their evidence to justify reduced checks.
