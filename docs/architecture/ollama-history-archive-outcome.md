# Gateway history archive outcome

2026-10-15. Implementation on `main`; no release or live gateway activation.

## Delivered

Small ESM modules provide an offline retention report, consistent native archive
and bounded integrity verification. A PostgreSQL-generated time-based UUIDv7
identifies each archive. No tables or migrations are added. All history, including
uncertain requests and recovery evidence, remains in the source database;
attempts, cooldowns, ownership and the admission cap are not reset.

The [design](ollama-history-archive-design.md) records official research,
alternatives and recommendations. The [runbook](../operations/ollama-history-archive.md)
documents least-privilege access, private files, cancellation and restoration
boundaries. Normal application startup does not run this tool.

## Source validation

Focused backend tests passed 13 suites / 300 tests. Gateway PostgreSQL integration
passed eight suites / 194 tests, including twelve archive cases. These cover busy
owners, dedicated sessions, explicit provider identity, native UUIDv7, read-only
transactions, legacy unknown records, protected lifecycle references, age checks,
counter mismatches and cancellation without mutation. Dump tests additionally
cover size/time limits, child cancellation and sanitized failures.

One repeated run encountered `ECONNRESET` in fixture setup, before the archive
action. The archive suite then passed all twelve tests, and the full focused
integration rerun passed all 194. The reset's underlying infrastructure cause is
not established; no retries or suppression were added to hide it.

Container/archive restore evidence will be recorded after building the clean
source commit. Source tests alone do not prove Linux filesystem or native dump
restoration behavior.

## Remaining scope

No purge, counter reset, automatic retries, scheduled archive, production restore,
real provider stop, Unraid change or shared Ollama change is included. Integrity
verification is not authenticity or restoration verification. A future reviewed
retention implementation must preserve recovery references and tombstones before
reclaiming capacity. The 100,000-binding limit remains unchanged.

The GitHub MCP open-PR query returned zero results on 2026-10-15 (checked twice).
No closed or merged PR was substituted for the requested random open PR.
