# Observed Profile Precedence

Status: implemented for the v0.48.0-beta release line.

## Incident

An active native TV policy matched `Home Before Dark` through its declared
purpose rules with a deterministic score of `80`. The runtime then treated an
inferred `TV-14` absence in the library profile as a hard exclusion. Candidate
calibration reduced every otherwise-valid candidate to zero, so the policy
path returned no ranked destination and the legacy AI path produced an
unexplained pending item.

The profile record was observational, not an operator-authored prohibition. In
this incident it also disagreed with its own rating distribution, which showed
that `TV-14` was present. The defect was therefore an authority-order error,
not an AI disagreement or a missing policy configuration.

## Official Guidance Reviewed

Research date: August 9, 2026.

- [NIST AI RMF](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-ai-rmf-10)
  identifies validity, reliability, transparency, accountability, and
  documented human-AI roles as core trustworthiness concerns. Runtime
  decisions must expose which bounded source had authority.
- [NIST AI RMF human-AI interaction guidance](https://airc.nist.gov/airmf-resources/airmf/appendices/app-c-ai-risk-management-and-human-ai-interaction/)
  cautions that observational data can lose context when reduced to numerical
  signals. An absence in a library distribution is not equivalent to an
  operator decision.
- [OWASP RAG Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  recommends independently enforcing business rules and requiring explicit
  confirmation for consequential model-influenced actions. Deterministic
  policy rules remain the authority boundary; AI and retrieval remain advisory.

## Options

### Continue treating observed absence as a hard exclusion

Pros:

- Suppresses profile-only and RAG-only outliers aggressively.

Cons:

- Lets stale or incomplete observation override explicit declared policy.
- Can remove every ranked candidate and invoke an unrelated legacy AI path.
- Misstates an inferred absence as a user-authored restriction.

Rejected.

### Ignore observed profile data entirely

Pros:

- Eliminates profile-derived false vetoes.

Cons:

- Removes useful caution for candidates supported only by profile or RAG data.
- Loses a bounded diagnostic that helps operators understand sparse evidence.

Rejected.

### Preserve observed absence as advisory context under declared identity

Pros:

- Explicit native purpose and hard-limit rules retain their intended authority.
- Strict policy constraint failures still block the candidate.
- Profile-only and RAG-only candidates remain conservatively suppressed.
- The pending-decision UI can explain both the declared support and the
  observational difference without exposing raw model output.

Cons:

- A declared policy with broad or overlapping intent can still require an
  operator to choose among multiple valid candidates.

Recommended and implemented.

## Final Recommendation Stack

1. Treat every `library_profiles.exclusion_*` value, including ratings,
   genres, and keywords, as observed absence, never as an operator-authored
   hard limit.
2. Keep strict native policy constraints as the only deterministic conflict
   that can veto an otherwise matching declared identity candidate.
3. Store `profile_observed_absence`,
   `profile_observed_absence_advisory`, and `advisory_reasons` alongside the
   existing bounded candidate diagnostics.
4. Preserve compatibility with existing consumers by setting
   `profile_hard_excluded` only when observed absence actually removes primary
   anchor authority.
5. Calibrate candidates from their resolved evidence class, rather than
   independently zeroing a diagnostic observation.
6. Keep AI/RAG adoption subordinate to `primary_anchor_eligible`; an advisory
   profile difference cannot veto an eligible declared-identity candidate.
7. Select candidate authority from the active policy contract, its stable
   library identifier, media type, and evaluated signals. Never make routing
   authority depend on a library's mutable display name.

## Implemented Outcome

- A native policy with deterministic identity evidence remains ranked when
  profile observations differ.
- The same precedence applies to every observed profile absence: `R`,
  `PG-13`, `TV-14`, `TV-MA`, and absent genre or keyword values are advisory
  under declared identity evidence.
- A strict policy constraint failure still produces `negative_conflict`, score
  zero, and no route.
- Profile-only and RAG-only candidates retain conservative suppression.
- Pending review records expose declared policy support and, where present, a
  bounded observed-profile difference.
- Existing pending rows are immutable audit records. Retrying them after
  deployment performs a fresh evaluation and creates the current evidence
  projection; no direct database rewrite is required.

## Verification

Focused tests cover diagnostics, calibration, ranking, decision presentation,
and policy recheck adoption. The `Home Before Dark` production shape is
represented by an active native identity rule with a `TV-14` observed-profile
difference.

## Security And Privacy

- The change uses only existing, sanitized policy and profile diagnostics.
- It does not retain prompts, raw AI output, provider payloads, tokens,
  embeddings, or user-generated free text.
- Candidate routing remains server-owned and deterministic; AI remains
  advisory and may not override policy authority.
