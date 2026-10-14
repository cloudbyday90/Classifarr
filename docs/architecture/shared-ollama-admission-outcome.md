# Shared Ollama admission: investigation outcome

Status: design only, 2026-10-14. See [proposal and official sources](shared-ollama-admission-design.md).

## Established findings

The current evaluation controls coordinate one Classifarr database. Local and
Unraid do not acquire a common provider permit. Source inspection also found
separate paths for generation, streaming, embeddings, readiness tests, study
clients and model warming. Coordinating only the evaluation worker would not
establish provider-wide priority.

A shared expiring lock is not sufficient evidence of exclusive remote execution.
The proposed gateway would own dispatch and retain uncertain in-flight state
across restarts. Its corresponding cost is availability: unknown upstream work
can block further inference until safely reconciled. This is a material service
architecture choice, not a routine change to a local daily allowance.

## Decision still needed

Choose between an optional shared gateway, initially built and tested locally
only, and retaining separate installations with non-overlapping evaluation
schedules. The gateway is the recommended long-term option for coordinated
dispatch; existing controls are the immediate low-complexity option. No answer
to that architecture question was available when this investigation was written.

No gateway, schema, runtime setting, inference request, database recovery,
Unraid change, provider restart, release or PR merge was performed. The current
local workload consent and memory safeguards were not edited.

GitHub MCP enumeration found no open Classifarr PRs on 2026-10-14; there was no
eligible PR to randomly select or implement.

## Verification and limits

This change contains documentation only. The evidence is source inspection and
official documentation, not a new runtime test. Implementation, automated gateway
tests and the requested no-cache Compose rebuild remain pending the architecture
selection. Earlier workload-control test results are not gateway validation.
Repository Markdown validation passed: 2,202 files, zero errors. The whitespace
check also passed. No application or dependency files changed.

Next: select the shared-service approach, then implement the first bounded
transport/admission slice and its two-installation synthetic failure tests. Do
not expand live background inference or remove memory protections in the meantime.
