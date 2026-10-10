# PR 556: server Node type candidate

Date: 2026-10-09. Random selection from the current open PRs 555 and 556: 556.
Reviewed immutable head `9d74537d7917c248d15926f37b2e40ceba7559a4` through
the GitHub MCP patch service: [PR 556](https://github.com/cloudbyday90/Classifarr/pull/556).

The proposed server-only update changes `@types/node` from 24.19.1 to 26.6.4
and `undici-types` from 7.24.6 to 8.9.0. Our runtime remains Node 24.21.0.
Newer type declarations may expose APIs unavailable at runtime. Test the exact
candidate locally, retaining install-policy and runtime-major checks. Do not
merge the PR, upgrade Node, weaken guards or retain a failing candidate.

Recommendation: keep the Node 24 type line unless a separately reviewed runtime
migration justifies the major change. The benefit of newer declarations does
not outweigh falsely advertising newer runtime APIs. Record observed tests in
a separate outcome document.

Official sources discovered through MCP and reviewed on 2026-10-09:

- [DefinitelyTyped version policy](https://github.com/DefinitelyTyped/DefinitelyTyped#how-do-definitely-typed-package-versions-relate-to-versions-of-the-corresponding-library):
  major/minor declarations describe the corresponding library, while declaration
  patch numbers evolve separately.
- [Node release schedule](https://github.com/nodejs/Release/blob/main/README.md):
  Node 24 remains supported; Node 26 is a separate runtime adoption decision.

Registry metadata was also checked with `npm view @types/node@26.6.4`: the
integrity matches the reviewed PR and its only dependency is `undici-types
~8.9.0`; neither declaration package introduces an install script.
