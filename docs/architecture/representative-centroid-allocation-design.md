# Representative centroid allocation investigation

Date: 2026-10-07. Scope: temporary allocation in representative membership and
centroid validation, following the fingerprint-buffer investigation. This is not
a leak diagnosis or permission to change admission, GC, retries or ownership.

## Evidence and decision gate

Earlier full-cycle sampling attributed substantial temporary allocation to the
membership module. That label combines partition checks, normalization, centroid
summation and asynchronous control flow; it does not identify a single cause.

Use fixed synthetic vectors in isolated, network-disabled image containers.
Separate partition-only, normalization-only, full-map and streamed validation.
Build fixtures and reference means before sampling. Exercise parsed and cloned
inputs, preserve exact membership order, and assert outputs on every cycle.
Repeat natural and allocation-sampled runs in fresh processes; never equate
cumulative sampled bytes, retained heap and RSS. No production heap snapshots,
forced GC, provider calls or real appdata.

Only retain a small arithmetic refactor if a controlled probe supports it and
differential tests preserve validation, double precision, operation order,
centroid tolerance, zero-mean rejection, cancellation and batch limits. Test the
actual rebuilt image without overlaying runtime source. The complete catalog
rehearsal remains the integration check, not a controlled microbenchmark.

## Official research and tradeoffs

Sources discovered through web search and official-document navigation on
2026-10-07:

- [V8 elements kinds](https://v8.dev/blog/elements-kinds) explains specialized
  numeric array handling and warns that input history can affect optimization.
  This motivates measured comparisons, not a blanket loop or typed-array rewrite.
- [Chrome DevTools protocol definition](https://github.com/ChromeDevTools/devtools-protocol/blob/master/json/js_protocol.json)
  distinguishes sampled surviving objects from allocations including collected
  objects. Reuse the existing bounded, fixed-label inspector summarizer.
- [Node 24.21.0 Inspector](https://r2.nodejs.org/download/release/v24.21.0/docs/api/inspector.html)
  documents the in-process session used here, without a listening debug port.

| Option | Benefit | Cost / limitation |
| --- | --- | --- |
| Keep current code and add evidence | No semantic change | Allocation remains |
| Isolate synchronous numeric accumulation | Small, independently testable boundary | Runtime-specific benefit must be measured |
| Fuse normalization or use typed storage | Potentially fewer intermediates | Broader precision, validation and injected-normalizer contract risk |
| Reduce checks or force GC | None acceptable for this task | Weakens safety or changes production GC policy |

The first three fresh-process baseline repetitions measured roughly 262–319 MB
of sampled allocation across six normalization/full/streamed validation cycles,
versus 7–9 MB for partition checks. Moving only the addition loop did not help.
A synthetic prototype validates the raw vector, calculates the existing norm,
then adds each divided component directly to the private sum; its first sampled
run measured about 9 MB. This supports testing fusion, not blaming async loops.

Decision: extract a small ESM centroid accumulator for the default normalization
path. Keep validation before any sum mutation, use the existing norm routine and
division (not reciprocal multiplication), preserve accumulation order, and leave
custom injected normalizers on the existing path. Do not retain scratch vectors
or introduce global caches. Ordinary input vectors and dimensions must produce
bit-identical sums; exceptions still prevent publication. The accumulator's sum
is private, dense, correctly sized storage supplied by the caller, never a provider
payload or an alias of the input. No change to profile versions or stored data.

Preferred order: verify fused arithmetic; retain only demonstrated improvement;
then reassess remaining whole-cycle allocation. Do not combine this with
dependency or deployment redesign.

## Verification and delivery

Add differential and cancellation regressions, run scoped/full backend checks,
lint/typecheck, ownership/static-import/Markdown gates, then no-cache Compose
build. Dump and independently check the schema using disposable databases.
Pin the prior local image and verify a database archive before replacing local
Compose. Preserve all deployment settings and observe health afterwards.
Unraid stays untouched. Record results, exact source/image IDs, PR trial and
remaining uncertainty in a separate outcome document; no release or version bump.
