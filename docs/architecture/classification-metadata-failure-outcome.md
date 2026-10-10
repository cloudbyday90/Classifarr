# Classification metadata failure outcome

## Findings

Read-only Unraid inspection reproduced a current TMDb 404 for the stored movie
identity behind the reported error. Five old attempts stopped at metadata fetch;
the original exception is no longer in retained logs. A 404 does not establish
which replacement, if any, represents the same work. Production was not changed.

The code defect is independently reproducible: metadata enrichment discarded
the provider status before the queue could classify the error. The fix preserves
only safe category/status/transport/retry-after fields in a typed ESM error and
the task failure log. A 404 from the
details call stops automatic retries on the current owned claim, while unknown
and transient failures retain the normal retry schedule. A later certification
404 cannot falsely declare that the movie itself is missing.

Command Center explains the failure and displays a task reference. Known missing
records require verification, not blind title replacement. The next release's
idempotent migration updates only eligible failed/unclaimed metadata-stage tasks
and their generic failed intake receipts. It backfills **diagnostic context**,
not a replacement ID, a successful classification or a new retry budget.
There are no network calls in that migration and no schema structure changes.

## Verification

A read-only production count found exactly one row eligible for the future
backfill. No migration was run there. The ownership gate initially flagged the
new SQL and two modified queue modules; their exact changes were reviewed.
Only those review entries were updated. Existing shared-writer debt remains
unresolved, and the gate subsequently passed.

The typed-boundary tests first failed with the missing module. Focused backend
checks pass: four suites, 130 tests. Isolated PostgreSQL checks pass: three suites,
15 tests, including existing queue fencing and source cross-reference tests.
The new migration fixture verifies excluded active/cancelled/completed/routed
rows, preservation of every other task column, receipt alignment and idempotence.
Real PostgreSQL acknowledgement checks distinguish permanent missing records from
transient failures and reject stale claims without changing attempt counts.
Two focused client suites pass, 16 tests, including rendered guidance and no
implicit retry. The complete client suite passes: 449 files, 6,543 tests.
Final lint, server/client typechecks, dependency/ownership preflight, ESM static
imports, mock-shape and documentation checks pass. No ownership debt was waived.

The first complete backend pass exposed stale ownership and schema review state.
The isolated schema dump changed only its generated/latest-migration headers and
the applied-migration list. That complete diff was reviewed before refreshing
only its ownership digest. Both corresponding suites then passed (60 tests).

The final complete backend run finished with 1,769 passing suites / 55,196
passing tests, one failure and one platform skip. The failure was the unchanged
Discord delivery-verification transport subprocess: its 15-second outer deadline
expired during concurrent build/test load. A subsequent targeted rerun passed
all eight Discord transport cases in 9.932 seconds without code or timeout
changes. This is not a claim that the full invocation was green; the tight
150 ms inner fixture timing deserves a separate load-sensitivity review. The
Windows directory-fsync skip is covered separately by the actual Linux image
probe, not silently counted as a Windows pass.

## Local image evaluation

The final no-cache build used clean source
`cfdff1c01e92ce1fa3801777eaa4a4102bea7629`. Docker's inspected local image ID is
`sha256:5b11224aa810f7d0ac82f702141a341926c27c8af58d3d069465308867ab9341`;
this is local build evidence, not a published registry release or attestation.
Only local Compose service `classifarr` was replaced. A pre-change custom-format
database archive (76,768,541 bytes) has a verified checksum/readable table of
contents, and the original image has an exact rollback tag. This is not a full
restore rehearsal.

The final container is healthy with the database connected, zero restarts and no
OOM indication. Existing 2 GiB memory limit, UID/GID 1000, read-only root and
ownership/memory safeguards remain unchanged. The data-only migration is applied
locally. Exact-image, non-root, network-none checks pass for the offline mapping
fixture, sanitized metadata failure categories/log fields and Linux directory
fsync with exclusive copy/source preservation. The final post-rebuild schema dump
uses a disposable database, not local appdata or Unraid. It passed without further
snapshot changes; the owned container and data directory were both removed and
their absence verified.

The final read-only local cross-reference result remains eleven observations,
ten agreement-with-missing-mappings and one no-typed-match. Nothing was remapped
to make the count look better. No Unraid restart, mutation, retry or deployment
occurred. Later documentation changes do not change the tested runtime bytes.

## Limits and next item

The affected Unraid item is **not repaired or retried**. Its identity still needs
authoritative review. This release groundwork fixes misleading diagnostics and
repeated automatic calls to a confirmed missing record, not upstream catalog
data. The [design](classification-metadata-failure-design.md) records official
sources, recovery semantics and tradeoffs.

Prioritize a reviewed identity-repair flow tied to the existing task/history,
with fresh catalog proof and protection against repeating remote actions.
Also address stale-decision maintenance's separate reset/enqueue operations and
missing history lineage. Negative historical stage durations were observed;
they are a separate timestamp/timezone diagnostic defect, not proof of the 404's
historical cause. No memory or ownership safeguard was relaxed.
