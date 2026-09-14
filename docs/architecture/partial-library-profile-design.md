# Coverage-aware library profile publication design

Date: 2026-09-13. Scope: automatic local shadow profiles, not routing authority.

## Finding and recommendation

Commit `03735a23` isolates failed description batches and lets healthy embeddings
backfill. Profile publication still requires all vectors in its refresh worker,
source digest and fit-thread admission. One missing description therefore blocks
every library even when other libraries have complete evidence.

Replace that global completeness requirement with explicit per-library coverage.
Count distinct descriptions exclusive to each library after resolving the full
current membership graph. Shared descriptions never become exclusive because a
vector is missing. Duplicate copies do not add support, and library names are
never features.

Initial readiness requires at least three available exclusive descriptions and
90% availability among that library's eligible exclusive descriptions. Three is
the existing minimum geometric support; 90% is an engineering starting threshold,
not an externally prescribed number, statistical guarantee or confidence score.
Incomplete coverage can be systematically biased. Keep this behavior shadow-only
and distinguish partial-data comparisons before evaluating any routing change.

## Processing and safety contract

- Preserve all current identities, description hashes and candidate libraries.
  Missing vectors are absent evidence, never zero vectors or negative matches.
- Fit only available vectors for ready libraries. Keep explicit sparse/waiting
  placeholders for other libraries; never silently remove a candidate.
- Permit a comparison only when every candidate is ready. Record partial-data
  agreements/disagreements separately from complete-data results. Existing
  convergence, minimum support, tie and multi-start checks remain authoritative.
- Source digests include the full membership graph and each vector's presence.
  Recovery, expiry, new membership or changed geometry invalidates the old key.
- Recheck the complete source digest, representation, configuration and foreground
  admission before publication. Validate returned profile scope and coverage.
- Retain fixed worker code, empty thread environment, memory/work limits,
  cancellation and current model validation. No extra inference or cloud calls.
- Known-item/description exclusion uses the original inventory, including missing
  descriptions. A full-inventory profile is not a held-out benchmark model.
- Expose only bounded fixed counters. Keep new explanation inside the existing
  collapsed Library learning disclosure, preserving SWR, pause/permission clearing,
  keyboard access and quiet status announcements. No new endpoint or control.

## Alternatives and final recommendation stack

| Approach | Advantage | Disadvantage | Decision |
| --- | --- | --- | --- |
| Wait for every vector globally | Complete inputs | One item blocks unrelated libraries | Replace |
| Publish complete libraries only | Strong coverage boundary | A small backlog can indefinitely block a large library | Too restrictive for this shadow slice |
| Fit any available subset | Fast availability | Tiny/biased subsets can appear authoritative | Reject |
| Coverage-gated partial profiles | Automatic progress, explicit limits | Threshold needs evaluation; missingness can bias results | Adopt for shadow use |
| Fill missing vectors or omit candidate libraries | Easy complete-looking output | Invented evidence or misleading comparisons | Reject |

Final stack: validated cached vectors, full-scope coverage accounting, isolated ESM
fit workers, source-bound atomic publication, complete-candidate shadow comparison,
separate partial counters and existing accessible SWR presentation.

## Official research discovered and opened through tools

- [Microsoft bulkhead guidance](https://learn.microsoft.com/en-us/azure/architecture/patterns/bulkhead): isolate failures so healthy components can continue. Applied here to
  library readiness, without adding cloud infrastructure or per-library workers.
- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/): document knowledge limits, availability/representativeness and measurement limits;
  evaluate before deployment and monitor afterward. Coverage is not accuracy.
- [scikit-learn common pitfalls](https://scikit-learn.org/stable/common_pitfalls.html): keep evaluation data out of training. Preserve novelty checks and require a
  separate held-out comparison before changing live classification.
- [OWASP input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html): validate structured inputs at trusted boundaries. Reject malformed or
  extra-scope vectors and profile coverage rather than treating corruption as absence.
- [W3C ARIA22](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22.html): provide programmatically identifiable status messages without moving focus.
  Preserve the existing polite status region and avoid announcing every counter
  update. Techniques are examples, not a claim of WCAG certification.

## Verification and rollback

Exercise complete/partial/below-threshold/empty libraries, exact threshold edges,
shared/duplicate membership, new or expired vectors during fit, model/configuration
changes, sparse/unconverged geometry, known missing descriptions, cancellation,
thread parity, bounded counter projection, and old/new client payload handling.
Use synthetic movie/TV fault probes and existing PostgreSQL/Compose checks; do not
publish private corpus data or call a paid provider for fault testing.

No schema, dependency, product version or release change is required. The internal
profile and shadow-counter contracts move to v3; the client still reads valid v2
counter snapshots during deployment. Rolling back code rebuilds the private
in-memory profile cache under the previous contract.
