# Current compiler PR 589 disposition

Research: November 10, 2026 Eastern. Baseline main 071b38924. This records an
existing settled deferral; it does not propose a dependency change or request a
repeat approval. No PR merge, release or deployment.

## Selected immutable proposal

The MCP inventory contains only open [PR 589](https://github.com/cloudbyday90/Classifarr/pull/589).
Uniform selection from `[589]` chooses it with probability one. Head
c6137f1467319a048e2d6babfe27dc6bb9859ffa changes the client manifest and coupled
lock from vue-tsc 3.3.13 to 3.3.14. It is fresh and mergeable with unstable checks;
no genuine stale/conflicted applicable branch is established.

Current installed/wanted vue-tsc remains 3.3.13; registry latest is 3.3.14.
Keep language-core 3.3.13, TypeScript 6.0.3 and application type scopes unchanged.
There is no independent applicable subset after the prior JSDOM adoption.

## Evidence and decision

Fresh registry integrity and all eleven compiler-related version/integrity
records match the immutable proposal and the previously assessed candidate.
Metadata introduces no new installer or engine incompatibility, but does not
resolve the prior real semantic regressions. Reuse those recorded failures as
prior executions; do not claim they were newly rerun.

Official sources retrieved through MCP still show the same
[3.3.14 release](https://github.com/vuejs/language-tools/releases/tag/v3.3.14)
and open reports [6322](https://github.com/vuejs/language-tools/issues/6322) and
[6328](https://github.com/vuejs/language-tools/issues/6328). Those reports alone
are not proof of an application failure; the earlier real differential controls
remain the compatibility evidence for this exact artifact.

Retain the previously agreed compiler pin and exact diagnostic controls. Do not
reinstall identical known-failing artifacts, mix compiler graphs, alter application
syntax, weaken assertions, manufacture a package edit or select a different PR.
Recheck PR state at delivery and rebase only genuinely stale applicable branches.

## Recommendation stack

| Option | Benefit | Cost or limit | Decision |
| --- | --- | --- | --- |
| Retain qualified 3.3.13 graph | Preserves demonstrated semantic checks | Defers the proposed update | Retain settled decision |
| Adopt identical 3.3.14 again | Changes version without new evidence | Repeats demonstrated regressions | Reject |
| Assess a genuinely changed/fixed artifact later | Can establish a compatible update | Requires a new exact-artifact differential | Next dependency assessment |

Record fresh inventory/artifact verification and the no-change outcome separately.
Preserve all scanner findings and runtime-security follow-up. This disposition
does not authorize a PR merge or change the generic fallback implementation scope.
