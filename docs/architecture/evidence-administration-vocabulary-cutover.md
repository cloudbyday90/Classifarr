# Evidence Administration Vocabulary Cutover

## Status

Implemented July 11, 2026.

## Decision

Evidence administration composables and the Evidence view now describe their
operator role directly. The changed headers are comments only; imports, exports,
Vue template behavior, API calls, and action semantics remain unchanged.

## Official Guidance Reviewed

- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  favors stable, descriptive terminology.
- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports focused verification of low-risk maintenance changes.

## Recommendation

Use durable role-based comments for operator-facing client modules. This avoids
stale delivery labels without adding abstractions or compatibility paths.

## Security Outcome

No client request, authorization, storage, or runtime behavior changed.

## Verification

- Evidence action composable test passed.
- Client production build passed.
- The naming inventory is valid at `3/4` production references and candidates.

## Next Step

Rename the remaining historic classification-evidence backfill script comments
to durable migration terminology.
