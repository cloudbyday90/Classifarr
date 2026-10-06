# Random PR trial: server Node declarations

Date: 2026-10-06. This is a local compatibility trial, not a PR merge.

The current open pool is #555 and #556. PowerShell `Get-Random` selected
[#556](https://github.com/cloudbyday90/Classifarr/pull/556), head
`9d74537d7917c248d15926f37b2e40ceba7559a4`. Its reviewed two-file diff upgrades
server `@types/node` 24.19.1 → 26.6.4 and `undici-types` 7.24.6 → 8.9.0.

Apply that manifest/lockfile diff locally and run the existing runtime-major
gate before installing packages. If it rejects the candidate, remove only this
trial's changes. Do not upgrade the runtime, weaken the gate or execute new
lifecycle scripts for an unrelated memory fix.

The advantage of newer declarations is coverage of newer Node APIs. The cost
here is describing APIs outside our supported Node 24 baseline. Recommendation:
retain matching Node 24 declarations unless a separately scoped runtime upgrade
is approved and validated.

Official sources discovered/opened through MCP on October 6, 2026:

- [DefinitelyTyped version guidance](https://github.com/Definitelytyped/DefinitelyTyped)
  aligns declaration major/minor versions with the described library.
- [Published Node declaration versions](https://www.npmjs.com/package/%40types/node?activeTab=versions)
  distinguishes current Node 24 and Node 26 lines; the highest version is not
  automatically compatible with the deployed runtime.

Record results separately after the local trial.

The normalization-reuse round re-enumerated the open pool on October 6 and again
randomly selected #556 at the same immutable head. Repeat the exact trial against
the current Node 24 baseline; do not carry a failing type-major change.
