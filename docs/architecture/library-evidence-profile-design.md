# Library Evidence Profile Design

## Decision

Classifarr will present a compact, read-only comparison when a pending policy
decision has two or three policy-eligible destinations. It gives an operator
the reason that one library leads without exposing the raw library catalog or
turning contextual AI or RAG evidence into routing authority.

## Problem

The existing pending-decision view explains the leading candidate. That is
useful, but it does not make the decisive comparison visible when the item
could plausibly fit more than one library. The Katrina examples demonstrate the
gap: a title can contain a misleading genre word while the metadata type,
declared destination intent, library history, and similar-item evidence point
in different directions.

Showing raw descriptions, item titles, retrieval passages, policy text, or
model output would add both privacy exposure and false precision. Showing only
one leading card leaves the operator unable to compare the alternatives.

## Architecture

```text
persisted policy result + configured candidate destinations
                         |
                         v
server projection: Library Evidence Profile
  - maximum three existing candidates
  - rounded policy score and margin
  - fixed evidence source/state identifiers only
                         |
                         v
client allow-list normalizer
                         |
                         v
native disclosure + semantic comparison table
```

`policyLibraryEvidenceProfile.mjs` produces the projection from the existing
runtime-question candidate set. Its output is versioned and contains only:

- existing operator-visible library name;
- rounded policy score and distance from the leading score; and
- the existing five bounded evidence sources: item identity and metadata,
  declared policy, observed library contents, similar-item/RAG retrieval, and
  confirmed outcomes.

The client normalizer rejects unknown versions, malformed scores and margins,
duplicate ranks or libraries, unknown evidence shapes, and all non-allow-listed
fields before rendering. The Vue component makes no request and cannot invoke
AI, modify policy, record learning, retry, or route media.

## Data And Authority Boundary

The profile is a server-side projection, not a new evidence API. It explicitly
does not retain or return metadata values, catalog titles or descriptions,
policy terms, library IDs, provider or model details, prompts, raw model
responses, retrieval passages, or routing controls. The browser never receives
those fields as a hidden object to be merely concealed by CSS.

RAG and AI signals are contextual only. They help an operator understand a
score, but declared policy and deterministic candidate selection continue to
own the outcome. This matches NIST's guidance that explanations need suitable
context for the intended user rather than an unbounded generated rationale.

## Operator Experience And Accessibility

The comparison starts collapsed with native HTML `details` and `summary`. The
standard control preserves expected keyboard and disclosure behavior while
keeping the command center calm for straightforward decisions. Once opened,
the information is represented as a real table with column and row headers,
so the candidate-to-evidence relationships are available to assistive
technology as well as visual users.

- [W3C ARIA Authoring Practices: Disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [W3C Understanding SC 1.3.1: Info and Relationships](https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html)

## Alternatives Considered

### Show raw catalog and retrieval text

Pros: richer diagnostic detail.

Cons: exposes data unrelated to the decision, creates a new data-disclosure
surface, and makes contextual evidence look more authoritative than it is.

### Show only another leading-candidate card

Pros: small implementation.

Cons: requires the operator to mentally compare independent cards and hides
the score margin and per-source contrast.

### Expand the comparison by default

Pros: no extra operator interaction.

Cons: makes every pending row busier, including routine decisions that do not
need comparison.

## Recommended Stack

1. Server-owned, versioned allow-list projection for up to three current
   candidates.
2. Client revalidation and a native disclosure containing a semantic table.
3. Deterministic policy selection remains authoritative; RAG and AI remain
   advisory context.
4. A future, separately authorized diagnostic view may expose more detail only
   after a privacy and retention review; it must not extend this operator
   response contract.

This follows OWASP guidance to avoid excessive API data exposure by returning
only what the consumer needs, rather than filtering a broad response in the
client.

- [OWASP Web Security Testing Guide: Excessive Data Exposure](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/12-API_Testing/03-Testing_for_Excessive_Data_Exposure/)
- [NIST AI RMF: Measure 2.9](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
