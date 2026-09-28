# PR 553: local Vitest tooling update

## Selection and design — 28 September 2026

GitHub MCP search returned one open pull request for this repository:
[PR #553](https://github.com/cloudbyday90/Classifarr/pull/553), head
`77de957545fbb22dce17eb04e94d5a97f63e769d`. Random selection from this singleton
necessarily selects that PR; there was no larger candidate pool.

Implement its Vitest and `@vitest/coverage-v8` 5.0.2 update locally, with matched
package constraints and a regenerated npm lockfile. Keep existing test commands,
coverage thresholds and runtime dependencies unchanged. Do not merge the PR.

Unlike the PR's minimal lockfile edit, local npm resolution also refreshes
allowed Vitest development transitive versions (`obug`, `tinybench`, `tinyexec`
and its nested `magic-string`). These changes are included in full client
validation; no application runtime dependency is updated.

The [official Vitest release notes](https://github.com/vitest-dev/vitest/releases)
list 5.0.2 on 25 September, including fixes to asymmetric object matching, jsdom
Request/Blob handling, concurrent reporting and the ESM hanging-process reporter.
The release was discovered through the PR and verified online rather than by
constructing an assumed documentation URL.

## Tradeoffs and recommendation

Benefit: current patch fixes while keeping the existing tooling architecture.
Cost: test/coverage tooling and transitive development dependencies can change
behavior, so a successful install alone is not acceptance. Run the entire client
coverage suite, lint, typecheck, build and the unchanged combined coverage ratchet.
Prefer this matched patch update over adding another test runner or weakening a
threshold to accommodate failures.

## Outcome

The dependency update is implemented locally. Focused client tests passed under
Vitest 5.0.2, followed by all 5,668 client tests, coverage ratchet, lint, types
and production build. Full validation is recorded with the
[shared-admission outcome](shared-work-admission-validation.md).
There is no release, version bump, remote PR merge or production dependency change.
