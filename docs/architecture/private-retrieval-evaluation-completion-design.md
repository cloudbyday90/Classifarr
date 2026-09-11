# Private Retrieval-Evaluation Completion — Design

Status: implemented, unreleased. This design was reviewed on 11 September 2026
against the requested August 2026 best-practice baseline.

## Decision

After two human reviewers have finalized independent labels, replace four
mechanical local commands with one explicitly confirmed local completion
command. It composes the existing reference set, runs the already-admitted
self-hosted scorer, builds the existing paired artifact, and writes the
existing aggregate results report.

The command does not create labels, start on a schedule, change a policy,
learn, retry media, or route anything. Reviewer consensus remains a hard
gate: an incomplete or disputed reference set stops the process before any AI
or RAG-adjacent scoring is invoked.

## Workflow

```text
two finalized independent reviewer submissions
                    |
                    v
explicit local completion command
                    |
                    +-- packet-bound reference set
                    |       └─ disagreement: stop for adjudication
                    |
                    +-- verified local structured scorer
                    +-- paired label-included / label-free artifact
                    +-- aggregate, content-free results report
```

`heldOutSemanticStudyRetrievalEvaluationCompletionWorkflow.mjs` is a small ESM
orchestrator that receives only local path names and status receipts. It owns
the fixed order and fail-closed stage transitions; the existing focused
commands remain the owners of their schemas, provider admission, read-only
database process, private file boundary, and output writes.

`study:complete:retrieval-evaluation` requires
`--confirm-private-study-evaluation`, packet, two reviewer submissions, and
one results output path. It derives all intermediate `.json` names from those
two local paths, preventing a user from manually wiring a mismatched cohort.
An optional adjudication input is passed only to the existing consensus step.
The receipt contains only fixed stage states (`not_started`, `ready`,
`unavailable`, `conflict`, or `adjudication_required`) and never prints a path, label, description, library,
policy, neighbor, model result, or aggregate metric.

After a provider failure, rerunning the same command recomputes consensus and
can reuse an identical existing reference set. Changed consensus produces
`reference_set_conflict`; select a new results basename to keep both attempts.
This recovery does not reuse model outputs or later artifacts. See the
[recovery design](retrieval-evaluation-recovery-design.md).

## Security and authority boundaries

- The command refuses malformed or colliding input/output paths before a stage
  can run. Each composed command separately enforces project-local `.tmp`
  containment, symlink checks, bounded JSON reads, exclusive writes, and
  requested POSIX `0600` permissions.
- Consensus runs first. Any missing, invalid, or disputed submission prevents
  scorer invocation, avoiding unnecessary use of private source material.
- The scorer preserves its existing read-only PostgreSQL session and verified
  self-hosted structured-output provider admission. An unavailable scorer stops
  artifact and result creation.
- The orchestrator does not open a route, persist database state, add browser
  storage, schedule a job, retain raw content, expand candidate selection, or
  grant a study output any routing authority.
- Its `automaticActions` contract remains all false: “automatic” means the
  explicit local command avoids handoff errors, not that Classifarr acts on its
  own in production.

## UI decision

No additional UI is introduced. The Command Center continues to show its one
compact readiness status and detailed link. Showing step-by-step local study
progress in the browser would both recreate the dense screen this work is
removing and incorrectly imply that temporary local artifacts are durable
application state.

## Alternatives and trade-offs

| Option | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Keep four manual commands | No new code | Error-prone path wiring and unnecessary operator work | Rejected |
| Automatically create reference labels | Fastest path | Circular evidence; no longer measures RAG against independent ground truth | Rejected |
| Background worker runs after any file changes | Hands-off appearance | Cannot establish authorized source, reviewer independence, or provider intent | Rejected |
| One explicit, fail-closed local command | Removes mechanical work while retaining gates and review control | Requires completed human labels and a verified local provider | Selected |

## Research basis

- The [NIST AI RMF Measure playbook](https://airc.nist.gov/airmf-resources/playbook/measure/)
  calls for documented test methods, repeatable processes, independent
  assessment, and measurement before operational action. This command preserves
  the existing evidence sequence rather than allowing workflow convenience to
  bypass it.
- The [OWASP RAG Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  recommends explicit trust boundaries, provenance, constrained processing,
  validation, and fail-closed handling. The workflow is path-bound, stage-gated,
  and delegates every sensitive operation to the existing narrow boundary.
- [WCAG 2.2 status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  supports concise status without a focus change and cautions against chatty
  updates. Keeping transient local stages out of the Command Center preserves
  that compact accessible surface.

## Final recommendation stack

1. Capture a study only through the current protected readiness handoff.
2. Have two independent reviewers complete their opaque worksheets; adjudicate
   only actual disagreements.
3. Invoke the completion command once to build the pinned aggregate result.
4. Review the result by stratum and uncertainty before proposing any change to
   live retrieval behavior.
5. If evidence supports it, design a separately approved, reversible,
   candidate-bounded re-embedding pilot. Keep routing deterministic.
