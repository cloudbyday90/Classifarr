# Command Center Semantic-Evaluation Readiness Design

Status: implemented, unreleased. The standards and security sources below were
checked on 10 September 2026 against the requested August 2026 best-practice
baseline.

## Problem

Classifarr already has a secure, passive held-out semantic-study readiness
contract. It prevents RAG or AI from becoming a routing authority and exposes
only aggregate prerequisite state. That state was available only from the
dense policy-reconciliation maintenance screen, however. An administrator who
wants the system to become more hands-off could not quickly tell whether the
platform was collecting trustworthy measurement prerequisites, waiting for
normal policy activity, or blocked by incomplete declared-purpose evidence.

The Command Center should answer that operational question without presenting
a study workflow, a new confirmation, library identities, raw descriptions,
RAG chunks, model output, or an inaccurate claim that the product is already
learning from its own policy decisions.

## Evidence and constraint

The current local aggregate reported `normal_lifecycle_receipt_required` with
zero normal lifecycle receipts and zero complete declared-purpose evidence.
That is an honest statement that the protected prerequisite is not yet present;
it is not a semantic-quality result.

The existing semantic-evaluation baseline already has the necessary safety
parts: self-match exclusion, bounded redacted capture, an independently
labelled reference-set artifact, and frozen-study preflight. It intentionally
does not convert current library contents, policy outcomes, or a model's own
answer into an independent label. Doing that would train and evaluate on the
same signal, creating circular evidence rather than measuring correctness.

## Selected design

```text
existing administrator-only held-out readiness aggregate
                     |
                     v
strict client schema allowlist (no persistence)
                     |
                     v
visible Command Center, five-minute no-store refresh
                     |
                     v
one plain-language status and a link to detailed review
```

`useCommandCenterSemanticEvaluationReadiness.js` owns a compact read-only
refresh lifecycle. It makes the existing parameter-free endpoint call on mount,
on return to a visible tab, and every five minutes while visible. It does not
use the Command Center SWR/localStorage cache because the response is marked
`Cache-Control: no-store`. A `403` removes the card silently for non-admin
users; a transport or contract failure produces a fixed, accessible error.

`SemanticEvaluationReadinessSummary.vue` deliberately renders only:

1. a short status -- **Building baseline**, **Needs policy evidence**,
   **Checking evidence**, or **Not assessed**;
2. one sentence explaining the next automatic prerequisite; and
3. a link to the detailed policy-reconciliation view.

The existing detailed readiness panel received a stable fragment target so the
link can lead directly to it. It remains the place for counts and the exact
measured blocker. The dashboard carries no buttons and cannot start a study.

## Security and authority boundaries

- The existing route remains administrator-only, parameter-free, rate-limited,
  read-only, and `no-store`.
- The browser validates the versioned closed object and refuses unknown fields
  or any indication that a library, media identity, configuration, candidate,
  label, semantic selection, or routing state was exposed.
- The card retains no response and cannot invoke AI, retrieval, a provider,
  policy mutation, data collection, model tuning, labelling, or routing.
- It uses Vue text interpolation and a fixed internal route; it has no
  user-controlled HTML or URL injection surface.
- Routine refreshes are visible-page-only. They do not run in hidden tabs and
  do not announce every poll to assistive technology.

## Accessibility and research basis

[WCAG 2.2 Success Criterion 4.1.3](https://www.w3.org/TR/WCAG22/#status-messages)
requires application status to be programmatically determinable without moving
focus. The card uses `role="status"` only for initial loading and `role="alert"`
for a failed fetch, while routine polling updates static text quietly. This
avoids repeated announcements while maintaining meaningful status feedback.

[W3C Page Visibility](https://www.w3.org/TR/page-visibility/) defines the
visibility state used to suppress hidden-tab refresh work. [RFC
9111](https://datatracker.ietf.org/doc/html/rfc9111) defines the existing
`no-store` response directive, which is preserved by avoiding the shared
browser cache.

The [NIST AI RMF Measure function](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
calls for documented, repeatable measurement and validity assessment. This
surface reports a prerequisite for measurement, not an accuracy claim or a
decision. The [OWASP RAG Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
recommends bounded retrieval, provenance, access control, and output
validation; no retrieval material or label enters this dashboard.

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep readiness only in reconciliation | No dashboard work | A hands-off system has no concise explanation of what it is waiting for | Reject |
| Add full counts, cohort state, and evidence detail to Command Center | More diagnostic data inline | Recreates the dense maintenance view and expands the broad dashboard's information surface | Reject |
| Automatically label current contents or confirmed outcomes as semantic truth | Appears to accelerate learning | Circular evidence; no independent assessment of semantic correctness | Reject |
| Compact, auto-refreshing aggregate with detailed-review link | Clear, quiet, privacy-preserving, and no new authority | Does not replace an independently labelled study | Adopt |

## Recommendation stack

1. Keep deterministic policy eligibility as the routing authority.
2. Use automatic, redacted collection only for normal lifecycle evidence and
   bounded evaluation prerequisites.
3. Require independently reviewed labels to measure RAG/metadata quality;
   never manufacture them from the policy or model being evaluated.
4. Run the existing frozen offline evaluation before allowing semantic results
   to influence review prioritisation.
5. Keep any future semantic influence advisory and candidate-bounded until
   measured calibration and error rates demonstrate improvement.

## Non-goals

This work does not add a migration, endpoint, scheduler, provider request,
model call, retrieval, cohort, label, policy change, learning operation, or
routing behavior. It does not create a release.
