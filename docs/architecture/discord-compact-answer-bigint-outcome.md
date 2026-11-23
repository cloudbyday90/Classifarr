# Exact BIGINT IDs for compact Discord answers outcome

November 23, 2026 Eastern. See the
[design](discord-compact-answer-bigint-design.md) for sources and tradeoffs.

## Implementation

Compact Discord tokens retain their format and carry exact positive History
IDs through PostgreSQL's BIGINT maximum. A dedicated parser validates the
whole token and retains every character of the base64url fingerprint. Its
largest supported ID uses 65 of Discord's 100 characters. Canonical
History IDs are validated before outgoing notification database reads and
incoming interaction work. The existing stored-message check precedes
versioned resolution, which still validates the answer under the row lock.

The index-only clarification path and its companion library selector keep
their prior admission. Cleanup and generic shared callers also retain their
safe-ID limits. Web answers continue using their existing explicit opt-in.

## Verification

- Astra confirmed the compact grammar, size calculation, stored-message
  check, and locked receipt replay. The 192 focused tests passed, including
  full underscore-containing fingerprints, malformed components, overflow,
  legacy cap and old compact-ID compatibility.
- All 107 scoped PostgreSQL tests passed. The real Discord SDK serializer
  exercised delivery and interaction for adjacent large IDs and the BIGINT
  maximum. The notification messages and routing provider were local
  stand-ins. Wrong message and copied fingerprint checks left classification and
  learning state untouched. Concurrent and later valid replies produced
  one route per resolved row and preserved its exact answer receipt. Replay
  left the learning receipt inventory unchanged. The native route outcome
  and answer receipt survived together.
- Lint, type checks, preflight, the inventory ownership gate, and policy
  checks passed. The root, server, and client npm audits reported zero
  vulnerabilities at check time.
- Fresh backend coverage passed 64,331 tests across 1,957 suites with one
  skip. The coverage ratchet passed with the client report from the
  preceding web change, verified against its unchanged inputs and hash.
- GitHub had no open PRs during review. There was no Dependabot change
  to rebase or adopt.

## Next recommended item

Trace stored-message ownership and exact ID parsing across the legacy
clarification button and its library selector. Qualify that shared
correction path before enabling large IDs in legacy notifications.
