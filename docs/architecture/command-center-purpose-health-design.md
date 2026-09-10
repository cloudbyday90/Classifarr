# Command Center Purpose Health Design

Status: implemented, unreleased. Research was checked on 10 September 2026
against primary sources available by August 2026.

## Problem

Classifarr can safely review detailed policy-purpose coverage, but its existing
screen is intentionally dense: it may include per-policy actions and detailed
maintenance context. That is appropriate when an administrator is correcting a
policy, but it is the wrong first view of a hands-off system. An operator needs
one answer on the Command Center: whether active libraries have distinct,
declared purposes and whether action is needed.

The summary must not become a second policy editor, expose library or policy
identities in a broad dashboard, or turn historical placements, profile terms,
AI, or RAG output into routing authority.

## Selected design

```text
bounded active native-policy records
  -> server-only aggregate purpose-health contract
  -> administrator-only, parameter-free, no-store API
  -> browser schema allowlist (no persistence)
  -> 60-second, visibility-aware Command Center summary
  -> existing detailed purpose-coverage review for exceptions
```

`policyPurposeHealthService.mjs` performs one fixed, bounded over-fetch and
passes at most 100 records to `policyPurposeHealthContract.mjs`. The contract
deduplicates by library identifier on the server and returns only counts. It
does not return a library name, policy name, rule, term, profile observation,
media record, AI/RAG data, outcome, or routing decision.

The admin-only `purpose-health` route accepts no client parameter and sets
`Cache-Control: no-store`. The client validates an exact versioned object
shape in `policyPurposeHealth.js` before rendering it. The dedicated
`useCommandCenterPurposeHealth` composable intentionally does not use the
localStorage-backed Command Center SWR cache: an aggregate that the server
marks no-store must not be retained or shared between browser tabs.

The Command Center card is short by default:

1. A status badge: **Ready**, **N need review**, **Window limited**, or
   **Not assessed**.
2. One declared-purpose coverage sentence.
3. Only actionable exception counts.
4. One link to the existing detailed administrator review.

No rotating count has an ARIA live region. Initial loading is a status message
and an operational error is an alert; routine 60-second refreshes remain quiet
for assistive-technology users.

## Security and authority boundaries

- Only administrators can receive the summary; a `403` silently removes the
  administrative card rather than revealing a permission error to operators.
- The endpoint is fixed and bounded. It has no query, write, provider, RAG,
  learning, semantic-selection, or routing behavior.
- The server contract states false for all data- and authority-expansion
  flags. The client rejects any expanded key or altered flag instead of
  rendering unreviewed data.
- The card uses Vue interpolation and a router link; it has no HTML injection
  surface and no user-controlled URL.
- A truncated review window cannot be labelled ready. It stays visibly
  incomplete and directs the administrator to detailed review.

## Accessibility and usability basis

[WCAG 2.2 Success Criterion 4.1.3](https://www.w3.org/TR/WCAG22/#status-messages)
requires status messages to be programmatically determinable without moving
focus. [W3C's status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
also cautions that excessive live updates can create unnecessary interruptions.
The card therefore announces initial loading and errors, but not each routine
poll result.

[W3C's ARIA19 technique](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA19)
supports using alert semantics for important error changes. Its use here is
limited to a failed summary fetch; normal state remains static text.

[NIST's AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
and [Measure playbook](https://airc.nist.gov/airmf-resources/playbook/measure/)
support documented monitoring and human oversight. Purpose health is a
monitoring signal with a link to accountable human review, not a model control
or automatic decision.

[OWASP LLM08:2025](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/)
describes integrity and exposure risks at RAG/vector boundaries. This summary
does not query, persist, or expose retrieval material, so it cannot expand that
boundary while the system establishes a trustworthy declared-purpose baseline.

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Put every policy-evidence detail on the Command Center | Complete context in one place | Dense, identity-bearing, hard to scan, and duplicates the maintenance view | Reject |
| Persist an SWR snapshot in localStorage | Familiar implementation | Contradicts no-store intent and can retain administrative state | Reject |
| Let AI produce a library health explanation | Conversational | Adds a provider dependency and an unverified authority path to basic status | Reject |
| Aggregate server summary with a detailed-review link | Fast, quiet, bounded, actionable, and explainable | Does not diagnose a specific policy inline | Adopt |

## Recommendation stack

1. Keep declared-purpose ownership and deterministic policy evaluation as the
   source of routing authority.
2. Use the Command Center for terse, auto-refreshing exceptions only.
3. Reveal policy-specific evidence and remediation only in the existing
   administrator maintenance view.
4. Treat profile contents, history, AI, and RAG as bounded evidence inputs;
   never elevate them through this dashboard.
5. Add outcome-drift and semantic quality measures only after a separately
   designed, redacted aggregate has a reliable source of truth.

## Non-goals

This work does not change policies, route media, invoke a provider or RAG,
retain a corpus, alter learning, create a migration, or create a release.
It also does not claim semantic correctness from declared-purpose coverage
alone.
