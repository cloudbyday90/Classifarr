# Representative validation diagnosis and recovery design

Date: 2026-09-13. Scope: the query/profile comparison boundary, not a new Plex
metadata repair pipeline. This extends the unseen-profile diagnosis component.

## Finding and decision

`invalid_input` hides the failed check. Furthermore, the private refresh cache
checks the model header but not all retained profile geometry before reuse. A
malformed cached centroid could therefore remain until normal cache expiry.
This is a structural gap found in code review, not evidence that real library
data is currently corrupt.

Add small ESM validation and diagnostic services. Record fixed failure codes,
the receiving boundary, a plain-language problem, automatic recovery behavior,
and operator steps when recovery cannot safely infer missing data. Never retain
or log the raw vector, metadata, credentials, library name, ID, or exception text.

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Silently coerce, pad or replace invalid vectors | Appears to keep work moving | Can change semantic meaning; reject |
| Log every raw payload | Detailed inspection | Private-data exposure and warning floods; reject |
| Fixed diagnoses plus scheduled cache repair | Actionable, bounded, no new inference | Cannot reconstruct an invalid provider response; implement |

## Recovery contract

Validate complete cached/fitted profile geometry before comparison or publication.
On invalid geometry, withdraw and clear only the private profile cache. Retain
pending valid observations within their existing five-minute lifetime. Use the
existing exponential retry delay (one minute up to one hour), no foreground
refitting and no new embedding calls. Refit from the existing validated vector
repository and revalidate source identity, content freshness and representation
before publishing. Log recovery only after valid profiles are published; do not
claim that any external provider or previously rejected query was repaired.

At query receipt distinguish invalid representation, query identity/contract,
vector shape, dimension mismatch, non-finite values, zero norm and float32 range.
At decision binding distinguish changed identity, changed description and invalid
candidate scope/contract. These are failed checks, not unsupported speculation
about which upstream component caused them. A rejected query is not replayable;
future eligible classifications may provide valid data through the normal path.

Log the first occurrence of each fixed code, then at most one reminder per code
per 30 minutes, with a bounded occurrence count. The registry and in-memory
deduplication are fixed-size and process-local. Restart resets deduplication.
Successful profile recovery ends that failure episode; a later recurrence begins
a new one. An invalid replacement query clears any older captured query, so a
subsequent decision cannot silently consume stale data.
Use existing log retention, authorization and export handling. A logging failure
must never throw into classification or influence routing. Unknown exceptions
produce a fixed unknown-check diagnosis, never an exception-message passthrough.

## Research and verification

- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  supports logging validation failures with actionable context while excluding
  sensitive data and preventing log injection. Application: a fixed vocabulary,
  no raw exception/payload logging, and bounded deduplication.
- [AWS retry guidance](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_mitigate_interaction_failure_limit_retries.html)
  recommends limiting retries and using backoff to prevent failure amplification.
  Application: reuse the existing single-flight, timed background retry path;
  do not add immediate retry loops or duplicate inference.

URLs were discovered with online search and read on 2026-09-13. Test precise
failure codes, log redaction/deduplication/failure isolation, stale-source rejection,
cache withdrawal, retry cooldown, successful rebuild and recovery logging.
Corruption tests use synthetic fixtures, not destructive changes to real inventory.
