# Current compiler PR 589 outcome

Research: November 10, 2026 Eastern. Baseline main 071b38924. The
[disposition](client-compiler-pr-589-design.md) retains the already-agreed compiler
deferral. No dependency edit, installation, PR merge, release or deployment.

## Fresh selection and artifact verification

The current MCP inventory has only PR 589. Uniform selection from that singleton
chooses head c6137f1467319a048e2d6babfe27dc6bb9859ffa, whose two-file proposal is
vue-tsc 3.3.13 to 3.3.14 plus the coupled compiler lock. It is fresh, mergeable and
has unstable checks; no stale/conflicted applicable branch was established.

Fresh registry inspection reports installed/wanted 3.3.13 and latest 3.3.14.
Installed language-core remains 3.3.13 and TypeScript 6.0.3. Candidate vue-tsc and
language-core integrity match the immutable proposal and earlier assessment.
All eleven compiler-related version/integrity records match the prior PR 588
candidate, including Volar 2.4.30 and protocol/URI dependencies. No new install hook
or engine mismatch changes the prior compatibility decision.

The official 3.3.14 release and reports 6322/6328 remain unchanged at this review.
There is no applicable independent subset or newly established fixed artifact.
Retain the coherent 3.3.13 graph and exact diagnostic controls. Do not describe
prior differential failures as newly executed tests or the issue reports as
proof of an application failure. No assertions, syntax or scanner policy changed.

Private inventory, immutable patch, graph and registry receipts remain under
`.tmp/fallback-reference-assessment`; no credentials or application data were read.
Delivery recheck still finds only PR 589, open at the same head, updated
2026-11-10T02:15:03Z, mergeable with unstable checks. No genuinely stale applicable
branch requires rebasing. No rebase, reopen, merge or bot comment was issued.

Fresh validation of the retained graph passed all 488 client files / 7,569 tests,
lint, both type scopes, build and eight production browser checks. The current
coverage ratchet passes. Root/client audits remain zero; the server's five low
tooling findings remain explicit. No install, override or scanner policy changed.
The independent runtime fix has its own
[verification outcome](generic-classify-unresolved-advice-outcome.md).

## Recommendation

The [design's alternatives](client-compiler-pr-589-design.md#recommendation-stack)
favor retaining the qualified compiler until a genuinely changed artifact can
pass the existing differential controls and normal gates. Keep runtime-security
follow-up and the independent generic fallback correction separate. An unchanged
known-failing PR is not a reason to manufacture a dependency update.
