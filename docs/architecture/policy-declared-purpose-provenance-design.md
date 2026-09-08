# Declared Policy-Purpose Provenance Design

Status: implemented, unreleased. Research reviewed on 8 September 2026.

## Problem

The held-out-study source screen excluded the known profile-derived rule source,
but treated every other stored source as retained declared purpose. The database
allows source strings beyond the two server command paths that record native
intent, so an unfamiliar source could have been counted as qualified evidence.
That would make future automation trust a provenance it cannot verify.

The current private audit has fifteen profile-derived purpose rules across ten
active policies and no native declaration, so the stopped cohort result was already correct. This change
closes the general boundary before any future data can be considered.

## Decision

`policyDeclaredPurposeProvenance.mjs` is the single ESM provenance classifier
and static-SQL-predicate builder. It recognizes three content-free states:

| State | Rule condition | Study meaning |
| --- | --- | --- |
| Declared native | `native_intent` or `operator_declared_intent` source | May supply declared-purpose evidence. |
| Profile-derived | `media_server_library_profile` source and `inferred` state | Descriptive only; excluded from study evidence. |
| Unverified | Every other source/state combination | Fails closed and never supplies study evidence. |

The classifier deliberately has no library, provider, configuration, rule
value, media, or actor input. It is reused by the policy-source screen, current
evidence inventory, library aggregate, bounded lifecycle receipt, and
administrator coverage review. SQL predicates have a fixed value set and only
accept a validated identifier alias, avoiding value interpolation.

The source screen advances to v4 and the eligibility audit to v5. Related
aggregate contracts advance together: evidence inventory v2, lifecycle purpose
evidence v2, readiness v2, coverage review v9, and lifecycle provenance receipt
v3. The client validates the added unverified receipt partition exactly.

```text
stored purpose-rule provenance
  -> declared native | profile-derived | unverified
  -> fixed aggregate counts and versioned receipt
  -> complete policy evidence only from declared native rules
  -> existing private audit remains read-only and may still stop
```

## Security and authority boundary

- An unrecognized source cannot become declared purpose through a default,
  configuration setting, library observation, or client projection.
- Profile evidence remains descriptive, including when it is the only observed
  evidence. Neither profile nor unverified evidence can create a cohort,
  collect labels, invoke AI, edit policy, or route media.
- Query results remain fixed aggregate counts. Rule terms, policies, libraries,
  receipts, providers, media, and configuration never leave the persistence
  boundary.
- Existing server authorization still guards the administrative review. This
  work adds no endpoint, dependency, migration, or mutation flow.

## Research basis

W3C Data on the Web Best Practices recommends provenance, quality information,
versioning, and explanations when data cannot be used. The explicit
provenance partition and versioned count-only contracts make the block
machine-readable without disclosing the underlying policy data. [W3C Data on
the Web Best Practices](https://www.w3.org/TR/dwbp/)

W3C PROV-O distinguishes entities from the activities that generated or
influenced them. The source classifier preserves that distinction: a recorded
native authoring activity and an inferred profile observation have different
authority even when both describe a purpose rule. [W3C
PROV-O](https://www.w3.org/TR/prov-o/)

OWASP recommends accepting fixed ranges, validating format, and rejecting
unexpected input. The allow-list classifier and validated SQL aliases apply
that rule at both the JavaScript and SQL construction boundaries. [OWASP REST
Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep all non-profile sources as declared | No immediate compatibility change | Unknown provenance can acquire policy authority | Reject |
| Infer native intent from library membership or configuration | Reduces apparent missing evidence | Circular, library-specific, and not an authoring record | Reject |
| Return source rows for manual inspection | Explains each exception | Exposes operational data and requires operator work | Reject |
| Allow-list server-recorded sources and report unverified aggregates | Deterministic, portable, privacy-bounded, and safe for automation | Older consumers must honor version changes | Adopt |

## Recommendation stack

1. Use only the two server-recorded native sources as declared purpose.
2. Preserve profile-derived and unverified states as aggregate diagnostic
   evidence, never as study eligibility.
3. Let ordinary native authoring and verified lifecycle records accumulate
   evidence passively; do not synthesize or backfill it from library settings.
4. When a real cohort can be captured, require independent labels and the
   existing readiness plus frozen-study preflight.
5. Only a good measured error profile can justify semantic counter-evidence;
   ambiguous items go to review and are never routed automatically.
