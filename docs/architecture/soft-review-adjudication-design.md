# Soft-review adjudication admission

## Decision

Allow the existing bounded AI comparison to evaluate manual outcomes whose
server-owned review reason is `weak_evidence_primary` or `weak_evidence_overlap`.
Share that exact reason allowlist with the existing learned-evidence resolver.
Do not clear the review flag, raise scores, or issue routing permission here.

## Root cause and scope

The preceding [evidence-admission outcome](cross-encoder-evidence-admission-outcome.md)
identified 69 initial weak-primary reviews. A read-only replay of the same
100-item, two-fold sample on September 20, 2026 found:

| Initial review | Cases | AI comparison before fix | Best shortlisted content support |
| --- | ---: | --- | --- |
| Weak primary | 69 | All admitted | 25 agree; 37 neighbor overlap; 7 metadata disagreement |
| Weak overlap | 10 | All abstained | 6 agree; 4 neighbor overlap |

The policy decision projector deliberately marks overlapping weak candidates as
`manual` with `requires_manual_review`. The AI-mode selector treats every such
manual flag as an unconditional provider veto. The learned-evidence resolver,
however, already supports both soft reasons. Its supported overlap path is
therefore unreachable from ordinary classification.

These are fold-local content preflights, not AI proposals or measured routing
success. All 79 soft-review cases passed candidate-scope preflight; no fully
supporting candidate was omitted from the shortlist. The local installation's
require-all-confirmations setting was also enabled. Preserve that setting:
qualification may run in review-only mode, but cannot authorize a route.

## Implementation and safety

- Add a small, exact-match ESM reason predicate used by admission and resolution.
- Admit a known soft manual review only through the existing valid comparison
  contract. Keep its two-to-three candidate limit and existing provider controls.
- Keep unknown, missing, malformed and explicit hard manual reasons provider-free.
- Retain policy constraints, full-pool evidence, local proposal validation,
  identity conflicts, familiarity checks, fresh policy/configuration/evidence
  revalidation, one-use receipts and the final route-safety gate.
- No new resolver, retry loop, queue, model, dependency, schema, UI or setting.
  This is library-name/content independent; it uses policy reason codes only.
- Use production policy projection in movie and TV regression tests, then test
  the ordinary classification path through the real learned-routing service
  with synthetic provider/evidence dependencies. Never label those as live AI.

## Research and tradeoffs

Official sources discovered through web search and read on September 20, 2026:

- [OWASP RAG Security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  recommends output-policy enforcement, provenance and fail-closed handling.
  Application: comparison admission is not routing authorization; retain all
  evidence and freshness checks after a proposal.
- [scikit-learn common pitfalls](https://scikit-learn.org/dev/common_pitfalls.html)
  explains train/test leakage. Application: retain the existing held-out folds
  and provenance exclusions. The linked development documentation is guidance,
  not a new dependency or a claim about a released September package version.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  explains non-disruptive accessible status updates. Application: this backend
  fix needs no additional acknowledgement, alert panel or modal. Any later UI
  status work must retain accessible semantics; no WCAG conformance claim here.

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Keep unconditional manual veto | No additional inference | Supported soft reviews cannot be evaluated | Reject |
| Remove all manual holds | More comparisons | Erases distinction between weak evidence and explicit holds | Reject |
| Share exact soft reasons and reuse bounded comparison | Repairs unreachable behavior with existing safeguards | Additional normal provider work for admitted overlap cases | Choose |
| Lower evidence thresholds or route on similarity | More apparent automation | Can reinforce existing misplacements; unvalidated safety change | Reject |

Recommended stack: deterministic policy eligibility → bounded advisory comparison
→ existing learned-evidence assessment → fresh server-side revalidation → final
route-safety gate. Continue with the current ESM services and existing tests;
there is no evidence that another framework or model is needed for this defect.

## Acceptance

Previously blocked known soft overlaps reach comparison for both movies and TV.
Unknown/hard reviews still abstain. Missing contracts still abstain. Genuine
agreement can qualify only under existing live guards; disagreement, unavailable
evidence, provider recovery and confirmation holds cannot grant a route. Repeat
the same private sample with zero inference and verify source stability.
