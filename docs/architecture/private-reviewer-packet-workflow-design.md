# Private Reviewer-Packet Workflow — Design

Status: implemented, unreleased. Research was reviewed on 10 September 2026
against the requested August 2026 baseline.

## Decision

Use a deliberately started, local-only reviewer-packet workflow after the
existing aggregate `private_cohort_capture_ready` handoff. It writes one
content-minimized JSON packet below the ignored `.tmp/` directory, with a
24-hour review window and a file-create-only boundary. The normal application
has no route, read API, browser state, background job, or dashboard control
for packet contents.

The packet gives independent reviewers the source media description and the
candidate libraries' **declared policy context**. It excludes TMDb IDs,
current placement, retrieval/RAG results, relevance values, embeddings,
prompts, provider/model data, and proposed labels. Reviewers therefore do not
see the semantic output being measured.

## Why this is the next component

The completed readiness handoff correctly establishes only that a balanced
cohort is available. The results summary correctly refuses to report a metric
until an independently labelled reference set exists. Before this change,
Classifarr had a redacted capture primitive and a consensus composer, but no
safe bridge that let reviewers see a case without exposing the packet through
normal product APIs or copying the semantic signal into the label.

This workflow supplies that missing bridge. It is not a new routing or learning
feature, and it does not make current library contents semantic proof.

## Architecture

```text
current aggregate capture-ready handoff
                  |
                  v
explicit local administrator command + read-only database process
                  |
                  v
freeze cohort -> prepare policy-owned candidates -> held-out capture
                  |
                  +--> normal path: redacted bundle only
                  |
                  +--> private path: source media + declared policy context
                                      (no semantic/RAG output)
                                                   |
                                                   v
                      exclusive .tmp JSON write, 24-hour review window
                                                   |
                                                   v
                    independent opaque submissions -> existing consensus
                                                   |
                                                   v
                         fingerprint-bound reference set -> offline summary
```

### Modules and boundaries

- `heldOutSemanticStudyCapture.mjs` retains a redacted default result. Only
  `captureForPrivateReviewerPacket()` can make the transient source case and
  policy-owned candidate contract available to the protected caller.
- `heldOutSemanticStudyCohortCapture.mjs` shares the same planning,
  configuration-fingerprint, held-out exclusion, and redacted-bundle path for
  ordinary and reviewer-packet capture. Semantic retrieval cannot select the
  cohort.
- `heldOutSemanticStudyReviewerPacket.mjs` performs the content minimization.
  It maps server-owned candidate library IDs to active declared policy names,
  library names, and bounded declared-purpose terms. It does not read a
  database or invoke RAG/AI.
- `heldOutSemanticStudyReviewerPacketWorkflow.mjs` requires the existing
  current `private_cohort_capture_ready` condition before capture. Its public
  result exposes only status, opaque packet ID, and a fixture-document
  fingerprint—not packet data or a path.
- `runHeldOutSemanticStudyReviewerPacket.mjs` is the only delivered launcher.
  It starts a read-only local runtime, requires an explicit confirmation flag,
  and never prints packet contents.
- `writePrivateStudyPacket.mjs` accepts a project-relative `.json` path only
  below `.tmp`, resolves its parent to defend against symlink escape, uses
  exclusive creation, and requests `0600` on POSIX. On Windows, the local
  installation directory's inherited ACL is the access boundary; administrators
  should keep the checkout in a private user directory.
  In the read-only production container, this same boundary is
  `/app/data/.tmp`; Compose mounts `/app/data` as the explicitly writable
  local-storage area. It is never served by the application.

Run it only from a controlled administrator workstation:

```powershell
npm --prefix server run study:capture:reviewer-packet -- `
  --confirm-private-reviewer-packet `
  --output-file .tmp/private-review/packet.json
```

The launcher checks the aggregate handoff again, so a manually run command
cannot capture while it is absent or stale. A packet is never overwritten, is
ignored by Git, and is outside all HTTP routes. The packet records its
`startsAt` and `expiresAt`; distribute it only to the two independent reviewers
and securely delete it after the 24-hour window. Because no application API
ever reopens this local packet, the later consensus receives only the existing
content-free reviewer submissions and their fixture fingerprint.

## Security and authority properties

- The command runs with PostgreSQL `default_transaction_read_only=on`, fatal
  logging only, and file logging disabled before loading private runtime code.
- Current aggregate readiness is checked before any selection or capture.
  Absent, malformed, or changed readiness fails closed with `not_ready`.
- The held-out cohort is selected before semantic capture, retains the existing
  configuration-drift checks, and excludes cohort identities from retrieval.
- Packet identifiers use fresh cryptographic randomness. Packet content has no
  semantic score or model output, preventing a label from simply copying the
  system under test.
- The public workflow receipt contains no media, library, candidate,
  description, policy term, output path, or reviewer identity.
- Packets are an operationally controlled local artifact, not an authentication
  token. The explicit flag records intent; access control is the workstation,
  checkout/Docker access, and OS file permissions. There is no misleading claim
  that a command-line flag proves reviewer identity.
- The workflow cannot invoke another provider beyond the existing controlled
  semantic capture; it cannot learn, mutate a policy, retry classification,
  route media, schedule work, or publish a result.

## Accessibility and UI

No new UI is added. The packet contains sensitive review context and a dense
case-by-case review surface would be the wrong Command Center task. The
existing Command Center remains a compact, automatically refreshed aggregate
status with its detailed link. This follows WCAG's principle that meaningful
application status changes should be programmatically determinable without
unnecessarily changing a user's context; no repeated background status is
introduced for a private offline operation.

## Alternatives

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Browser review dashboard | Convenient inline review | Expands the HTTP retention and authorization surface; recreates the dense UI | Rejected |
| Give reviewers RAG examples or scores | More immediate context | Leaks the tested semantic signal into the reference label | Rejected |
| Automatically label existing placement | Fast | Circular evidence; it measures prior placement, not suitability | Rejected |
| Persist packets in the database | Auditable retention | Creates a new sensitive-data table, API, retention schedule, and access-control surface | Rejected |
| Local, minimized, expiring packet plus content-free submissions | Independent ground truth with narrow exposure | Requires controlled manual distribution and review | Selected |

## Research basis

- NIST's [AI RMF Measure function](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented test data, metrics, uncertainty, and independent review.
  The packet keeps human reference decisions separate from the semantic output
  and binds later labels to the fixture fingerprint.
- [NIST SP 800-53 Rev. 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final)
  covers access control, audit/accountability, and media protection. The design
  narrows access to a local controlled process and avoids a new application
  media store.
- The [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends least privilege, deny-by-default, per-request checks, and tests.
  Readiness fails closed; there is no new permissive HTTP resource or guessed
  packet URL.
- [WCAG 2.2 SC 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  supports concise, programmatically determinable status updates. Keeping the
  offline flow out of the dashboard avoids noisy, inaccessible progress churn.

## Recommendation stack

1. Use this local packet only when the automatic aggregate handoff is current.
2. Keep reviewers independent of RAG/model output and existing placement.
3. Compose only fingerprint-bound, double-blind reviewer submissions through
   the existing consensus command; adjudicate disagreements.
4. Run the fixed offline evaluation and results summary after consensus.
5. Treat measured outcomes as advisory evidence only. A later, separately
   governed decision is required before any semantic signal can influence
   review prioritisation; routing remains deterministic.
