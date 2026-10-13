# OMDb recent lookup reuse outcome

Date: 2026-10-13. Verification in progress.
See the separate [design, sources and tradeoffs](omdb-recent-lookup-design.md).

## Delivered behavior

Ordinary title, IMDb-ID and search requests can supply one minute of process-local
connectivity evidence. Health accepts verified success; SSL recovery also accepts
a confirmed miss. Reuse retains original check timestamps and latency and makes
no provider request or quota debit. The existing classifier and TLS transport are
unchanged; no response body, title, key or raw error enters the record.

New requests, overlap, failure and queue SSL pauses invalidate evidence. Reads
check both monotonic and wall-clock age, plus current saved configuration,
credential rejection, budget and pacing in a short bounded transaction. Probe
fallback remains unchanged. Process restart loses the observation. Status views
do not acquire provider-call capability. No schema, dependency, new worker,
memory safeguard change or inventory repair is included.

Ownership review covers the changed lookup/queue paths and their new reader.
Existing queue shared-writer and indirect-analysis debt remains unresolved.

## Verification

Pending completion of full gates and exact-image local evaluation.

## Recommendation stack and limits

1. Strict existing response classifiers and HTTPS transport: validated evidence
   without new provider behavior; inconclusive responses still need a future check.
2. Single short-lived local record: constant retained state, no database migration
   and fewer redundant requests; restart, concurrency and separate processes reduce
   reuse opportunities. It does not establish cross-host TLS health.
3. Current-setting/budget/wait checks and admitted-probe fallback: existing limits
   remain effective; a reusable result costs a short database read transaction.

Next: measure eligible reuse and fallback reasons with bounded, credential-free
aggregate diagnostics before considering a longer lifetime or distributed cache.
Synthetic tests prove behavior, not savings under production workload. Unraid,
Plex and shared Ollama are outside this local deployment. No release or merge.
