# Classification Evidence Migration Vocabulary Cutover

## Status

Implemented July 11, 2026.

## Decision

Classification-evidence migration scripts now describe the graph relationship
and evidence backfill work they perform. The commands, imports, exports,
database behavior, batch processing, and verification logic are unchanged.

## Official Guidance Reviewed

- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  favors stable and descriptive terminology.
- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports focused verification for maintenance changes.

## Recommendation

Keep script comments tied to the concrete migration purpose, not the delivery
phase that introduced a schema or CLI. This keeps maintenance tools legible
after roadmap history changes.

## Security Outcome

No database query, command handling, batch boundary, or verification behavior
changed.

## Verification

- Classification-evidence backfill verification tests passed.
- The production naming inventory reports zero production references.
- The naming regression baseline is `0/1`; the one candidate is maintenance
  tooling scheduled for a separate cutover.

## Next Step

Replace the final phase-coded maintenance-tooling pattern with durable naming
and close the production naming inventory backlog.
