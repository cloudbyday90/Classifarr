# QEMU action update outcome

Date: 2026-09-07.

## Change and provenance

Implemented [PR #526](https://github.com/cloudbyday90/Classifarr/pull/526)'s single
SHA replacement in `.github/workflows/ci.yml`. It was selected randomly from the
five open PRs, 526–530. The official upstream tag resolves to
`1f40c72289eff860ee54a304f1438e3cff362e0a`, matching the proposed pin. The original
PR was not merged through GitHub; its change was adopted and tested locally.

The [design](qemu-action-update-design.md) records official sources, alternatives,
security properties and limitations. v4.3.0 was published September 1, after the
requested August research cutoff. That date is not presented as August guidance.

## Local validation

- Actionlint 1.7.12 passed against the full changed CI workflow, with optional
  shellcheck and pyflakes integrations disabled. YAML/action structure was checked.
- The exact upstream tag and Node 24 action metadata were verified with GitHub MCP.
- Docker Buildx reported ARM64 support. A disposable `linux/arm64` container using
  the repository's `node:24.18.1-alpine3.24` base ran Node and returned `arm64`.
  The resolved base manifest digest was
  `sha256:f70403e87646dc51b45295f4b8b70cdad0b63d2297c4c9899119b03f7af7a6b3`.
- The application image built locally alongside the lifecycle change. No image
  was pushed and no release job was dispatched. Fresh disposable-container
  startup and authoritative schema comparison also passed.

The ARM64 smoke test exercises local Docker emulation, not the action's execution
inside a GitHub runner. Its cache, post step and privileged emulator installation
were not exercised locally. Existing Docker Desktop emulators were used without
resetting host registrations. The initial attempt to run the local AMD64-only app
image as ARM64 had no matching image; the smoke test therefore used the explicit
ARM64 official Node base instead.

## Final recommendation

Keep the verified full SHA and Dependabot maintenance. This trades explicit
reviewed updates for reproducible action code. Retain the tag-only release job;
this commit contains no release or version bump. A future supply-chain improvement
can pin the action's binfmt image digest with automated refresh, since the current
default image remains floating independently of the action SHA.
