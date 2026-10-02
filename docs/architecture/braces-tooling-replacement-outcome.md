# Braces-Free Development Tooling Outcome

Date: 2026-10-02. See the [design and tradeoffs](braces-tooling-replacement-design.md).

## Result

Both braces 3.0.3 dependency paths are removed. Root/server clean installs and
all three lockfiles no longer contain braces, micromatch, markdownlint-cli2 or
nodemon. OSV Scanner 2.6.0 scanned the root, server and client locks and returned
**No issues found**, without changing the empty suppression configuration.

The root lock shrank from 132 to 95 package entries; the server lock shrank
from 747 to 726. Remaining package metadata, versions and integrity records
are unchanged. The client lock is unchanged. Root orphan overrides and the
server's obsolete fsevents installer decision were removed; strict lifecycle
script authorization remains enforced.

## Ordered verification

### Baseline and security trigger

Before replacement, an isolated 9,999-character pattern with 4,998 nested brace
pairs produced `RangeError: Maximum call stack size exceeded` through braces
compile, braces expand and micromatch brace expansion on Windows Node 24.18.1.
A shallower 4,000-pair input completed: the exact overflow depth is runtime-
dependent, not a universal threshold. A normal `docs/{design,outcome}.md`
expansion succeeded as a control. Nothing was sent to the live application.

After replacement, the same nested pattern and alternate nested parentheses,
extglobs, parent paths and CLI options are rejected by the selector before
filesystem discovery. The vulnerable library is no longer resolvable through
either installed workspace dependency tree. Tests also assert its absence
from all three locks, including the unchanged client graph.

### Syntax, compatibility and focused tests

- Syntax/import checks and diff whitespace checks passed.
- Before adding these two documents, old and new selectors returned identical
  sorted lists of 1,767 files, SHA-256
  `a8c263b0b7cad14682dc425fffbf185ada89351abf3c2d4c8d7547100bae240b`.
  Uppercase `BACKUP` files remain included; lowercase backups remain excluded.
- `npm run lint:docs` passed for all 1,769 files after adding the design and
  outcome documents, with zero errors.
- `npm run test:tooling:dependencies`: 28 tests passed on Windows and Linux
  with Node 24.21.0/npm 12.2.0, none skipped. Coverage includes valid/invalid
  Markdown, exact diagnostics, nonzero CLI errors, ignored/dot files, duplicate
  targets, symlinks, platform case behavior and dependency installer policy.
- Native watcher fixtures restarted an imported ESM dependency and verified
  both child PIDs were gone after shutdown. Linux used SIGTERM; Windows used
  bounded process-tree termination. This does not claim to test every terminal's
  interactive Ctrl+C behavior or live application shutdown.
- From `server`, `node scripts/run-jest.mjs
  --testPathPatterns='yamlMergeBudget|policyStorageClosureValidation'
  --runInBand --no-coverage`: 29 tests passed in five suites on Windows and Linux,
  none skipped. This includes the 12 retained YAML security/control cases.
- Independent read-only review found two selector defects: literal-star
  filenames on POSIX and alternate-cased directory prefixes on Windows.
  Both were reproduced, fixed and covered by regression tests.
- `npm run lint`, `npm run typecheck`, both server Knip checks, copyright and
  npm-flag checks passed. Root and server `npm ci` also passed on both platforms.
- Static ESM-import and inventory-ownership checks passed. The latter reports
  no new unreviewed drift; it does not authorize the existing unresolved writer
  paths or claim the entire platform is production-compatible.
- The real policy-validation command's 53 additional file arguments all resolve
  successfully and retain the full 1,769-file additive selection.

The first Windows checks used the existing Node 24.18.1 installation; the new
tooling checks were repeated with a checksum-verified portable Node 24.21.0
installation. No global host runtime change was made. Linux checks ran serially
in an isolated container capped at one CPU, 1.5 GiB RAM and 256 PIDs, with no
production database or media mounts. The running Classifarr container remained
healthy with its existing restart count of four.

### Scanner result

The official OSV Windows release executable was discovered through GitHub's
release API and verified against the release asset's SHA-256 digest. Command:

```text
osv-scanner scan source --lockfile=package-lock.json --lockfile=server/package-lock.json --lockfile=client/package-lock.json
```

It scanned 95 root, 709 server and 338 client package records and exited zero.
OSV's extracted-package counts differ from raw lock-entry counts; neither is
a claim of whole-system or container-image vulnerability coverage.

## Pull requests and delivery scope

GitHub MCP search and the saved GitHub CLI login both returned zero open
Classifarr pull requests. There was no random PR available to implement.
Upstream braces PR 72 was inspected but not adopted: the user chose tooling
replacement over a maintained backport. No PR was merged.

There is no release, version bump, live Docker rebuild or deployment in this
change. Full application suites, native ARM64 execution and a new production
image were not run for this tooling-only replacement. Those remain separate
release acceptance work, not implied by these focused results.

## Next work

Prioritize bounded, progress-aware PostgreSQL startup/recovery under slow
storage, using disposable data. The previous runtime validation observed long
fsync/startup waits; do not disable durability or equate a timeout with success.
Then resume small dependency batches, starting with the PostgreSQL client
update and pool/TLS/migration regression tests. See the
[runtime review and remaining release gates](node-24-21-runtime-outcome.md).
