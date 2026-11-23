# Exact ID admission for pending resolution design

November 22, 2026 Eastern. Approved follow-up to the
[historic refresh outcome](historic-refresh-bigint-outcome.md).

## Observed boundaries

The active web resolution route uses `Number.parseInt` on the History path
parameter. The two Discord pending-answer formats also parse their History
segment before lookup, and the current answer handler converts the result
again. Prefix parsing can select a different row than the input identifies.
Numeric conversion also merges adjacent History IDs beyond the safe integer
range. Astra confirmed both paths feed the same resolution owner.

The shared answer contract hashes its numeric History ID along with the
question and recommendation. The completed replay path compares the stored
version, fingerprint, action and destination on the selected row. Native
resolution provenance, destination evidence and automatic exact-item learning
also normalize IDs on their own boundaries. A route-only BIGINT widening
cannot preserve row identity across those consumers. Historic refresh already
uses exact IDs for its read-only inventory and separate retry command. Its
eligibility derives from the shared answer builder, so changing that builder
would extend the impact of a pending-resolution admission repair.

## Agreed first batch

- Use one small parser for positive safe integer numbers and canonical ASCII
  decimal strings in the same range. Reuse existing exact database ID parsing
  before accepting a numeric representation. Reject alternate spellings,
  overflow and unsafe numbers before the web route checks a destination or
  Discord reads a classification. Carry the raw History segment from the
  current `ai_answer` and legacy `ai_clarify` Discord formats to the parser.
- Require the same admission at the common pending-resolution transaction
  entry, including direct runtime and legacy calls. Keep existing valid direct
  scalar bindings and safe numeric HTTP results. This is a bounded safety
  repair. It does not enable new large-ID mutations or broaden authorization.
- For a pending row outside the supported range, use the existing unavailable
  answer state in the web projection and omit pending-answer buttons in
  Discord. Keep the row and the existing retry surface available. Keep the
  shared answer builder, fingerprints, historic inventory, receipt lookup,
  unrelated Discord commands, option indices and provider IDs intact.

## Authority and verification

Retain current admin and Discord message binding, destination validation,
row locks, stale and completed replay semantics, postcommit routing, and the
existing learning gates. For admitted safe IDs, preserve the same stored
fingerprint bytes and exact-replay contract. An ambiguous ID produces the
existing validation response before database or provider work for the answer.
The existing saved outcome governs exact completed replay. This batch adds
no new provider retry, schema, UI workflow, release or deployment.

Verify safe explicit choice and bulk confirmation, safe numeric and canonical
string inputs, maximum safe ID, malformed and oversized refusal before lookup,
both Discord pending formats, unavailable controls on large rows, and safe
completed receipt replay. Use isolated PostgreSQL and HTTP plus existing
client or browser controls. Verify historic refresh still lists large rows and
retains its existing retry eligibility. Run focused and normal quality gates.

## Official guidance and tradeoffs

Official sources checked on November 22, 2026 through the connected search
service. W3C Web Architecture separates identifier and representation. JSON's
widely interoperable integer range is smaller than PostgreSQL BIGINT. Use the
safe numeric contract for this repair and consider exact decimal strings
when each downstream consumer is ready.
[W3C Web Architecture](https://www.w3.org/TR/webarch/),
[RFC 8259, section 6](https://www.rfc-editor.org/rfc/rfc8259.html#section-6),
[PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html)

Preserve existing completed replay evidence rather than treating a missing
POST response as authority for a new mutation. The command already has a
row-bound check and a stale-result distinction.
[RFC 9110, section 9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2)

The recommended stack is canonical admission, unavailable controls for
unsupported IDs, and unchanged durable replay. It stops wrong-row selection
without migrating fingerprints or changing routing authority. The cost is a
temporary safe-integer ceiling on pending answers. Full BIGINT support will
require exact fingerprint input and a coordinated provenance, learning,
Discord delivery and replay contract, with numeric legacy compatibility.
