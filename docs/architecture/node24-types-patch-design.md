# Node 24 declaration patch design

Research date: 2026-10-09 (America/New_York). Scope: client and server development
declarations, not the Node runtime, production libraries or database schema.

## Decision and evidence

Update both workspaces from `@types/node` 24.19.1 to 24.19.2, retaining the existing
caret policy and exact lockfile resolutions. Keep Node 24.21.0, npm 12.2.0,
TypeScript versions, security overrides and strict lifecycle-script decisions.

Sources discovered through MCP search and read during this review:

- [DefinitelyTyped version policy](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md):
  declaration patch versions evolve independently and can contain breaking type
  changes. A patch still requires compilation checks.
- [Node release schedule](https://github.com/nodejs/Release): Node 24 is supported;
  moving declarations to Node 26 is a separate runtime compatibility decision.
- [Published package](https://registry.npmjs.org/@types/node/-/node-24.19.2.tgz):
  URL and integrity obtained from `npm view @types/node@24.19.2 dist --json`.
  `npm diff` against 24.19.1 shows only publication metadata and `util.styleText`
  accepting hex colors inside format arrays. There are no new lifecycle scripts,
  peers or engine requirements. Its sole dependency remains `undici-types`
  `>=7.24.0 <7.24.7`, currently locked to 7.24.6.

The published artifact integrity is
`sha512-93d49wCWJkCyN87MxLpNN6KXPCwFw7bVUg79mGUV1OS40JGWwVCr8n61DXCSqz7CV6/VfPkb7xec7uP2M+QHWQ==`.
No application behavior needs refactoring for this declaration-only correction.

## Alternatives and recommendation stack

| Order | Option | Benefit | Cost or limitation |
| --- | --- | --- | --- |
| 1 | Adopt tested Node 24 declaration patch in both workspaces | Current corrections, consistent development environment | Requires install, type and regression validation |
| 2 | Review dotenv 18.0.7 next | Small, separately attributable runtime update | Must inspect configuration/startup behavior first |
| 3 | Review Express 5.3.0 and tooling updates separately | Continued maintenance | Broader route, browser or compiler validation |
| 4 | Assess Node 26 as a coordinated runtime migration | New runtime capabilities | Not suitable as an isolated declaration bump |

Remaining observed candidates: Knip 6.41.0, Playwright 1.64.0, Vue Router 5.4.0
and client TypeScript 7.0.2 (currently explicitly pinned to 6.0.3). These are
inventory findings, not compatibility or security approvals. Do not mix them
into this patch. Retaining 24.19.1 avoids change but misses the reviewed correction.

## Open PR and validation

Randomly selected PR 556 again from the two currently open PRs (555 and 556),
using PowerShell `Get-Random`. Review the GitHub MCP diff at immutable head
`9d74537d7917c248d15926f37b2e40ceba7559a4`, apply its exact server-only Node 26
candidate locally and test it before restoring. Do not merge, conceal a type
failure or disable the runtime-major guard. See the existing
[PR design](pr-556-node-types-design.md) for the candidate contract.

Before the trial, server typecheck and all 40 dependency-tooling checks pass.
All seven CI workflows for baseline `80ba4b4b18a334e1f3c008ac521a068de0c39962`
completed successfully. Validate the accepted patch with clean installs, complete
dependency trees, full audits, both typechecks/lints, server dependency analysis,
client coverage/build and relevant server tests. Review generated lockfiles for
unrelated churn. Rebuild only local Compose without cache from committed source;
verify health and dump the schema in an isolated image container. No production
Unraid or shared Ollama operations; no release or version bump.
