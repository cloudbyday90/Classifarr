# Request identity normalization outcome

Date: 13 October 2026. No release or production deployment.

## Delivered behavior

A shared ESM parser gives classification, webhook intake and failed-task checks
the same interpretation of supported flat, camel-case, nested and legacy IDs.
Equivalent values normalize; malformed or contradictory declarations do not
silently select the first value or fall back to a title search. Source webhook
declarations are checked against saved normalized columns before replacement
evidence is considered. The implementation is library-agnostic.

Saved requests are not rewritten. Approved repair remains flat-only. Automatic
same-ID recovery excludes alternate identity containers and recognizes newer
requests using aliases as competing work. Existing recovery history/budgets remain
unchanged; legacy records display their paused status without provider I/O.

Metadata failures now carry their actual typed lookup, safe provider observation
and shared failure reference through classification, queue processing and queue
acknowledgement. Classification logs preserve the safe wrapper's boundary stack,
not the credential-bearing upstream exception or a fabricated logger stack.
Acknowledgement reports its database-confirmed attempts and retry outcome;
earlier failure observations do not claim a retry was admitted.

## Verification status

- Focused unit/HTTP checks passed: 474 tests in 14 suites, including the ownership
  gate after explicit review. Additional edge-case tests and final full checks are
  pending at this implementation checkpoint.
- Isolated PostgreSQL checks passed: 95 tests in five suites, covering source/task
  changes, nested diagnostics, conservative repair/recovery admission, preserved
  rows/budgets, stale claims and sanitized persisted error context.
- First full frontend run passed: 471 suites, 7,282 tests. The final run includes
  the additional legacy-pause presentation tests.
- The first full backend run began before the ownership review update and flagged
  its stale hashes. A final run on the reviewed source is required before handoff.
- Type checking passed. Final lint, coverage, no-cache image and local evaluation
  results will be recorded below before completion.

The ownership review covers exactly two queue files. No claim predicate, retry
increment or protected-inventory write was relaxed. Existing post-completion
inventory ownership debt is explicitly retained as unresolved, not waived.

## PR availability and limitations

GitHub MCP returned no open repository PRs on 13 October 2026; none could be
randomly selected. No closed PR was substituted, and no PR was merged.

This does not fix a missing provider record, approve an identity replacement,
expand approved-repair backfill, reconstruct old log context, or deploy to Unraid.
Plex, shared Ollama, memory safeguards and ownership protections are unchanged.

## Recommendation stack

Keep strict shared normalization, unchanged source provenance, sanitized correlated
reports and conservative write gates. These improve consistency without a bulk
rewrite; the tradeoff is that ambiguous legacy requests stay held for review.
The [design and official research](request-identity-normalization-design.md) compare
alternatives and document the bounds.

Next: design alias-preserving approved repair. Require every recognized ID path to
be updated atomically under the existing preview/confirmation fences, prove that
all consumers see the same approved identity, then assess bounded backfill. Do
not widen automatic admission merely because diagnostics can now read a format.
