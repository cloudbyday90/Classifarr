# Retry lineage refusal details outcome

November 21, 2026 Eastern. Implementation of the approved
[design and tradeoffs](retry-lineage-refusal-details-design.md).

A live worker now saves a fixed refusal category in the same terminal queue
update. The categories cover unavailable proof, an unverifiable source
relationship, item identity, media request links and webhook links. The
category follows the existing queue row's lifetime. The migration leaves
earlier rows without a specific reason.

The existing authenticated failed Queue list projects the category for
matching classification failures only. Command Center shows a collapsed
**Why this stopped** disclosure when a category was saved. The Errors toggle
is a keyboard-operable button. Retry and Dismiss still follow the existing
rules. The general explanation covers old and unclassified failures without
making a claim about whether a local replacement committed. The category
describes the recorded attempt and does not locate a missing link today.

The write uses the existing claim and deadline check. Refusal details contain
no exception strings, link IDs, tokens, payload data or proof contents.
Expanding details uses information already returned by the existing bounded
list. No ownership lookup, additional request or repair permission follows
from the saved category.

## Verification

- 385 focused server unit tests and 254 isolated PostgreSQL and HTTP tests
  passed. These cover all five reasons, older rows, malformed stored
  values, payload lookalikes, a contended expired claim, routing replay, and
  rollback and lost acknowledgement controls.
- The full server coverage run passed 64,095 tests with one existing skip.
  The coverage ratchet, CI preflight, lint, and type checks passed.
- The isolated PostgreSQL 18.7 schema snapshot matches the migration. The
  ownership review preserved the existing analysis and classifications.
- Both Chromium recovery-guidance tests passed. The new case uses keyboard
  navigation at 320 CSS pixels and verifies focus and retained action
  availability. All 7,591 client tests and eight production browser checks
  passed.

## Next recommended item

Assess evidence for the generic post-transfer failure path separately.
Distinguish a committed local replacement from an unverifiable routing result
using the saved completion record. Keep that explanation within the existing
Queue and preserve the external replay boundary.
