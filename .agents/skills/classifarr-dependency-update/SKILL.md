---
name: classifarr-dependency-update
description: "Review and update Classifarr npm dependencies and build/test tooling using exact versions, lockfile review and scoped validation. Use for outdated-package, dependency-advisory or toolchain update work; not general feature development or permission to publish."
---

# Classifarr dependency update

Produce a small, reproducible upgrade with evidence of what changed and what
passed. An outdated package is not automatically vulnerable; a clean audit is
not proof that a dependency is safe.

## Establish the baseline

Read the root, server and client manifests, relevant `.npmrc` files and existing
update documentation. Confirm the branch, checkout changes and installed Node/npm
versions. Use the pinned toolchain; do not upgrade the user's global installation.
Keep unrelated edits intact and do not create a branch when the user requests main.

Run `npm outdated --json` in the affected workspace. Exit 1 with a valid outdated
result is not an install failure. Distinguish installed, wanted and latest versions.
Use `npm explain <package>` for transitive dependencies before proposing overrides.
Inspect existing scripts before introducing any new update automation.

## Choose a bounded batch

Discover and retrieve official release notes, registry metadata and advisories
for the exact candidate versions. Record the research date and source URLs.
Check engines, peers, platform/native packages and lifecycle scripts. Review major
changes separately; keep coupled packages such as Vitest and coverage aligned.
Do not assume a patch release is behavior-free or that a transitive override is
supported by its parent.

When asked for an open PR, query the repository's current open PRs. Select randomly
from the available candidates, record the selection and review its immutable diff
before local implementation. If none exist, say so; do not invent a PR, reopen one
or merge anything. Stop for scope clarification if the selected change requires
authority beyond the task.

Document the decision and tradeoffs before changing dependencies. Separate runtime,
database, lint and bundler/test batches where that improves failure attribution.
Existing CI failures stay visible and must not be described as update regressions
without a before/after reproduction.

## Update and verify

Edit manifests explicitly and generate lockfiles using npm with scripts disabled
for initial review. Inspect all package additions, removals and transitive changes.
Keep strict lifecycle-script decisions and security overrides unless evidence
justifies a specific change. Never use `npm audit fix --force`, disable scanners,
relax peer checks or globally allow scripts to make an update pass.

Run `npm ci` with the repository's reviewed install policy, then `npm ls --all`
and `npm audit --json` in the changed workspace. Report audit scope and date; do
not silently exclude development dependencies in a tooling review.

Use existing verification entry points:

- `npm run test:tooling:dependencies` for toolchain/install policy.
- Client: lint, typecheck, `node scripts/run-vitest.mjs run --coverage`, build,
  and `npm run test:browser:production-policy` for bundler changes.
- Server: relevant unit/integration tests, lint, typecheck and knip. Database driver
  changes require real database integration checks, not mocks alone.
- Coverage ratchet only with current backend and frontend reports.
- Image/installation evidence: use the release-evidence skill and existing
  disposable runners. Do not run tests against live appdata or weaken timeouts,
  assertions, permissions or isolation to obtain a pass.

Keep new JavaScript as ESM and reuse modular runners. A lockfile can contain
upstream CommonJS dependencies; do not rewrite third-party packages merely to
claim an ESM-only dependency graph.

## Handoff

Update Unreleased and separate design from observed outcome. Record exact versions,
tests, failures/skips, audit findings and the next bounded batch. Verify the staged
diff and secrets before an authorized commit/push. No version bump, tag, release,
PR merge or deployment is implied by dependency-update approval.
