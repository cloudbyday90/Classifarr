# Braces-Free Development Tooling Design

Date: 2026-10-02. Status: implemented; no release or deployment.

## Problem and boundary

The [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
describes uncontrolled recursive AST traversal in braces through 3.0.3.
On October 2, the npm registry still returned 3.0.3 as latest, with no official
patched release. [Upstream PR 72](https://github.com/micromatch/braces/pull/72)
is a proposed fix, not a published repair.

Classifarr had two development-only dependency paths:

- Markdown CLI configuration/arguments -> globby/fast-glob/micromatch -> braces.
- nodemon watch configuration -> chokidar -> braces.

Document content does not become a glob pattern. No application request path
to braces was established. Production uses `npm ci --omit=dev`, but that does
not make development/CI exposure acceptable or justify suppressing OSV.

The invariant is removal of both dependency paths, while preserving useful
Markdown diagnostics and automatic restarts for imported development code.

## Options and final recommendation

| Option | Benefit | Cost | Decision |
| --- | --- | --- | --- |
| Wait for a release | No local tooling change | Leaves the known vulnerable package installed | Reject |
| Carry an upstream backport | Preserves general tooling behavior | Third-party patch maintenance and AST compatibility review | User declined |
| Replace the two callers | Removes the vulnerable graph without a fork or suppression | Small local selector and narrower watcher behavior | Adopt |

Recommended stack: Node 24 native watch, the maintained markdownlint Promise API,
small ESM configuration/selection/reporting modules, locked dependencies and
OSV checks. Do not build another general-purpose glob engine or CLI framework.

## Markdown runner

[markdownlint documents its direct Promise API](https://github.com/davidanson/markdownlint).
The previous CLI re-exported that API. Keep markdownlint 0.41.1 and the existing
MD012/MD047 rules; remove CLI2 and its now-unused transitive packages.

- `scripts/run-markdownlint.mjs` is a thin CLI with nonzero failure exits.
- `scripts/markdownlint/files.mjs` reads JSON and discovers regular files.
- `scripts/markdownlint/patterns.mjs` validates a restricted pattern dialect and
  matches iteratively, without brace ASTs or regex backtracking.
- `scripts/markdownlint/run.mjs` lints in batches of 32 and reports
  `filename:line:column rule description` without modifying files.
- `.markdownlint.json` remains discoverable by standard editor integrations.
  `.markdownlint-repo.json` owns only repository globs and exclusions.

Configuration files are limited to 64 KiB. Each pattern list has at most 128
entries of 512 characters. Permit literals, `*`, `?` and whole-segment `**`;
reject brace/extglob/class expressions, negation, absolute/parent paths,
backslashes and command options. Matching is case-sensitive on all platforms,
including actual literal directory names on Windows. Native filesystem
enumeration starts at each literal directory prefix, includes hidden names,
and prunes excluded directories. It does not follow file/directory symlinks.

This deliberately avoids native glob's platform-dependent case matching,
which changed the existing backup-file exclusions in Windows testing.
The original sorted 1,767-file selection is preserved exactly. Additional
arguments still augment configured patterns; duplicates are removed. An
explicit unmatched argument fails instead of silently passing a partial check.

The policy storage closure command now invokes this script directly with Node,
retaining its explicit file list. Its command-derived evidence fingerprint
changes naturally; regenerate evidence instead of trusting an old command.

The runner is for this trusted checkout, not a filesystem sandbox or a general
untrusted-content ingestion service. Batching limits concurrent document work,
not the size of a single Markdown file. No executable/YAML/custom-rule
configuration loader is introduced. Inline Markdown rule directives retain
the upstream API's existing semantics.

## Native watch compatibility

Node's [watch documentation](https://nodejs.org/download/release/v24.21.0/docs/api/cli.html#--watch)
describes monitoring the entry point and imported/required modules.
`npm --prefix server run dev` now runs
`node --watch --watch-preserve-output src/index.mjs`.

Imported ESM edits restart development; output remains visible. Unimported
files, filesystem-read JSON and nodemon's interactive `rs` command are not
replacement features: stop/start development manually when needed. Do not use
`--watch-path`, which is not portable to the Linux baseline. Production's
`start` command, Docker entrypoint, data mounts and database behavior do not
change. No new resident service is introduced.

## Security coverage and accessibility

CLI2 removal also removes root YAML and markdown-it/linkify consumers. Retire
their CLI-specific tests rather than installing unused parsers to keep tests
alive. Preserve all 12 YAML merge-budget/precedence tests against the actual
backend js-yaml dependency. Add lock checks preventing the retired package
paths from reappearing, plus malformed-pattern and legitimate-input controls.

[W3C writing guidance](https://www.w3.org/WAI/tips/writing/) informs descriptive
headings, source links and concise diagnostics. There is no UI change, and
passing two Markdown style rules is not a WCAG conformance claim.

See the separate [outcome and test evidence](braces-tooling-replacement-outcome.md).
