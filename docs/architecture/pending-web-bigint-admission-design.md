# Exact BIGINT admission for web pending answers

November 23, 2026 Eastern. This follows the
[web transport qualification](pending-web-bigint-readiness-outcome.md).

## Contract

Allow canonical positive History IDs through `9223372036854775807` on the
pending list and its existing answer endpoint. Valid large rows can now
carry the same question contract as safe rows. The resolve response uses
numbers through `9007199254740991` and exact decimal strings above it.
Confirm All continues to send the same requests in sequence. The client
already preserves decimal IDs in paths and checks supplied card bindings.

Use the existing database BIGINT normalizer for the two web admission
checks. Pass the choice explicitly from the endpoint through the typed
answer service into the shared resolver. The answer payload cannot select
this mode. The shared resolver defaults to its safe-integer admission for
direct callers and both Discord paths. Cleanup keeps its separate cap.
Astra confirmed these entry points and the existing exact receipt,
fingerprint, outcome, provenance, and learning paths.

The transaction still locks the requested pending row, validates the current
answer and target, and saves the resolution and its receipt before external
routing. Completed replay still requires the original answer and a matching
row binding. Legacy receipts without a binding can replay for safe IDs only.
Keep current authentication, write access, provider behavior, learning,
and response fields. Existing follow-up learning may reconcile after a
prior incomplete execution under its existing admission rules.

## Recommendations and tradeoffs

The recommended stack uses canonical URI segments, JSON numbers for safe IDs,
decimal strings for larger IDs, explicit web admission, and the existing
row-bound transactional receipt. It admits the full storage range while
preserving safe response types. The two JSON representations need boundary
tests. Keeping the current cap is simpler but leaves some visible rows
unanswerable. Returning strings for every result would simplify client handling
and change the existing safe-ID contract. Widening the shared default would
also admit new values on callers with separate component or cleanup limits.

The W3C recommends consistent resource identifiers. RFC 8259 identifies
the binary64 safe-integer range for interoperable JSON numbers. PostgreSQL
stores a larger signed range and supports preserving the existing row lock.
HTTP guidance limits automatic retries of non-idempotent requests, so
keep replay tied to saved proof and leave the client retry policy intact.
[W3C Web Architecture](https://www.w3.org/TR/webarch/#identification),
[RFC 8259, section 6](https://datatracker.ietf.org/doc/html/rfc8259#section-6),
[PostgreSQL numeric types](https://www.postgresql.org/docs/17/datatype-numeric.html),
[PostgreSQL row locks](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS),
[RFC 9110, section 9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2)

## Verification

Check list-to-answer against production database code on isolated PostgreSQL
with a safe ID, adjacent large rows, and the BIGINT maximum. Cover wrong-row
fingerprints, malformed values, exact response IDs, bound and legacy receipt
replay, routing and learning. Use Chromium to check distinct single and bulk
URLs. Run the existing direct, Discord, cleanup, and quality gates.
The prior Undici PR had been superseded on `main`. Dependabot then closed it
without a merge, leaving zero eligible candidates for this batch.
[PR 596](https://github.com/cloudbyday90/Classifarr/pull/596),
[GitHub Dependabot guidance](https://docs.github.com/en/code-security/reference/supply-chain-security/troubleshoot-dependabot/dependabot-errors#cant-close-pull-request-for-an-update-thats-already-been-applied)
