# Node 24 declaration patch outcome

Date: 2026-10-09 (America/New_York). See the
[design, sources and recommendation stack](node24-types-patch-design.md).

## Accepted change

Client and server now request `@types/node` `^24.19.2` and lock exactly 24.19.2.
The reviewed registry integrity matches both lockfiles. Automated comparison
against the original locks confirms only the root declaration range and the
`node_modules/@types/node` entry changed. `undici-types` remains 7.24.6; no
runtime package, compiler, security override, lifecycle policy or schema changed.
The correction only expands `util.styleText` format-array declarations. A direct
ESM probe confirmed the pinned Node 24.21.0 runtime accepts the hex/modifier array.

Random PR 556 was applied locally at its immutable reviewed head, tested, rejected
and restored before this update. It again failed Discord's request-body type
boundary and the runtime-major guard. No PR was merged or closed. See the
[separate PR outcome](pr-556-node-types-outcome.md) for exact failures and recovery.

## Validation so far

- Pinned local Node 24.21.0 and npm 12.2.0; no global installation changes.
- Strict-policy `npm ci`: 632 server packages and 287 client packages.
- Full `npm ls --all` passed in both workspaces.
- Full `npm audit --json`, including development dependencies: zero reported
  vulnerabilities in both workspaces. This is a dated scanner result, not a
  blanket security guarantee.
- Server typecheck and both client typecheck projects passed.
- Server and client lint, Knip and production dependency analysis passed.
- Dependency-tooling regression checks: 40 passed, none skipped.
- Larger coverage suites, build, local no-cache image and schema verification
  are pending; do not treat this intermediate record as completed validation.

No release or version bump. Memory, recovery, ownership and provider safeguards
remain unchanged; production Unraid and shared Ollama are outside this change.
