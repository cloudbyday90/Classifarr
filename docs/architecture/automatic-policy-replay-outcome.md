# Automatic frozen policy replay: outcome

Status: Unreleased, September 25, 2026. The separate
[design and research](automatic-policy-replay-design.md) records alternatives,
pros/cons, official sources and the final recommendation stack.

## Delivered

The automatic source-pair job now sends both prepared evidence variants through
the existing deterministic policy evaluator. Retrieval/profile fitting is reused,
not repeated. Up to 300 identical movie/TV cases retain their identity-grouped
folds. Source-only items now use their source identity in policy metadata, profile
training and temporal correction screening rather than collapsing into a null
TMDB identity. Music is excluded from both inventory and policy capture.

Resolved policy configuration, source edit timestamps, metadata, vectors and
corrections share one read-only repeatable-read transaction. The policy reader
uses the supplied transaction connection, ordered calls and a 64-policy limit.
Policies and provenance participate in change detection; the existing cohort,
five-minute minimum interval, bounded retry backoff and restart behavior remain.
One v2 aggregate uses the existing checkpoint: no migration, new scheduler,
dependency, public endpoint or dashboard.

The replay reuses policy preparation, fold-local profile scoring, inventory
evidence, candidate ranking, decision construction and AI-mode selection. It never
invokes the selected AI mode. Labels are removed from the source passed to scoring.
Inferred profile-purpose rules, history/pattern learning, source-library shortcuts,
historical RAG and live authoritative signals remain excluded as in the existing
held-out replay. Current policies are not retrained or promoted.

## How to read it

```sh
node server/src/scripts/runOperatorCorrectionPolicyEvaluation.mjs --automatic-source-pair-status
```

The installation's private database environment is required. In the application
image the script is under `/app/src/scripts/`. This command only reads stored
results; it does not launch the worker or call a model.

Inspect `report.policyReplay`:

- `status`: complete, no policies, incomplete cache, or no eligible cases.
- `metrics` and `byMedia`: automatic policy decisions, review/manual outcomes,
  missing metadata/outcomes, retrieval requests and unavailable retrieval.
- Paired changes: actions, candidate destinations, deterministic deferrals reduced
  or increased, and gains/regressions in correct automatic policy decisions.
- `correctionLabels` versus `eligibleLabels`: retained consistent corrections
  versus corrections passing policy-source temporal screening.

Here a deferral means a non-automatic **deterministic policy** result, not a final
classification failure: a later AI stage may still decide it. A reduction in
deferrals is not necessarily an improvement. Wrong automatic outcomes are reported
separately; unlabeled outcomes are not counted as correct. Changed destinations
include review candidates, not actual routed media. Inspect unavailable counts
even when the replay execution completed successfully.

Policy edits and mutable attachment provenance can leave zero gradable labels.
This is unknown quality, not evidence of a regression or perfect accuracy.
Both arms exclude known feedback groups from all training folds, including groups
whose labels fail temporal screening. Labels are observational, not blind truth.

## Safety and recovery

The worker has no inherited credentials/preloads, uses fixed fatal/no-file logging,
and skips local `.env` loading. A worker-only database pool refuses every query and
connection; attempted access prevents publication even if a scorer catches it.
The main application database/environment behavior remains unchanged. This is a
fixed-code guard against accidental fallback, not a sandbox for untrusted code.

Existing admission, 64 MiB serialized-input budget, heap limits, two-minute deadline
and awaited termination apply. Expanded reports still must fit the existing 16 KiB
database bound. Exact validators reject additional/private keys, invalid counts,
inconsistent media totals and changed authority flags. Policy/evidence failures
clear the previous result and use the existing retry path; partial runs are not
published. Expired, future and malformed checkpoints remain withheld.

No titles, policy/library names, per-item source keys, labels or raw errors appear
in the private status. No provider, cache, policy or routing writes are introduced.
Old retrieval-only v1 reports remain identifiable and readable; the next due run
recomputes under the new revision and publishes the v2 replay report.

## Verification

Local verification completed on September 25, 2026:

- Full backend coverage run: 1,433 suites and 42,239 tests passed.
- Full PostgreSQL integration run: 159 suites and 1,860 tests passed; one existing
  suite/test skipped. Focused replay/worker/provenance checks: 211 tests passed.
- Coverage ratchet passed: backend statements/lines 90.37%, branches 84.08%,
  functions 92.30%. The unchanged frontend used its existing coverage report;
  its test suite was not rerun.
- Type checking, backend lint, both unused-code checks, documentation, ESM,
  migration/schema integrity and repository consistency checks passed. Backend
  lint retains one pre-existing warning in `captureOperatorCorrectionFrozenPolicy.mjs`.
- The application image built successfully. An isolated, network-disabled app
  container with no host mounts captured 400 synthetic items and automatically
  replayed 300 cases on the normal scheduled tick: 149 movies and 151 TV shows.
  Restart preserved the completed checkpoint and its evaluation timestamp;
  application health remained healthy. The user's running container was unchanged.

Focused tests exercise real ESM workers, source-only labels, policy/provenance
invalidation, missing evidence, privacy/report rejection and the database/environment
guard. PostgreSQL integration covers resolved policies, music filtering, restart
reuse, policy budgets and recovery. The synthetic scheduled smoke produced manual
outcomes in both arms and one eligible correction; it verifies scheduling and
persistence, not model quality or reduced deferrals.

No production quality improvement is claimed from synthetic tests. GitHub's
connected search returned no open Classifarr PRs for random selection; none was
substituted or merged. No release, version bump or live-container deployment.

## Next component

Add bounded AI adjudication evaluation for paired cases whose deterministic
outcomes differ or still require review. Reuse the existing prompt preparation
and response reducer, use captured/cached responses first, and separately configure
any inference budget. Measure corrected decisions, remaining deferrals, latency
and token cost together; do not reward fewer deferrals when errors increase.
Keep the same frozen evidence and no-routing boundary. This advances into the
unmeasured AI stage rather than adding another summary screen or approval task.

Follow-through: [cached AI adjudication replay](cached-adjudication-replay-outcome.md)
now reuses exact captured responses within that worker. Inference requires an
explicit private capture budget; automatic cache misses do not invoke a provider.
