# Vector validation allocation

Reviewed 2026-10-07. Follow-up to the
[cached-vector attribution outcome](comparison-vector-read-attribution-outcome.md).

## Problem and contract

The same decoder allocates substantially more temporary memory after the shared
validator has seen structured-cloned arrays. Reproduce this on pinned Node
24.21.0 before choosing a small loop change. This is not yet evidence that every
memory-pressure warning has the same cause or that retained objects are leaking.

Preserve array-only input, 1–16,000 dimensions, exact optional dimensions, own
indexed properties, finite numbers, nonzero vectors and float32 overflow/underflow
rejection. Return the original array without coercion, rounding or mutation.
Preserve fixed errors and the order of indexed reads and own-property checks,
including getter/proxy side effects. Do not replace the loop with iteration that
skips holes, snapshots length, or invokes a caller-provided iterator.

Compare the unchanged loop with a small scalar-check helper and a numeric-local
variant in disposable, network-disabled containers. A numeric local may map
non-numbers to an invalid NaN sentinel without invoking conversion hooks; this
must not move rejection ahead of the existing own-property check. Reject a
candidate that changes observable input behavior or fails to reduce allocation.
Keep any experiment separate from production code until selected.

No new job, database write, HTTP request, configuration, cooldown or retry exists.
Success returns the same vector; malformed data remains a non-retryable validation
error. Cancellation, restart, ownership, independent freshness reads, admission,
worker limits and publication fences remain with their existing callers. No full
vector cache, forced GC, remote inspector or memory-threshold change is allowed.

## Alternatives and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Small semantics-preserving loop change | Targets the reproduced temporary allocation | Needs differential and real-cycle evidence; preferred if proven |
| Separate scalar validation helper | Clear numeric boundary | May inline or retain the same boxing cost; measure first |
| Check ownership before reading the value | Might avoid a live boxed value across a call | Changes getter/proxy ordering; reject for this compatibility fix |
| Skip validation, change vector storage, or retain decoded maps | Could reduce repeated work | Weaker integrity or larger compatibility/retention surface; reject here |

First test malformed and adversarial inputs against the prior implementation.
Then compare fresh and clone-conditioned decoding, including fingerprinting.
Finally require a sampled full catalog cycle and an allocation-disabled natural
cycle on the actual no-cache image. Compare equal warm-read cardinalities, not
different build counts or whole-container peaks as if they were matched trials.

## Research

Official sources discovered through search and opened on 2026-10-07:

- [V8 element kinds](https://v8.dev/blog/elements-kinds): mixed array representations can affect optimized operations; engine advice motivates measurement, not a guarantee about this runtime.
- [V8 property representations](https://v8.dev/blog/fast-properties): pure double arrays can use unboxed storage. Our specific allocation mechanism must still be measured.
- [V8 field and element documentation](https://chromium.googlesource.com/v8/v8.git/%2B/refs/heads/main/docs/objects/fields-and-elements.md): distinguishes numeric and tagged element storage; do not inspect or depend on internal element-kind names in application code.

- [ECMAScript 2026 own-property operations](https://tc39.es/ecma262/2026/multipage/fundamental-objects.html): own-property checks are distinct from inherited lookup; getter/proxy ordering can be observable.
- [ECMAScript 2026 numeric operations](https://tc39.es/ecma262/2026/multipage/numbers-and-dates.html): Number.isFinite does not coerce, while Math.fround uses binary32 round-to-nearest/ties-to-even. Keep both contracts.
- [Definitely Typed version policy](https://github.com/Definitelytyped/DefinitelyTyped): declaration major/minor versions track the target library, supporting the Node-major PR gate below.

No UI change or new web-accessibility claim. Keep probes bounded and publish only
numeric summaries; no vector payloads, credentials or raw heap profiles.

## Random PR trial and verification

Fresh enumeration found open PRs #555 and #556. Random selection chose server
[#556](https://github.com/cloudbyday90/Classifarr/pull/556), immutable head
`9d74537d7917c248d15926f37b2e40ceba7559a4`. Trial the exact manifest/lockfile update
from Node declarations 24.19.1 to 26.6.4 and undici-types 7.24.6 to 8.9.0 locally.
Keep the deployed Node-major policy: reject/revert before installation if it
fails. Do not merge, upgrade the runtime, or claim an installed-candidate audit.

Run focused and full backend tests, relevant PostgreSQL integration, lint/types,
dependency/ownership/import gates, and Markdown checks. Commit source on main;
pin its image revision, back up local appdata, build Compose without cache, then
dump/check schema using isolated containers. Evaluate only the local test Compose
deployment. Unraid and Harmoniarr are untouched. Record results, limitations and
the next bounded change in a separate outcome document; no release this round.

## Experiment decision before implementation

Small loop/helper/property-key/range-check variants retained or worsened the
clone-conditioned spike. Native iteration/at variants reduced that spike but
regressed the fresh parsed-array control and changed observable access behavior.
None qualifies for production. Do not ship an optimizer hint, extra retained key
cache, weaker checks or an unproven numerical rewrite merely to produce a fix.

Instead, promote the existing ignored reproduction to a small, explicit ESM
diagnostic with a separate fixture and measurement module, reusing the existing
heap sampler and the actual decoder/fingerprint functions. It has no database or
provider imports. Require a dedicated Linux process, explicit synthetic opt-in
and the existing 2 GiB cgroup budget. Two histories, three rounds, two operations,
5,776 vectors/round, 1,024 dimensions, 256-row batches and 512 conditioning calls
are fixed; reject caller-supplied size/mode overrides. Emit one bounded numeric
receipt only after count, checksum and fingerprint equivalence checks pass.
Use a monotonic 60-second cooperative deadline checked between batches/windows;
run the CLI under a 120-second external process deadline for a hung inspector.

Add semantic regression coverage before further optimization, particularly holes,
inherited entries, signed zero, boundary rounding, conversion hooks, proxy/getter
order, mutable length and exact return identity. Tests assert correctness, not a
statistical byte threshold. No profiler runs at application startup or in request
handling. An allocation-disabled full catalog cycle remains the image smoke;
there is no production optimization to compare or claim this round.

### Run the diagnostic

Use a no-cache-built image ID, not a live `docker exec` session or appdata mount.
This is a repeated 256-row microfixture (5,776 total rows per window), not a full
catalog. Allocation estimates include collected objects; they are not retained
heap sizes. A zero sampled category is not proof of zero actual allocation.

```powershell
$imageId = (docker image inspect classifarr:comparison-concurrent-study --format '{{.Id}}').Trim()
docker run --rm --pull never --network none --read-only --tmpfs /tmp --user 1000:1000 --memory 2g --cpus 2 --pids-limit 128 --cap-drop ALL --security-opt no-new-privileges -e CLASSIFARR_SYNTHETIC_MEMORY_STUDY=1 --entrypoint timeout $imageId -k 5 120 node src/scripts/comparisonMemoryStudy/runVectorValidation.mjs
```

Exit 0 emits a versioned JSON receipt; exit 1 emits a fixed failure classification.
Timeouts are failures, not measurements. No input files, database connection or
credentials are required. Do not run with `--expose-gc` or alter production flags.
