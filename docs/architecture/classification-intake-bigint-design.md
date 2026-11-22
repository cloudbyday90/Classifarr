# Exact classification IDs in intake receipts

November 22, 2026 Eastern. First implementation step from the
[classification identity readiness assessment](classification-uuidv7-readiness-outcome.md).

## Failure and scope

Classification History IDs and queue witness links use PostgreSQL `BIGINT`.
The intake receipt column and its live upsert use `INTEGER`. Reconciliation
also filters out the newest witnessed History ID above `2147483647`. The
witness writer adds a second boundary by coercing the classification ID to a
JavaScript number and requiring it to be safe. A classification can therefore
commit while its receipt and witness fail to retain its exact ID.

Widen the existing nullable receipt link and use the shared canonical BIGINT
validator for binding classification IDs on the live receipt and witness
writes. Accept positive safe numbers and canonical decimal strings through
`9223372036854775807`. Keep the existing task ID rules, witness contents,
timestamps and comparison categories. The current database parser gives
private report readers safe numbers and exact decimal strings above the safe
range. Keep the report envelope, limits and fields.

Reconcile only from retained witnesses joined to the exact History row.
Keep newest-witness ordering, the 30-day window, 500-row limit and the guard
against replacing an already linked receipt. The separate decision-context
recovery pass serves the existing numeric `INTEGER`-bounded contract. Exclude
ineligible IDs from that pass before its limit. Preserve older valid snapshots
and allow a large receipt link with unavailable decision context. Existing
recovery and evaluation consumers continue to distinguish those two facts.

Receipt and witness writes keep their existing post-commit, advisory failure
handling. A failed receipt write can be repaired if the corresponding witness
and History row survive. A missing or failed witness yields a gap. This
repair neither repeats classification or provider work nor makes a new
routing or learning decision. Keep retention, cancellation, queue ownership
and repair admission unchanged. Public IDs and UUID generation remain
separate work.

## Evidence and tradeoffs

- PostgreSQL 17 and 18 support the exact signed 64-bit type. `ALTER TABLE`
  takes an exclusive table lock for this change and the conversion rewrites
  the table. Apply the single column conversion through the existing startup
  migration transaction with a five-second lock timeout and a sixty-second
  statement timeout. The transaction preserves constraints, nullable links
  and existing snapshots. A lock or rewrite timeout fails the upgrade rather
  than allowing partial state. Deployed table size and rewrite time still need
  release qualification. [PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html),
  [PostgreSQL 18 ALTER TABLE](https://www.postgresql.org/docs/18/sql-altertable.html),
  [PostgreSQL 17 ALTER TABLE](https://www.postgresql.org/docs/17/sql-altertable.html)
- Keep exact decimal text at the application boundary and use the existing
  driver parser for reads. RFC 8259 identifies the safe interoperability
  range for JSON numbers. The upstream driver defaults `int8` to strings
  for precision. Classifarr's existing parser also preserves safe numeric
  output. [RFC 8259, section 6](https://www.rfc-editor.org/rfc/rfc8259.html#section-6),
  [node-pg-types](https://github.com/brianc/node-pg-types)
- W3C Web Architecture distinguishes resource identity from its
  representation. The applicable practice is to preserve an existing
  identity while making its representation explicit. There is no public UI
  or URI change here. A UUIDv7 redesign would introduce a new identity
  contract and timestamp exposure without resolving the current numeric
  boundary for existing records. [W3C Web Architecture](https://www.w3.org/TR/webarch/),
  [RFC 9562](https://www.rfc-editor.org/rfc/rfc9562.html)

Localizing the conversion to one column limits application and migration
complexity. It briefly blocks access to that receipt table and leaves the
larger correction-evidence contract for a separate decision. An additive
column with dual writes could stage conversion for a deployment with measured
rewrite constraints, at the cost of synchronization and mixed-version
failure modes. A shared snapshot-version change could restore richer evidence
for large IDs, at the cost of separate compatibility and replay review.

The recommended sequence is exact receipt and witness linkage, retention of
the existing numeric decision context, and verified upgrade and recovery.
Audit the other three `INTEGER` History references next. Revisit UUIDv7 when
an independent-generation or public-identifier requirement is established.

## Verification

Use isolated PostgreSQL to prove the populated upgrade and fresh schema,
the int32 boundary, adjacent IDs above JavaScript's safe range, the BIGINT
maximum, and rejection of unsafe and noncanonical inputs. Cover a failed live
receipt write followed by witness-based recovery, concurrent link writes,
expiry, exact report serialization, and existing queue repair refusal. Run
fresh affected coverage and the repository's schema, ownership and quality
checks. Record results in a separate outcome document.
