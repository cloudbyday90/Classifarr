# Specialized-Destination Identity Evidence Calibration

## Status

12R.1 is complete on 2026-08-16. It corrects a deterministic ranking gap in
which a broad destination could look like a strong identity match merely
because its policy contained an identity-capable rule somewhere in its
declared purpose.

## Problem

Native policies can legitimately overlap. A broad TV destination and a more
specialized destination can both match the same item through a generic genre
or a shared media-type rule. The previous diagnostic classified a candidate as
identity evidence when its purpose *contained* an identity-capable rule. It did
not require that rule to match the current item, nor did it distinguish a
shared match from a candidate-specific match. As a result, a broad destination
could retain a strong score even when the current evidence did not identify it
over another active destination.

Library names, observed library contents, historical placement, RAG, and AI
must not resolve that ambiguity. Those inputs are not policy authority.

## Research And Options

The implementation follows current official guidance on bounded explanations,
documented controls, and privacy-conscious diagnostics:

- [NISTIR 8312: Four Principles of Explainable Artificial Intelligence](https://www.nist.gov/publications/four-principles-explainable-artificial-intelligence)
  supports explanations that accurately reflect the actual decision process
  and clearly communicate its knowledge limits.
- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  describes iterative govern, map, measure, and manage functions and identifies
  documentation as a transparency and accountability control.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  supports consistent, security-aware diagnostic events without retaining
  unnecessary sensitive detail.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Use library names, historical assignments, or model output to break ties | Often produces a plausible route quickly | Mutable or probabilistic input would become route authority and cannot explain current policy intent | Rejected |
| Treat every configured identity-capable rule as current identity evidence | Small implementation change | A non-matching or shared rule can make a broad candidate appear uniquely supported | Rejected |
| Require a matched, declared, content-bearing purpose rule and compare it only with current active candidates | Server-derived, deterministic, explainable, and preserves declared policy authority | Does not infer a destination where policies genuinely overlap | Selected |
| Require a manual answer for every overlap | Safest behavior | Throws away clear specialized evidence and adds unnecessary operator work | Rejected |

## Implemented Design

`policySpecializedDestinationIdentityEvidence.mjs` derives a bounded taxonomy
from the current item, active native-purpose contracts, and evaluated
candidates only. It does not query or use library names, profiles, history,
RAG, AI output, provider state, or persisted classifications.

The runtime evaluates only purpose rules that are both declared as identity
semantics and content-bearing (`genres`, `keywords`, or `studios`). A rule must
use a required value and match the current item. `prefer` rules, media type,
language, certification, and numeric ranges remain compatibility or constraint
context; none can establish a specialized destination by itself.

The resulting status is one of:

- `positive_specialized_evidence`: at least one current matching purpose signal
  distinguishes the candidate from all other current native candidates.
- `broad_compatibility_overlap`: the candidate has matching identity-capable
  purpose signals, but every match is shared with another current candidate.
- `insufficient_specialized_evidence`: no eligible matched specialized signal
  exists for the candidate.
- `not_applicable`: the candidate does not use an active validated native
  purpose contract.

Only the first status retains strong identity viability. The overlap and
insufficient statuses are calibrated as weak compatibility evidence before
ranking, so they cannot auto-route. If every candidate is broad overlap, the
existing conservative selection flow remains in effect. A true strong-score
tie remains confirmation-required.

The persisted diagnostic contains only schema version, status, counts, signal
types, and whether the current native contract was validated. It does not
retain matching terms, item metadata, prompts, provider data, or model output.
The pending-decision presentation translates the status into fixed operator
facts for a specialized signal, genuine broad overlap, or missing specialized
evidence.

## Security And Privacy Properties

- The taxonomy is calculated on the server from the current evaluated
  candidate set and validated native contracts.
- It cannot be supplied or altered by the browser.
- Policy names and library names are absent from ranking inputs; stable numeric
  identifiers remain only as deterministic secondary ordering for genuine ties.
- AI verification remains candidate-bound and advisory. It cannot promote,
  demote, or choose a policy candidate.
- Observed profile, history, pattern, and RAG evidence remain corroborating
  evidence only and cannot manufacture specialized identity.
- Persisted operator facts exclude raw matched terms and all AI/provider
  content.

## Successful Outcome

For a TV item whose `Drama` signal matches both a broad `TV Shows` purpose and
a `Reality and Docuseries` purpose, the shared signal is presented as broad
overlap rather than a reason to select either destination automatically. If
the TV policy also matches `Mystery` and no other active policy does, that
current declared signal can distinguish the TV candidate. The result remains
subject to the policy's normal confirmation and automatic thresholds.

The same behavior applies to movie policies. A specialized destination wins
only from current declared purpose evidence; otherwise the operator receives a
fixed explanation and a safe selection flow.

## Verification

Focused unit and integration coverage proves matched-versus-configured
identity, shared overlap, unique specialization, non-content purpose rules,
score calibration, rank outcome, pending-decision presentation, and native
PostgreSQL policy evaluation for TV and movie scenarios. Full server and client
test suites, linting, type checks, documentation checks, ESM import checks,
and production client build validate the assembled change.

## Next Task

Proceed with **12R.2 Policy Purpose Coverage And Overlap Review**. It should
provide a read-only administrator report of active declared-purpose overlap and
missing specialized coverage, using the same bounded taxonomy without changing
policies, invoking AI, or changing classification routing.
