# TypeScript 7 compatibility review design

Research date: 2026-10-12. Starting source: `8fa45518a22b6825f32b54027a15ba45547864ad`
on clean `main`. No release, deployment to Unraid, provider changes or identity approvals.

## Evidence and decision

Fresh client `npm outdated --json` reports TypeScript installed/wanted 6.0.3 and
latest 7.0.2; Node declarations remain on the deployed Node 24 major. The installed
vue-tsc 3.3.13 is still the latest stable release. Its broad TypeScript `>=5.0.0`
peer range does not establish that its internal compiler entrypoint is compatible.

Official sources were discovered through MCP search and retrieved on this date:

- [Microsoft's TypeScript 7 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
  explains the compiler-API transition and the TypeScript 6 compatibility alias.
  Native compilation and legacy compiler consumers have different requirements.
- [Vue language-tools changelog](https://github.com/vuejs/language-tools/blob/master/CHANGELOG.md)
  records compatibility-alias support, not removal of the legacy compiler dependency.
- [Vue's reported TypeScript 7.0.2 failure](https://github.com/vuejs/language-tools/issues/6124)
  provides upstream context; reproduce locally rather than assuming that report
  describes our current checker.
- [Vue's TypeScript guide](https://vuejs.org/guide/typescript/overview) distinguishes
  Vite transpilation from Vue single-file-component typechecking.

Registry inspection of exact TypeScript 7.0.2 and vue-tsc 3.3.13 found no install
scripts. TypeScript 7 adds platform-specific optional native packages and exports
version/unstable APIs, not `typescript/lib/tsc`. The installed Vue checker resolves
that legacy entrypoint and explicitly handles the official TypeScript 6 alias.
Review the generated candidate lockfile before a strict-policy installation.

Trial client TypeScript 7.0.2 in isolation from PR changes. Run both existing
typecheck scopes directly so a failure in the first does not conceal the second.
Restore 6.0.3 if compatibility fails; do not suppress diagnostics, use a prerelease,
patch dependency internals or substitute a successful Vite build. Root/server
TypeScript 7.0.2 is a separate, unchanged CLI consumer.

## Tradeoffs and recommendation stack

| Choice | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Retain exact client TS 6 with real Vue diagnostic contracts | Supported compiler API and small dependency surface | No native client typechecking speedup | Preferred if trial fails |
| Adopt native TS 7 directly | Potential faster native checking | Vue wrapper may fail before checking any files | Require actual compatible diagnostics |
| Add Microsoft's TS 6 alias alongside native TS 7 | Official bridge for mixed compiler consumers | Extra packages; Vue still uses the legacy checker | Defer until a client use case needs both |
| Skip Vue checks or patch third-party internals | Makes the install appear usable | Loses reliable diagnostics and maintainability | Reject |

Retain executable positive/negative Vue checks, add an explicit installed compiler
boundary contract, and verify manifest/lockfile exact-version alignment. Next
expand strict checking to a small group of remaining shared UI components instead
of repeating an unsupported major upgrade. Revisit native Vue checking only when
upstream support changes, with these same diagnostic tests as acceptance criteria.

## Separate random PR: CodeQL action update

Fresh GitHub MCP enumeration returned one open PR, [#560](https://github.com/cloudbyday90/Classifarr/pull/560).
Node `crypto.randomInt(1)` selected that sole candidate. Immutable head:
`ee260e7d5cc7be8dfd6a25ab55bd3a62450a0fe6`. Its two-file diff updates four CodeQL
init/analyze/SARIF references from `2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2`
to `24c54180a607b1449ed407dd24f251e4e9147c8d`. Apply locally without merging.

[Official v4.38.3 release notes](https://github.com/github/codeql-action/releases/tag/v4.38.3)
describe default bundle 2.27.2, older-CLI deprecation warnings, and corrected bundle
selection for custom queries. Review the upstream immutable compare and peel the
release tag to verify the proposed commit. Preserve all permissions, triggers,
languages, security-extended queries, SARIF categories and Trivy's failure gate.
Benefit: maintained scanner with coherent pins; risk: changed scanner behavior
requires real CI after push, which local YAML contract tests cannot replace.

## Validation and image boundaries

Use existing ESM runners and workflow tests. Run candidate/restored typechecks,
compiler contracts, client lint/full coverage/build/browser checks, dependency
policy tests, and focused backend workflow tests. Run complete dependency-tree
and all-dependency audit checks after restoration. No server runtime or schema
change warrants pretending this is a new full database or backend-coverage run.
Do not combine stale backend coverage with fresh client output as fresh evidence.

Commit the tested implementation, retain a verified local database backup and
rollback image, and rebuild local Compose without cache from that clean commit.
Dump schema using the exact image and existing isolated fresh-database runner;
verify cleanup, health, image identity and aggregate read-only consumers after
replacing only the local test container. Record the observed outcome separately.
Existing ownership, memory, identity and install safeguards remain unchanged.
