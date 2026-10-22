# Representative refresh incident investigation outcome

## Observed evidence

On 22 October 2026, found the exact reported incident in the local Classifarr
database using bounded read-only transactions, three-second statement and
500-ms lock deadlines, and rollback. The stored SchedulerService ERROR matches
the reported generic unavailable code and contains only the metadata key error.
The database uses America/New_York and timestamp-without-time-zone storage;
anchoring surrounding queries to the exact row avoids a mistaken UTC offset.

Within two minutes either side of that row, error_log has only that record and
app_log has none. A bounded Docker-log request for the equivalent UTC window
returned no retained lines. A separate bounded read of three rolled application
files (13,872,366 bytes; no files skipped; 67 directory entries, below the cap)
found 118 entries in the window, including two copies of the generic scheduler
failure across the all/error streams. These are not two independently confirmed
incidents. No RepresentativeValidation warning, allowlisted cause category or
statement-timeout message was found in those JSON entries. This is not proof
that the provider/database had no failure: the relevant catch discards it.

The three currently running refresh/scheduler/runner source files have SHA256
hashes matching the checkout. This establishes the current implementation, not
an immutable historical execution trace. No database row, setting, cooldown,
provider, task, live container or production filesystem was modified. Raw log
payloads, endpoints, credentials, vectors and descriptions were not exported.
Browser interaction was unnecessary after finding the exact database record.

## Source finding and tests

The refresh catch returns failed for non-deferral errors without the original
stage/category. The scheduler constructs a fresh generic error; the logger
creates a stack at persistence because it receives a string, not that original
Error. Provider transport/representation problems, database failures, budget or
fit errors and task deadlines can converge here. Memory in the supplied report
does not prove an OOM or justify raising limits. Ordinary resource admission
deferral is a different outcome and does not produce this unavailable wrapper.

Using pinned Node 24.21.0, the two existing representative scheduler/refresh
Jest suites pass: 42 tests, no snapshots. These are isolated fixtures, not a
reproduction of the historical live failure. No runtime fix was implemented or
claimed, and no refresh/provider request was triggered during diagnosis.

## Recommendation

The underlying incident cause remains unknown because its original evidence was
not retained. Adopt the separate
[bounded diagnostics proposal](representative-refresh-failure-diagnostics-design.md)
before changing retries, validation, memory or provider settings. Preserving
finite stage/category evidence is the next recommended platform item; it cannot
retroactively reconstruct the discarded error. Further live log/database scope
or recovery actions are not implied by this investigation.

The subsequently approved
[implementation outcome](representative-refresh-diagnostics-implementation-outcome.md)
records bounded diagnostic propagation, isolated tests and image qualification.
It does not retrospectively identify this incident's discarded cause.
