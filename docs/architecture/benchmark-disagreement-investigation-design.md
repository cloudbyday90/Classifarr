# Benchmark disagreement investigation design

## Decision

Extend the existing offline benchmark with opt-in automatic investigation. Keep
case evidence in memory, detect disagreements deterministically, and spend at
most 25 additional local model calls on content re-checks. Do not require users
to assemble a reference dataset just to discover which cases deserve attention.

The prior benchmark discarded individual outcomes after reporting totals. Its
78/100 inventory agreement is not accuracy. Preserve the same benchmark arms;
investigation runs afterward and cannot alter their results or live routing.

## Pipeline and boundaries

1. Preserve each arm's valid proposal by case; errors are not abstentions.
2. Inspect all sampled cases for missing observed destinations in the shortlist.
3. Identify changed arm answers and disagreement with observed placements.
4. Prioritize shortlist omissions, then changed answers, then placement mismatch.
5. Re-check at most 25 complete cases using the existing bounded local client.
   Include omitted observed destinations before filling remaining slots from the
   frozen candidate ranking; never exceed three same-media libraries. Reverse
   their order to probe sensitivity. Do not reveal earlier votes or placements
   to the model. Use the same query synopsis and held-out inventory examples.
6. Report agreement, changed answer, abstention, missing evidence, and failures
   separately. A re-check is advisory, not an independent correct answer.

More than three observed destinations is a scope conflict: do not silently drop
one. Missing examples or an incomplete original comparison require technical
follow-up, not a preference question. Remaining semantic differences require
comparison with actual declared library intent before asking the user anything.
This component does not infer binding policy from a library name, diagnose a
genre mismatch by keyword, or claim that uncertainty establishes a preference.

## Security and privacy

Reuse the saved local endpoint, installed model/digest checks, strict numbered
output validation, time/context/response limits, and untrusted JSON prompt data.
Do not invoke external metadata providers, install models, write labels, route
media, or change policy. Reuse the frozen read-only snapshot, including whole
sample exclusion. No additional database schema or runtime settings.

The public report contains aggregate counts and sample-local case ordinals,
reason codes, and next-check categories; no titles, library IDs, descriptions,
raw responses, host details, or individual content hashes. Ordinals are useful
only with the accompanying snapshot/sample fingerprints. A private in-process
callback can inspect bounded case evidence; the CLI never prints that evidence.
Callback failures must not corrupt benchmark results or leak exception text.

## Alternatives and recommendation stack

| Approach | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Ask for 100 reference answers first | Direct reference evaluation | High user effort before identifying problems | Defer |
| Treat model consensus as truth | Easy apparent accuracy | Circular validation; reinforces errors | Reject |
| Deterministic triage plus blind local re-check | Targets useful cases without another form | Re-checks are correlated; bounded compute | Implement |
| Compare declared purpose and verified metadata | Can distinguish content errors from preferences | Needs provenance and overlap handling | Follow up |

Stack: frozen benchmark → case-level triage → bounded blind content re-check →
declared-purpose comparison → ask only unresolved preference questions → verified
regression examples. No automatic-routing threshold change follows from this run.

## Official research

Sources discovered through search on September 12, 2026. Living pages are not
verified archived August 2026 snapshots; the requested date boundary is explicit.

- [scikit-learn common pitfalls](https://scikit-learn.org/stable/common_pitfalls.html):
  keep evaluation evidence separate from training/tuning to avoid leakage.
- [OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html):
  treat retrieved text as untrusted, bound context, and validate outputs.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages):
  avoid unnecessary, chatty announcements. No UI changes are needed here; a
  future Command Center summary should use concise status and optional details.
