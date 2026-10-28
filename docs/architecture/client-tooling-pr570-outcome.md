# Client tooling PR 570 outcome

Date: 2026-10-28. Status: immutable candidate applied locally after the batch's
scope agreement; local client validation passed.
The [design](client-tooling-pr570-design.md) records selection, official sources,
versions, alternatives and safeguards.

## Observed baseline

- Clean main starts at `6c27ac698915886c5c4434aff27b5fc156442654`.
- Local tools are pinned Node 24.22.1 and npm 12.2.1. No global tool was changed.
- The open-PR list contains only #570; its inspected head is
  `06001f5a0953e9cc30ba5c2ee8793dfab567b983`.
- `npm outdated --json` reports installed/wanted PostCSS 8.5.30, latest 8.5.32;
  installed/wanted Vite 8.3.4, latest 8.3.5. Exit one is the normal outdated result.
- The full client audit reports zero advisories across the recorded 347-package
  population, including development dependencies. This is a dated audit result,
  not a security guarantee for either version set.
- Baseline production build passed using Vite 8.3.4.
- Baseline client configuration tests passed all twelve cases.
- Immutable lock review found nineteen changed records, no added/removed package
  paths and no installation-hook flag changes. Published engine requirements fit
  the pinned runtime; native bindings remain coupled to the reviewed Rolldown.

The above are baseline results. Ignored selection, registry, audit and build
receipts contain intermediates and are excluded from commits.

## Local implementation and candidate checks

Applied the exact two provider files from the immutable reviewed head. Their
working contents still match that candidate after installation. No other package,
override, peer allowance or lifecycle decision was changed. Initial `npm ci
--ignore-scripts` and the subsequent clean install under the existing strict
policy passed. `npm ls --all` passed; full-scope audit reports zero advisories
across the 347-package locked population, including development dependencies.

Candidate validation on pinned Node 24.22.1/npm 12.2.1:

| Check | Observed result |
| --- | --- |
| Full client coverage | 477 files, 7,374 tests pass |
| Client lint and both type checks | Pass |
| Client configuration tests | 12 pass |
| Production build and real production policy-route browser checks | Pass; 8 browser tests |
| Root dependency/install tooling | Baseline and candidate: 59 pass each |

Coverage is 87.79% statements, 81.84% branches, 87.50% functions and 89.47% lines.
The browser checks preserve cold-route asset budgets and Command Center navigation
without relaxed assertions. Native execution was verified on this Windows host;
no Linux image, hosted build, release or deployment is claimed. PostCSS 8.5.32
remains a separate ordinary patch follow-up; this is the exact selected PR batch.

The coverage ratchet passed with fresh frontend and backend reports; its baseline
was not changed. Backend validation belongs to the separate
[prospective outcome](prospective-authorized-outcome-outcome.md). Final staged
checks and PR closure are recorded with the delivery receipt. The provider PR is
not merged.

## Delivery and housekeeping

The exact reviewed client changes were pushed on main in
[3cea2c333c89784f271f61034d55bf1cc37a34d5](https://github.com/cloudbyday90/Classifarr/commit/3cea2c333c89784f271f61034d55bf1cc37a34d5).
Remote main matched. MCP verified PR #570 still had reviewed head
`06001f5a0953e9cc30ba5c2ee8793dfab567b983`, then closed it with `merged: false`.
The subsequent open-PR query was empty. No remaining stale bot PR required a
rebase, and no remote branch or PR was merged. Final Markdown, copyright,
whitespace and redacted staged secret checks passed. The separate delivery
receipt changes documentation only; it does not claim hosted/Linux validation.
