# Classification queue admission diagnostics outcome

## Delivered behavior

The Command Center’s **Queue Waiting** panel now explains actionable state
beside queued classification work:

- **Queue admission** appears when the worker is stopped, AI is unavailable,
  Classifarr cannot verify dispatch state, or all current classification
  capacity is occupied.
- **Strict verification** appears independently only when the current saved
  primary Ollama capability has the exact `model_changed` status. It explains
  that candidate verification will not call AI until the existing saved
  configuration is tested again and provides an explicit **Open AI Settings**
  action.

This makes it clear that worker admission and strict-verification readiness
are separate observations. The UI neither tells an operator that a model
change paused routing nor attempts a repair on their behalf.

## Local PR implementation

[PR #518](https://github.com/cloudbyday90/Classifarr/pull/518) was inspected
through the GitHub MCP service and applied locally without merging it. It
updates the full-SHA-pinned CodeQL `init`, `analyze`, and `upload-sarif`
references from `db488d…` to the reviewed `cdf488f…` revision in the CodeQL
and Trivy workflows. It is compatible with the current `main` base and has no
discussion comments.

## Verification outcome

Focused tests passed for the new factory service, bounded configuration read,
non-disclosure behavior, QueueReadModel projection, UI status gating, and
explicit Settings navigation:

- Server: 4 suites / 116 tests.
- Client: 3 files / 18 tests.

The complete local suites and quality gates also passed:

- Client: 244 files / 3,579 tests.
- Server units: 865 suites / 25,123 tests.
- Server integration: 71 suites / 861 tests passed; one pre-existing suite and
  test were skipped.
- Root lint, server/client type checks, production client build, both Knip
  modes, documentation lint, migration/schema integrity, static ESM imports,
  and the coverage ratchet passed. The coverage ratchet reported no
  regression.

## Security outcome

- The queue API receives a fixed-ID projection only; no configuration values
  leave the server.
- The configuration read is skipped when nothing is queued and cached for a
  short interval when it is needed.
- The presentation component ignores unknown values and has no `v-html`,
  user-controlled URL, or action that calls a provider.
- The only remediation action is navigation to the existing Settings flow;
  server-side administrator authorization continues to protect the manual
  test endpoint.

## Release status

No release, tag, version change, PR merge, or provider operation is created
by this work.

## Next recommendation

Add a bounded **classification decision-path telemetry** projection for queued
items: a status-only count of deterministic-policy decisions, AI-classification
attempts, and strict-verification abstentions. It should remain aggregate-only
and read-only so an operator can distinguish “AI was not needed” from “AI was
unavailable” without exposing prompts, responses, titles, model identities, or
per-item decision records.
