# October 8 comparison warning investigation

Investigated 2026-10-08; read-only, with no memory-policy or recovery change.

## Observed outcome

Error `eae0aea2-a156-43a4-b26f-75f49b499ac5` exists in the **local test database**,
for container `336f02dadf22`. Persistent application logs record the warning at
16:10:45.014 UTC and automatic recovery at **16:13:45.814 UTC**, about 181 seconds
later. The earlier 11:00:45 memory warning also recovered at 11:03:44. This was
a temporary deferral, not evidence of a permanently stuck comparison job.

The submitted snapshot shows 869.57 MiB process RSS, 446.71 MiB used main-thread
heap and about 5.18 MiB external memory. Host/VM free memory is not the admission
budget. The decision uses `process.availableMemory()` and `constrainedMemory()`.
[Node's documentation](https://nodejs.org/api/process.html#processavailablememory)
distinguishes memory available to a process from its memory usage; RSS includes
the whole process, while worker heap counters are thread-local. Do not add external
memory or array buffers to RSS, or infer a leak from one measurement.

The current local container has a 2 GiB limit. At that limit, discovery requires
768 MiB starting headroom plus a 256 MiB reserve; after a refusal it also requires
64 MiB recovery headroom. Active cooperative reservations are included. Running
work has periodic reserve checks. The report does not preserve the historical
available/required values or which admission/checkpoint refused the work, so an
exact historical budget or allocating component cannot be reconstructed.

The current replacement container `65da4a1ca314` was healthy with zero restarts
and no OOM flag at inspection. That describes the current container, not the old
container's historical OOM counters. A separate diagnostic process observed about
1.11 GiB available, but that is not the daemon's old admission decision. Database
queries used a read-only transaction, a five-second statement timeout and fixed
aggregate fields. Persistent log reads returned only recognized comparison events.
No raw provider payloads, credentials, heap dump or database export were exposed.

## Recommendation

Keep the safeguards and automatic retry. No manual recovery or memory-limit change
is justified by this event. Prior synthetic studies demonstrated temporary resident
page retention after useful objects/workers were released, but those measurements
do not prove the allocation source in this particular event.

The next bounded improvement is diagnostic: carry the **decision-time** available,
required, reserved and constrained bytes plus a fixed admission/checkpoint stage
into this warning. Use a small allowlisted ESM projection, not raw worker reports
or a new persistent sampler. Preserve warning deduplication and all admission,
retry, timeout and cache policies. This adds a little diagnostic plumbing but
allows future reports to distinguish actual capacity pressure from missing context
before selecting another optimization. It is recommended, not implemented here.
