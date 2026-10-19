# Gateway scheduling rehearsal binding — design

Date: 2026-10-19. Approved through the repository grill-me workflow. This is a
local evidence change, not a production scheduling or retention optimization.

## Scope and contract

Bind both `--catalog-scheduling` and `--rotation-study` to clean committed inputs,
an immutable image ID and its full source revision. The complete closure is
`catalogScheduling.mjs`, `catalogRotationStudy.mjs`, `rotationStudyContract.mjs`.
Only the first is executable by the host, with one allowlisted action. Distinct
`regression` and `rotation` profiles bind the requested intent. No schema, new
table, package, admin function, provider call or optional-service activation is
needed. Existing PostgreSQL UUIDv7 record identities remain unchanged.

Stage exact Git bytes into a private volume, verify the manifest before parsing
or importing fixtures, reject symlinks/extra/missing/changed files, seal the
volume and remove its writable stager before source startup. The source mounts
fixtures read-only; generated private configuration and rotation state stay in
`/tmp`, and generated artifacts stay in separate owned volumes. Preserve original
mixed output after validating its exact leading binding record.

Both verifiers keep their packaged image entrypoint, no copied fixtures, no
source socket/configuration/credentials and writable receipts only. Inspect exact
image, command, named mounts, resources, tmpfs, security settings and environment.
Accept exactly one bounded JSON result `{state:"verified",purgeAuthorized:false}`
and successful stopped/non-OOM process state, not a substring in arbitrary text.

## Bounds and failure behavior

One rehearsal at a time on the local 8 GiB Docker VM; native restores remain
sequential. Source: 2 GiB, equal memory/swap, two CPUs, 512 PIDs, network none and
the production image entrypoint. Verifiers: 1536 MiB/no swap, one CPU, 64 PIDs,
network none, read-only root, UID 1000, dropped capabilities, no-new-privileges,
1 GiB verification tmpfs and 16 MiB temporary tmpfs. The source child worker still
uses its original 130-second kill guard and 120-second capture signals; Docker
commands retain their 240-second/1 MiB bounds. This small source harness is not
the deployed 256 MiB worker cgroup and cannot prove its headroom.

Invalid inputs refuse before setup. Failed/malformed/unknown results fail the
run; no automatic replay or refunded attempts. Registration-before-acknowledgment
is a deliberate durable boundary cut, not an observed crash. Ordinary handoff and
all three controlled rotation cycles preserve historical rows, shared attempts,
two retained roots and zero live-history cleanup operations. Only the pure
scheduling observation advances by a day; SQL timestamps, attempts and cooldowns
are untouched. This does not prove an actual day or normal cadence elapsed.

Cleanup tries every exact labeled resource, including stager and fixtures, then
checks labels, source integrity and disposable-data absence. Cleanup failure
prevents success. Existing schema-helper signal exits and abrupt host loss can
still bypass outer cleanup; report residual owned resources, never infer success
or add automatic destructive cleanup. No Docker pruning or caller image removal.

## Research and tradeoffs

Official URLs were discovered/opened through MCP on 2026-10-19:

- [Docker volumes](https://docs.docker.com/engine/storage/volumes/) supports
  read-only mounts and inspecting their actual configuration. We separate sealed
  executable inputs from writable artifacts instead of trusting directory names.
- [PostgreSQL 18 pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html)
  supports consistent concurrent exports and warns that restoring SQL executes
  source-controlled code. Keep the existing isolated native restore boundary.
- [SLSA artifact verification](https://slsa.dev/spec/v1.2/verifying-artifacts)
  compares artifacts against independently formed expectations. Our local manifest
  applies that principle to test inputs; it is integrity evidence, not a signature
  or proof against a compromised host, daemon or image.

Recommended stack: existing modular ESM binding helpers, PostgreSQL 18/native
UUIDv7 and fixture-free isolated Docker verifiers. Benefit: reproducible evidence
without extra services or runtime behavior changes. Cost: hashing/staging and
maintaining a fixed closure. Embedding every fixture into the application image
is another sound boundary but couples fixture edits to image packaging. Reducing
production checks now is rejected: previous partial memory observations cannot
establish headroom or equivalent safety.

## Separately attributed dependency batch

Random selection from open PRs `[566,565,564,563]` chose index 2, PR
[#564](https://github.com/cloudbyday90/Classifarr/pull/564), immutable head
`576f55df191e3e85194ed548bce215639ab93e1a`. Implement its five exact client-tooling
updates locally, not by merging: Playwright 1.64.1, Vitest and coverage-v8 5.0.5,
jsdom 30.1.3, PostCSS 8.5.30. Keep strict install policy and security overrides.

Official [Playwright](https://github.com/microsoft/playwright/releases),
[Vitest](https://github.com/vitest-dev/vitest/releases),
[jsdom](https://github.com/jsdom/jsdom/releases) and
[PostCSS](https://github.com/postcss/postcss/blob/main/CHANGELOG.md) notes were
reviewed with engine/peer/lifecycle registry metadata. Node 24.21.0 satisfies
these versions; Vitest and coverage must stay aligned. Review DOM selector 10.x
and Undici transitive changes, not just the five direct patch numbers. PostCSS
8.5.31 is already available with a further source-map correction: keep the PR's
exact 8.5.30 for attribution and record that follow-up, rather than silently
expanding this batch. An [unconfirmed upstream report](https://github.com/microsoft/playwright/issues/43518)
describes Firefox risk in the Playwright Docker image; this repository's browser checks use local Chromium,
not that image or Firefox. Do not represent the report as a validated finding.

## Verification and completion

Test closure/profile/action framing, both changed helpers before side effects,
wrong manifests, write refusal, malformed/forged verifier results, exact sandbox
mutations, original action order/cycle counts and try-all cleanup failures. Run
existing gateway/rotation and affected server contracts, preflight, lint/types,
policy/ESM checks and documentation/secrets checks without refreshing baselines.
Review the lock graph, strict npm ci, npm ls and full client audit; run client
configuration, coverage, build and production-browser checks. Do not claim the
coverage ratchet without current reports for both workspaces.

After a clean implementation commit, rebuild local Compose without cache and run
both native modes against that exact image/revision. Verify binding refusal,
actual input protection, restores, attempts, history and full owned cleanup.
Refresh only normal local Classifarr with backup/rollback retained and evaluate
health/unchanged optional-feature guards. Record observed results separately,
commit/push on main without tags or release. Next assess the smallest redundant
check with equivalent safety evidence; do not reduce checks in this increment.
