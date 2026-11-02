# Server ESLint PR 580 assessment design

Date: 2026-11-02 (America/New_York). Status: locally adopted and verified.
Observed results: [assessment outcome](server-eslint-pr-580-outcome.md).
Base: a8f3d431b2d5a054915d1e097252847a4af1626c on main.

## Selected upstream change

One uniform random selection from open PRs 580 and 581 selected
[PR 580](https://github.com/cloudbyday90/Classifarr/pull/580), head
46ba6518b0bca0ddc8a19da52ba8ee7a2e080f52. It changes only the server ESLint
declaration and lock record, exact 10.13.0 to 10.14.0. It remains unmerged.
PR 581's previously demonstrated compiler regression and settled deferral stand.

The official [October 30 release](https://eslint.org/blog/2026/10/eslint-v10.14.0-released/)
fixes rule edge cases, hashbang handling and dependency minima. Its
[global-object fix](https://github.com/eslint/eslint/commit/827a8f3cca710d3efd76c1d7088d894deff08434)
provides a real-library regression: property values window/globalThis must not
crash no-restricted-globals. The installed 10.13.0 crashes on both controls and
on the restricted-self shorthand negative control. Preserve that observed
baseline; the candidate must return empty results for the valid cases and the
exact blocking rule/message/location for self.

No new production lint rule, severity, exclusion or application syntax change
is justified by these isolated tests.

## Lock and parser compatibility boundary

Review the entire generated lock delta. The proposed release raises humanfs/node
and minimatch minima to versions already installed (0.16.8 and 10.2.6).
Espree 11.2.0, Acorn 8.16.0, Acorn JSX 5.3.2, eslint-scope 9.1.2 and visitor keys
5.0.1 are expected to remain unchanged. Verify rather than assume this outcome.
Keep exact pins, strict install/scanner policy, existing script permissions,
Node/npm, other overrides and both independent root/client trees unchanged.

The SQL ownership inventory uses ESLint's parser and explicitly reviews its
version. Before installation, retain the full old inventory. On identical source
inputs compare the new inventory: paths, source and analysis digests, candidates,
gaps, triggers, cascade relationships, scanned-file count and source fingerprint
must agree. Only the parser version may differ. Also compare all 890 existing
review-entry bindings before/after; preserve the baseline, 100-review cap,
classifications and unresolved debt.

Only after that evidence agrees, explicitly update the parser pin to 10.14.0.
Never regenerate unrelated entries or weaken the gate to obtain a pass. If
unexpected analysis changes or normal checks fail, retain/restore 10.13.0 and
its parser pin and document the deferral. Passing still does not imply global
production ownership compatibility.

## Options and recommendation stack

| Option | Benefit | Cost or limitation |
| --- | --- | --- |
| Conditional exact 10.14.0 adoption plus parser differential | Upstream fixes with explicit ownership review | Requires full inventory and fresh server validation |
| Hold 10.13.0 | No tooling change | Keeps reproduced rule crashes; fallback if verification fails |
| Blanket parser manifest regeneration | Quick passing metadata | Conceals analysis drift and debt; rejected |

Recommendation stack: freeze real-library regressions and old inventory, review
the exact artifact/lock graph, install under current policy, compare unchanged
source analysis, explicitly review the parser pin, then run fresh server gates.

## Verification and delivery

Run strict clean server installation, full installed-tree checks and audits
including development dependencies. Retain existing real ESLint production-rule
controls and ownership-gate negative tests. Run lint, typecheck, Knip, dependency
policy and repository quality checks, focused runtime/isolated PostgreSQL tests
and fresh backend coverage. Reuse client coverage only after unchanged client
source, installed-tree and report evidence is verified.

Recheck open Dependabot heads at delivery; rebase only genuinely stale applicable
branches. No PR merge, root/client dependency update, UI/W3C markup change,
operator CLI workflow, release or deployment. Record exact audits, comparison
results and limitations in a separate outcome MD and Unreleased; commit/push
the assessed changes on main.
