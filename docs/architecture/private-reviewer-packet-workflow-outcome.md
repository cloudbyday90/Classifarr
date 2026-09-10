# Private Reviewer-Packet Workflow — Outcome

Status: implemented, unreleased on 10 September 2026. No release or version
bump is created by this work.

## Delivered

- Added a modular ESM-only private reviewer-packet builder and controlled local
  workflow.
- Reused the existing current aggregate readiness handoff; an absent or stale
  `private_cohort_capture_ready` condition prevents selection and capture.
- Kept the normal held-out capture API redacted. A dedicated private method is
  the only internal path that receives transient source case data, and it is
  consumed immediately by the packet builder.
- Created packet cases with only media description, opaque fixture ID, candidate
  labels, library/policy names, and bounded declared-purpose terms. The packet
  omits TMDb IDs, current placement, semantic/RAG results, scores, embeddings,
  prompts, provider/model detail, and labels.
- Added a random opaque packet ID and a fixed 24-hour review window.
- Added an explicit local launcher requiring
  `--confirm-private-reviewer-packet` and a `.tmp/...json` output target.
  The launcher prints only an aggregate receipt; it never writes packet content
  to stdout.
- Added an exclusive, symlink-checked writer under ignored `.tmp` with POSIX
  `0600` creation mode. It never overwrites a prior packet. The read-only
  container writes that boundary below its explicitly writable
  `/app/data/.tmp` mount; development checkouts use the repository `.tmp`.
- Changed the earlier cohort-runner executable report to omit its bundle so
  direct command output remains aggregate-only.

## Verification

Focused tests cover:

- normal capture redaction versus the dedicated private review path;
- packet minimization, candidate-policy binding, random opaque ID, fixed
  expiry, and fail-closed invalid candidates/windows;
- readiness gating, write failure, and public-receipt redaction;
- explicit launcher confirmation, temporary path restriction, exclusive file
  creation, and POSIX mode behavior; and
- existing cohort capture regressions.

Server lint, server type checking, focused Jest tests, `git diff --check`, the
full bounded server coverage suite, and its coverage ratchet were run locally.
The final no-cache local Compose build, recreate, and health check are recorded
with the commit verification.

## Open-PR check

GitHub's public pull-request API returned `openPullRequestCount=0` for
`cloudbyday90/Classifarr` on 10 September 2026. Therefore no genuine random
open PR could be implemented locally, and no closed or fabricated change was
substituted.

## Pros and cons

| Result | Benefit | Cost / limit |
| --- | --- | --- |
| Local controlled packet | Gives reviewers necessary source and declared-policy context without a web data surface | Distribution and deletion remain a controlled administrator task |
| No semantic/RAG evidence in packet | Preserves independent labels | Reviewers cannot use the system's own retrieval as a shortcut |
| No dashboard workflow | Keeps Command Center compact and avoids sensitive browser state | Review is intentionally not one-click product automation |
| Content-free consensus/result path | Existing fingerprint-bound reference-set and summary contracts remain valid | The expiry is an operational review window, not a cross-device identity credential |

## Next high-value item

Run this workflow against a qualifying local cohort with two truly independent
human reviewers, collect their opaque submissions, and compose the existing
reference-set artifact. Then run the fixed offline semantic evaluation and its
aggregate results summary. The key product decision after that is not an
automatic routing change: it is whether the measured stratum-specific error
and coverage justify a separate, candidate-bounded **advisory review-priority
experiment**.
