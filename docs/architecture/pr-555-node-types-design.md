# PR 555: Node declaration evaluation design

Date: 2026-10-09. Scope: local experiment only, no PR merge or runtime upgrade.

Randomly selected open PR 555 proposes client `@types/node` 26.6.4. Apply that
exact version locally on main, generate and review the lockfile with lifecycle
scripts initially disabled, then use the normal strict installation policy.
Keep production Node 24.21.0 unchanged and restore the baseline if declarations
no longer describe the supported runtime.

Newer declarations provide updated API descriptions but can accept APIs absent
from Node 24. Staying on the runtime's major maintains that compile-time boundary
at the cost of deferring newer APIs. Prefer the latter until a runtime migration
is explicitly planned. Do not weaken the existing runtime-major contract test.

[DefinitelyTyped's versioning guidance](https://github.com/Definitelytyped/DefinitelyTyped)
ties declaration major/minor versions to the represented library. Retrieved with
MCP web research on 2026-10-09. Check strict install, dependency graph, audit,
typechecks, production build and the existing tooling contract. See the separate
[local outcome](pr-555-node-types-outcome.md) for results and the retention decision.
