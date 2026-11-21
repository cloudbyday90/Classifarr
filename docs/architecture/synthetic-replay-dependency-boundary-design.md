# Synthetic replay dependency boundary

November 21, 2026 Eastern. Approved design assessed at `2661402aa`.

## Root cause

The existing PR job runs the synthetic replay CLI from a checkout with no
installed packages. An isolated export failed under the pinned Node 24.22.1
runtime with `ERR_MODULE_NOT_FOUND` for `pino`. An installed workspace can hide
this failure. [Original CI failure](https://github.com/cloudbyday90/Classifarr/actions/runs/43828981357/job/133169423729)

Fixture validation and calibration import a viability constant from candidate
diagnostics. Decision projection imports the weak-viability predicate from the
same module. Diagnostics loads native contribution and scoring. Its transitive
logger import resolves `pino` before the offline runner can evaluate a fixture.
Astra verified all three paths independently.

## Recommendation

Extract the existing viability constants and weak predicate into one import-free
module. Use it in fixture validation, calibration, decision projection and
runtime diagnostics. Preserve the original diagnostics exports. Keep the same
closed viability values, explicit ineligible-anchor behavior, ordering,
calibration, projection, report bytes and exit status for the fixed corpus.

| Approach | Benefit | Cost or limit |
| --- | --- | --- |
| Share one pure viability module | Restores the existing job's install-free path and keeps one definition | Requires guarding the offline entry point against future import drift |
| Install server packages in the PR job | Supplies the missing logger | Expands a fixed-fixture job's install time and package authority |
| Duplicate viability logic in the runner | Keeps the runner independent | Replay can drift from the production projection it is meant to exercise |

Run the real entry point in an isolated source export and compare its result
with the installed baseline. Add a subprocess regression to the existing replay
test suite that denies package imports via the pinned Node resolver hook. Keep
the PR workflow's current trigger, read-only permissions, immutable actions,
checkout credential setting and timeout. Existing production tests cover the
same projections. The change has no browser surface. Keep W3C accessibility
testing in existing UI validation where it can observe rendered behavior.

## Official references

- [Node 24 module hooks](https://r2.nodejs.org/docs/latest-v24.x/api/module.html)
- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)
- [W3C accessibility evaluation guidance](https://www.w3.org/WAI/planning-and-managing/implement/)
