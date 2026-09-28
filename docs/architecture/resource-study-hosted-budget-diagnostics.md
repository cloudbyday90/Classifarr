# Resource study: hosted budget failure diagnostics

## Evidence — 28 September 2026

[CI/CD run 36485954122](https://github.com/cloudbyday90/Classifarr/actions/runs/36485954122)
used `8d1acc30` and failed the published-schema replay comparison on the inventory
observation trigger expression. The forward migration in `6380baf3` addresses
that separate issue. Its subsequent
[CI/CD run 36488458584](https://github.com/cloudbyday90/Classifarr/actions/runs/36488458584)
passed, including the replay check. Re-running the old SHA would not apply the fix.

[Resource run 36488458669](https://github.com/cloudbyday90/Classifarr/actions/runs/36488458669)
used `6380baf3` but failed `assertStudyBudget` during the first startup receipt,
before seeding or starting the workload. The log did not contain the effective
limits, so it cannot identify which limit differed. The successful local cgroup
v1 study does not establish equivalence with this hosted environment.

## Design and safety

Keep the budget assertions unchanged while gathering evidence. A small ESM
formatter/parser exposes only the allowlisted budget name and safe-integer
cgroup version, memory limit, CPU quota/period, PID limit and PID denial count.
Unknown values remain null; arbitrary error messages, environment variables,
payloads and extra properties are never forwarded. The host wrapper reparses
and sanitizes the bounded diagnostic line before printing it.

Failure still prevents seeding, measurements and a success artifact. The launcher
cleans only its verified, initially empty, randomly named Compose project. No
daemon setting or live container limit changes are involved.

## Validation and next decision

Regression tests cover malformed/oversized diagnostics, stripping private fields,
safe host forwarding and owned cleanup after a failed probe. These diagnostics
were added after the completed smoke/soak measurements; they change the failure
path, not the measured workload. Hosted confirmation is still required before
changing any budget semantics or claiming this CI failure is resolved.

Recommendation: collect actual effective limits first, then correct only the
demonstrated mismatch. This costs another hosted run but avoids weakening a
resource-safety check based on speculation.
