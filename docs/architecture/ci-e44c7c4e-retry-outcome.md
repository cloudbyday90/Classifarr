# CI retry evidence for e44c7c4e

November 12, 2026 Eastern. Target source:
`e44c7c4eeddf4c25e90688f355b2d50ee8db5057` on main.
[Workflow run 43050452897](https://github.com/cloudbyday90/Classifarr/actions/runs/43050452897).
These observations apply to the baseline source, separately from the saved-review
implementation that follows it.

## Observed failures and response

Attempt 1 failed [Build and Test](https://github.com/cloudbyday90/Classifarr/actions/runs/43050452897/job/130625876125)
while installing Playwright's Ubuntu dependencies. apt could not resolve
`security.ubuntu.com`; installation exited 100 before application test/build
steps. Separate database and installation/upgrade checks passed. No application
source fix was established by that download failure.

A single failed-job retry was requested through the GitHub connector. Attempt 2
passed Build and Test, Tests with Database, and the reported installation job.
Its [acceptance readout](https://github.com/cloudbyday90/Classifarr/actions/runs/43050452897/job/131580518664)
still failed: the reused installation receipt was missing, invalid or mismatched.

The receipt validator requires exact source/image/run/attempt and completion
within six hours. The exposed installation artifact remained from November 11;
it could not qualify the November 12 attempt-2 readout. A successful job display
does not replace a matching fresh receipt. The rejection was preserved.

The connector exposes job-level retries rather than a full workflow rerun.
The local GitHub CLI returned HTTP 401 from its existing credential. An
authenticated browser then started **Re-run all jobs**, without changing
workflow files, assertions, install policy, receipt identity or freshness limits.
The UI visibly confirmed **Latest #3 / Queued**, with Build and Test, database
and installation jobs queued together. The exact-source MCP read also confirms
attempt 3. The coherent rerun completed successfully: Build and Test, Tests with
Database, Fresh Install and Published Upgrade, and Release Acceptance Readout
all passed. Release/publication/promotion jobs were skipped under their existing
conditions. No workflow or receipt-validation change was needed.

## Boundaries and recommendation

No source/version/tag, scanner exception or release gate changed. This is a main
push run, so release/image-publication/promotion jobs retain their tag-only
conditions. No release or deployment was created. Existing user browser tabs
were preserved; one CI tab was opened for the rerun.

Use a full coherent rerun when same-attempt installation evidence must be
regenerated. Do not repeatedly rerun only the rejecting readout, accept an old
receipt, or loosen the gate to hide an infrastructure failure. Inspect attempt
3's actual receipts before describing baseline CI as passed. That inspection is
complete; the new saved-review commit still needs its own CI results.
