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

## Validation

- Pinned local Node 24.21.0 and npm 12.2.0; no global installation changes.
- Strict-policy `npm ci`: 632 server packages and 287 client packages.
- Full `npm ls --all` passed in both workspaces.
- Full `npm audit --json`, including development dependencies: zero reported
  vulnerabilities in both workspaces. This is a dated scanner result, not a
  blanket security guarantee.
- Server typecheck and both client typecheck projects passed.
- Server and client lint, Knip and production dependency analysis passed.
- Dependency-tooling regression checks: 40 passed, none skipped.
- Client coverage: 448 test files, 6,516 tests passed; no skips. Statements
  86.99%, branches 80.48%, functions 86.56%, lines 88.8%. Production build passed.
- Copyright (1,556 files), static-import and strict mock-shape checks passed.
- Markdown lint: 2,055 files checked, no errors. Staged Gitleaks scan passed.
- Backend coverage: 1,763 suites and 54,886 tests passed in 975 seconds. One
  existing Linux directory-fsync case is skipped on Windows; the equivalent
  exact-image Linux check below passed. Statements/lines 89.71%, branches 85.88%,
  functions 91.13%. Both fresh coverage reports passed the unchanged ratchet.
- No database driver or SQL changes; the broad database integration suite was
  not rerun for this declaration-only patch. Image startup and schema checks
  below exercised PostgreSQL in the candidate image.

## Local image and schema

No-cache Compose build succeeded from clean source
`2fdde2ce384f3a0340bf5968dcaf33b55f52ac71`. Exact local image ID:
`sha256:25b39b12fdec03e5faf2c16d64231fe4591277ca8ea72f9e7e6b2a42f8de6b3e`.
This is local image evidence, not published multi-platform or signed release proof.

The exact image passed an isolated Linux directory-fsync/exclusive-copy check
against its own migration-tree module, with source and destination hashes checked.
The post-build disposable schema dump passed through migration
`20261009_230000_comparison_incident_ledger.sql`; `database/schema/current.sql`
remains unchanged. Its owned container and temporary data directory were removed.

Before replacement, the local database archive was checksum-verified and its
archive index read successfully (76,649,237 bytes). The previous image was retained
as `classifarr:pre-memory-8b2f5e1e-ee1f-461c-ac9a-730d97fe4e1c` for rollback.
Private backup data stays under ignored `.tmp/` and is not committed.

Only the local Compose service was recreated with `--no-build --pull never
--no-deps --force-recreate --wait`. Container
`3efe937911939950a6dd47493ab967b61ebcf5c83951909d69d732ca42bcd409`
started at `2026-10-10T02:50:13.030392337Z` using the exact image above.
Docker reported healthy, HTTP `/health` returned 200, and read-only database
checks confirmed the latest migration with no WARN/ERROR rows since startup.
There were zero restarts and no OOM. A startup sample was 702 MiB of 2 GiB;
this is not a sustained-memory or leak test. The read-only root filesystem,
UID/GID 1000, no-new-privileges and 2 GiB limit remained intact. In-image checks
confirmed Node 24.21.0 and `@types/node` 24.19.2.

No release or version bump. Memory, recovery, ownership and provider safeguards
remain unchanged; production Unraid and shared Ollama are outside this change.

## Recommendation

Keep this tested Node 24 patch. It improves declaration accuracy without a
runtime migration; the cost was coordinated validation in both workspaces.
The dependency-update skill kept the batch and lockfile review scoped, while
the release-evidence skill kept local image results distinct from remote CI
and publication claims. The final follow-up commit changes documentation only.

Next: review dotenv 18.0.7 with configuration precedence and startup regressions.
Its published diff changes handling of undefined options and quiet defaults;
it was inspected but not installed. Keep Express, browser tooling and the held
client TypeScript major in separate batches, as described in the design.
