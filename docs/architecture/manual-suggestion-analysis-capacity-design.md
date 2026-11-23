# Manual suggestion analysis capacity study

November 23, 2026 Eastern. This follows the
[manual admission change](manual-suggestion-analysis-admission-outcome.md).

## Workload and decision

All-policy analysis visits enabled policies sequentially and retains each
result until the existing HTTP handler serializes the response. Each
policy's cohort has a 5,000-row and 2 MiB limit. The response includes
pattern groups with feedback-ID references, and a feedback record can
contribute to several groups. Astra confirmed that policy count and cohort
size alone cannot predict response bytes. The one-slot admission rule caps
concurrency between manual requests. It leaves the size and cost of one
request dependent on its policies and metadata.

Use the existing disposable PostgreSQL integration harness for a repeatable
sizing study. The experiment uses the production analysis service, HTTP
route, serialization, real suggestion transactions, and the existing
synthetic ingestion and metadata queue fixtures. Keep its fixture and
measurement code under tests. The five fixed arms are:

| Arm | Enabled policies | Feedback rows per policy | Repeated keywords per correction | Work measured |
| --- | ---: | ---: | ---: | --- |
| Small analysis | 4 | 128 | 1 | Analysis |
| Larger analysis | 24 | 128 | 1 | Analysis |
| Richer analysis | 24 | 128 | 8 | Analysis |
| Background control | 24 | 128 | 8 | Ingestion and queue |
| Combined | 24 | 128 | 8 | Analysis, ingestion, and queue |

Use fresh fixtures and fresh Node processes for the recorded arms. Keep the
richer analysis, background, and combined input shapes identical. Use bounded
synthetic provider data with the production ingestion and metadata queue
paths. Prove progress and overlap with operation timestamps and committed
counts. Time and memory indicate this fixture's behavior on the declared
host. Client response byte counting is streamed on loopback. Keep the
fixed receipt limited to aggregate counts, timings, and memory observations.
Run the five arms in table order and then in reverse order to expose
run-to-run variation.

## Recommendation stack and tradeoffs

1. Measure exact JSON bytes, returned result and feedback-reference counts,
   elapsed time, application-process RSS and V8 heap, and the process
   lifetime high-water RSS. A loopback request in the same test process
   still contributes transport and runner overhead. Capture phases before
   analysis, before serialization, and after the response finishes. Report
   event-loop sampling as sampling and the lifetime peak as a separate
   quantity. [Node.js process metrics](https://nodejs.org/download/release/latest-v24.x/docs/api/process.html)
2. Verify successful PostgreSQL analysis for the nonempty arms and actual
   ingestion/queue completion for the background arms. Distinguish a work
   lifetime that overlaps from a write that completes during the response.
   Use descriptive table headers, units, and text outcomes in the report.
   If a product status view is later added, its waiting and completion
   messages should be programmatically available.
   [W3C tables guidance](https://www.w3.org/WAI/tutorials/tables/)
   · [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)
3. Keep the current HTTP and production admission contracts during this
   study. A memory reservation can reduce competition with ingestion and
   queue work, while accumulated response results would still grow within
   one request. A deterministic batch or resumable result contract can bound
   that growth, with compatibility and partial-result semantics to design.
   A Linux container study can measure the combined PostgreSQL and app
   budget, at greater setup and execution cost. Prefer the narrow local
   study first, and require cgroup evidence before choosing a deployment
   memory reservation. [OWASP resource-consumption guidance](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/)
   · [Linux cgroup memory accounting](https://docs.kernel.org/admin-guide/cgroup-v2.html)

## Verification

Run the fixed profiles sequentially in isolated PostgreSQL. Verify fixture
integrity, bounded work, actual output and cleanup, and peak interpretation.
The existing integration runner runs the small profile by default. Developers
can select `small`, `larger`, `richer`, `background`, or `combined` with
`CLASSIFARR_TEST_SUGGESTION_ANALYSIS_PROFILE` on a new invocation of
`manual-suggestion-analysis-capacity.test.mjs`. The selected profile emits one
aggregate measurement record.
Run the affected repository gates, record evidence separately, and push to
`main` after review. The active application, hosted deployment, and published
release are outside the measurement.
