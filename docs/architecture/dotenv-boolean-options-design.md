# Environment loader boolean-option update

Date: 2026-10-08. Scope: server dotenv 18.0.5 → 18.0.6 only.

## Finding and official sources

The [previous recommendation](vector-cache-allocation-outcome.md) was to resume
compatible runtime dependency updates. A fresh server `npm outdated --json`
confirmed dotenv 18.0.6, express-rate-limit 8.7.1 and js-yaml 5.4.3 as patch
candidates; Knip 6.40.0 is a separate tooling update. Start with dotenv to keep
configuration behavior independently reviewable.

Web search discovered the [upstream changelog](https://github.com/motdotla/dotenv/blob/master/CHANGELOG.md).
GitHub MCP retrieved its current contents and [upstream PR #1069](https://github.com/motdotla/dotenv/pull/1069).
The [18.0.5–18.0.6 comparison](https://github.com/motdotla/dotenv/compare/v18.0.5...v18.0.6)
was then retrieved through the GitHub API. Its release head is
`5d7cc39e468b96cd7c82c02aaf74b3fdcacf1a4b`; the patch was released on October 6.
It replaces JavaScript truthiness with the existing boolean parser for
`populate()` override/debug options. In particular, the string `false` should
neither overwrite existing environment values nor enable debug output.

Official npm registry metadata for exact version 18.0.6 lists Node >=12, no
runtime dependencies or peers, no native/platform restriction, and no install
lifecycle hook. Build/prepack/publish scripts are upstream development tasks,
not permission to run scripts during our initial lockfile review. The tarball
integrity is recorded in the lockfile. A clean npm audit is useful evidence,
not a guarantee against vulnerabilities.

The [npm installation policy](https://docs.npmjs.com/cli/commands/npm-ci/)
documents project-level `allowScripts` and strict rejection of unreviewed
installers. Retain those controls after the initial scripts-disabled lock review.
[Node's environment-variable documentation](https://nodejs.org/api/environment_variables.html)
also distinguishes text values from JavaScript booleans and defines its own `.env`
grammar. This supports explicit boolean handling and cautions against assuming a
native-loader replacement would be behavior-identical. These current documents
were discovered through web search on October 8; the latest Node documentation
is not evidence that we changed the deployed Node 24 runtime.

## Application boundary

`server/src/config/env.mjs` already centralizes loading, fixes the server `.env`
path, requests quiet output and preserves externally supplied values by default.
It does not pass string-valued override/debug options. This is a dependency
correctness update, not evidence that Classifarr's current loader overwrote a
deployed configuration. Keep that module, offline-worker suppression, existing
configuration precedence, authentication and all memory safeguards unchanged.

Add installed-package ESM tests for false/true override behavior, quiet debug
behavior, missing-file handling and existing path/URL parsing. Use temporary
synthetic files or isolated objects; never inspect real `.env` values. Do not
enable dotenv's optional fast parser or CLI, replace the loader, or add a singleton.

## Alternatives and recommendation stack

| Choice | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Reviewed upstream patch with regression tests | Correct boolean semantics; one-package lockfile change | Still needs install and image verification | Recommended |
| Keep 18.0.5 | No dependency change | Leaves a known upstream correctness bug | Reject |
| Replace dotenv with Node's native loader | Removes a dependency | Separate parsing and startup compatibility investigation | Defer |
| Batch every available update | Fewer rebuilds | Harder attribution across config, HTTP, YAML and tooling | Defer |

Use Node 24.21.0/npm 12.2.0 → existing strict install-script policy → exact
reviewed lockfile → ESM runtime regressions → source checks → clean-source
no-cache image build → isolated schema dump/check → backed-up local replacement.
Do not change Compose/template settings, Unraid, application version or release tags.

## Random PR trial

The saved GitHub CLI login returned two open PRs, #555 and #556. One PowerShell
`Get-Random` draw selected [#555](https://github.com/cloudbyday90/Classifarr/pull/555),
head `5545605b53c854de8847b44e24fa083ff4218080`. GitHub MCP supplied its exact
two-file patch: client Node declarations 24.19.1 → 26.6.4 plus undici-types.
Apply locally and run the existing runtime-major gate. Retain only if compatible;
do not merge, close, silently downgrade the PR, or weaken the Node 24 gate.

## Verification plan

Prove the new regression fails on 18.0.5 before changing the dependency. Generate
the lock with scripts disabled, review all changes, then use normal `npm ci` under
the existing allowlist. Run dependency-tree/audit checks, focused and full server
unit tests, lint, typecheck, Knip, dependency tooling and documentation checks.
After committing, build without cache, test the installed image and run schema
generation in disposable databases. Preserve a rollback image and verified local
database archive before replacing local Compose; inspect health and errors afterward.
Record results and limitations separately in the outcome document.
