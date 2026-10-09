# PR 555: local Node type-definition outcome

Date: 2026-10-09. No merge, branch, release or retained dependency upgrade.

## Selection

The repository had two open PRs, 555 and 556. PowerShell `Get-Random` selected
[PR 555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`5545605b53c854de8847b44e24fa083ff4218080`. Its reviewed diff upgrades the client
from `@types/node` 24.19.1 to 26.6.4 and `undici-types` 7.24.6 to 8.9.0.

The [evaluation design](pr-555-node-types-design.md) sets the supported-runtime
boundary. npm metadata verified the exact candidate's integrity and its
`undici-types` dependency before installation.

## Outcome

Candidate implementation used an exact 26.6.4 manifest pin to avoid drifting to
26.6.5, which was already latest during this review. Only the two intended locked
packages changed. Strict `npm ci`, both client typechecks and production build
passed; `npm ls --all` reported no problems and npm audit reported zero advisories.

The existing tooling contract correctly failed **Node declarations stay on the
deployed runtime major**: 39/40 tooling tests passed. A successful compilation is
not proof that Node 26 declarations are appropriate for Node 24. The candidate
manifest and lockfile were restored exactly, `npm ci` restored installed packages,
and all **40/40** tooling tests then passed. No guards were weakened.

Recommendation: retain Node 24 types. Review the available 24.19.2 patch separately;
consider the Node 26 major only alongside an explicitly planned runtime migration.
Neither open PR was merged, closed or modified remotely.
