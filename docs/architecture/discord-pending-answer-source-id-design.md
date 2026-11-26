# Exact Discord pending-answer event references

November 26, 2026. The
[terminal History repair](terminal-request-import-history-id-outcome.md)
identified a separate numeric conversion in Discord pending-answer
intake. The maintainer approved preserving both the exact History ID
and the complete native evidence fingerprint.

## Boundary

The intake projection accepts pending History rows and produces an
outcome-only learning-intake reference from native or legacy state.
The current verification and correction handlers call it after
recording an outcome and use its result for diagnostics. Their
completed-delivery checks exclude pending rows. The active compact
pending-answer controls use separate provenance and authorization.

The existing numeric conversion can collapse adjacent BIGINT IDs.
Separately, the verbose native source key has 46 fixed characters.
A 64-character fingerprint therefore fits with a 10-digit ID,
reaches 121 characters at an 11-digit ID, and reaches 129 at the
BIGINT maximum. The shared intake projection clips at 120.

Use shared exact BIGINT validation for the History ID. Keep safe
numbers, exact decimal strings above that range, and the existing
invalid-classification response. Keep the legacy key and any native
key that fits. For an overflowing native key, use
`discord_pending:v2:<id>:<fingerprint>`. Its longest valid form is
119 characters, with 19 for the ID and 80 for the fingerprint. The
prefix distinguishes it from the existing key, and the component
grammar excludes the separator. Check the entire trimmed fingerprint
before selecting the existing `unknown` marker for an invalid token.
Retain the current metadata-first, nullish runtime fallback.

Saved questions and earlier logs are left as recorded. A shortened
historical log cannot supply evidence digits that were already lost.
The intake key remains diagnostic provenance. Existing message,
delivery, claim, routing, replay and learning checks retain authority.

## Research and alternatives

RFC 8259 describes the interoperable JSON integer range. PostgreSQL
BIGINT extends beyond it. Use decimal text above the safe range and
retain numeric compatibility below it. W3C recommends preserving
existing identifiers and consumer contracts. OWASP recommends
consistent diagnostic field formats and preserving correlation
identifiers under the existing log access controls.
[RFC 8259, section 6](https://www.rfc-editor.org/rfc/rfc8259.html#section-6) ·
[PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html) ·
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) ·
[OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

| Option | Benefit | Cost |
| --- | --- | --- |
| Use a versioned compact key only on overflow | Preserves complete existing keys and the full accepted token | Readers of native diagnostics can see two formats |
| Hash the fingerprint into a shorter suffix | Accommodates longer inputs under a fixed bound | Replaces the original visible token and adds a hashing format |
| Raise the shared identifier bound | Leaves the verbose format in place | Changes limits for unrelated intake producers and consumers |

Use shared exact History validation, a bounded versioned overflow key
and the existing intake limit. Keep destination parsing, the pending
state rule and outcome-only safeguards in their current owners.

## Completion

Reproduce rounding and clipping before the fix. Verify adjacent and
maximum IDs, the exact 120-character boundary, distinct long tokens
that share a prefix, malformed inputs, and existing short keys.
Use isolated PostgreSQL to exercise loaded pending rows through the
pure projection and completed verification/correction through their
actual handler entry points. Confirm that completed controls still
refuse pending rows and that no learning or routing change follows
from the diagnostic format.
