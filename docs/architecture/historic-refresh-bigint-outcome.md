# Exact History IDs for historic refresh outcome

November 22, 2026 Eastern. Implementation of the approved
[design and official research](historic-refresh-bigint-design.md).

Historic refresh now carries exact History IDs across inventory pagination,
browser selection, retry results, and actor-bound receipt reads and writes.
Safe IDs remain numeric and IDs above JavaScript's safe range use decimal
strings. An omitted inventory cursor starts at the first page. An explicitly
invalid cursor produces a 400 response. The historic display uses the exact
loaded row ID while the shared pending-answer fingerprint stays intact.

The recursive lineage read checks the stored text's byte length, canonical
digits and maximum before casting to BIGINT. An invalid link ends the branch
at the last valid row. The query keeps its typed lookup and existing depth
limit. Existing administrator and actor checks, retry eligibility, numeric
task ID limits, receipt IDs and versions, and read-only receipt recovery
still govern the command. The existing database schema supports this change.

## Verification

- Isolated PostgreSQL and HTTP exercised adjacent IDs at the database maximum
  across pages and in a single command with opposite outcomes. The receipt
  reconciled both IDs exactly, another actor received a 404, and the reads
  added no tasks. Malformed cursors and invalid or duplicate selections were
  refused before retry execution.
- The PostgreSQL receipt query followed a valid maximum-range link and kept
  its valid prefix when a later link was out of range, overlong, or padded.
  Existing numeric receipt and actor-bound recent receipt cases passed.
- The Chromium scenario selected adjacent rows across pages, checked the
  existing acknowledgement gate, then observed one POST and the exact
  protected receipt. Client and server contract tests covered the same wire
  types and the shared answer fingerprint behavior. Astra reviewed the
  identity projection, SQL guard and receipt authority.
- Local ownership review passed without a baseline change. GitHub showed
  no open PRs or Dependabot branches eligible for rebase at assessment.

## Next recommended item

Trace the active pending-resolution command and its answer fingerprints
together. Its route uses `Number.parseInt` on the History path parameter and
the shared answer contract uses a numeric candidate ID. Test explicit choice,
bulk confirmation, and saved receipt replay before changing the identifier
at that boundary. Keep UUIDv7 tied to a distinct, demonstrated requirement.

The [pending-resolution admission repair](pending-resolution-id-admission-outcome.md)
closes the ambiguous lookup boundary before full BIGINT resolution support.
