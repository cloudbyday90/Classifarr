# Client Node declarations: repeat compatibility review

Date: 2026-10-06, during the comparison-memory phase investigation.

The freshly queried open pool still contains #555 and #556. `Get-Random` selected
[#555](https://github.com/cloudbyday90/Classifarr/pull/555), unchanged head
`5545605b53c854de8847b44e24fa083ff4218080`. Review its immutable two-file diff and
repeat the local manifest/lockfile trial against the existing runtime-major gate.
Do not install a known-incompatible major, merge the PR or weaken the gate.

The candidate changes Node declarations 24.19.1 → 26.6.4 and undici declarations
7.24.6 → 8.9.0. New API declarations are the benefit; describing APIs outside the
deployed Node 24 runtime is the cost. Prefer aligned declarations and a separately
planned runtime upgrade. The [earlier outcome](node-types-pr555-outcome.md) records
the same compatibility issue; repeated selection does not make it eligible.

Official sources rediscovered through MCP on October 6, 2026:

- [DefinitelyTyped version guidance](https://github.com/Definitelytyped/DefinitelyTyped)
  relates declaration versions to the described library.
- [Published declaration versions](https://www.npmjs.com/package/%40types/node?activeTab=versions)
  lists the distinct Node 24 and Node 26 release lines.

Record this round's gate outcome separately; no dependency change is implied by
recording the design.
