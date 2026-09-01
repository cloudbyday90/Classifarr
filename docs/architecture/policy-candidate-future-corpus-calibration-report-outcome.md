# Future Corpus Calibration Report Outcome

## Delivered

Classifarr now derives a fixed, read-only calibration report from its existing
automatic redacted future-corpus evaluator.

- The server reuses the existing aggregate evaluator and opens no new item or
  history query path.
- A report becomes available after the existing 24-outcome coverage baseline.
- Each score-margin row displays only aggregate outcome counts, confirmation
  rate, changed-selection count, and a 95% Wilson interval.
- A band must have 20 outcomes and a bounded 20% change signal before the
  report can prompt an administrator to review close-candidate boundaries or
  higher-margin evidence.
- The report is administrator-only, selector-free, rate-limited, and
  `no-store`; its authority contract denies AI, learning, policy change, RAG
  tuning, retry, and routing.
- Security Settings refreshes the report automatically while open. Its current
  message is compact; the accessible aggregate table is available only through
  one disclosure.

## What operators will see

Before the 24-outcome baseline, the existing automatic collection status is
the only message. No new action is required.

After the baseline, Classifarr shows one of these concise outcomes:

- **Continue automatic collection** — there is not enough per-band evidence
  for a precise prompt yet.
- **No material score-band pattern** — every sufficiently sampled band is
  below the fixed review floor; this does not guarantee future correctness.
- **Review close-candidate boundaries** — close score-margin candidates were
  changed often enough to merit reviewing policy boundaries and semantic
  retrieval ranking.
- **Review higher-margin candidate evidence** — a higher-margin candidate was
  changed often enough to merit reviewing declared-policy specificity and
  semantic retrieval evidence.

In every case, Classifarr has not modified a policy, threshold, model, RAG
setting, queue item, retry, or route. A report identifies a review topic; an
administrator still owns any follow-up proposal.

## Verification

The change adds contract, service, protected-route, client API, and client
presentation tests. The contract tests include both malformed-authority
rejection and fixed aggregate source redaction. The client test rejects any
response that grants automatic RAG or routing authority and reconstructs fixed
recommendations from the aggregate rows.

Full server/client test, lint, type, build, documentation, static ESM,
container schema, no-cache Compose, and changed-code security checks remain
required before this outcome is released.

## Open pull-request check

GitHub's public pull-request endpoint for `cloudbyday90/Classifarr` returned
no open pull requests on 2026-09-01. No unrelated PR was therefore copied or
merged into this local implementation.

## Next recommendation

Once a score-band prompt identifies a stable concern, the next high-value
component is a **human-approved semantic adjudication evaluation**: a small,
time-bounded offline set that joins metadata description and
policy-eligible-library retrieval only under explicit approval. It should
compare a frozen RAG/model proposal with a human reference decision and return
aggregate error categories, never act on live routing.
