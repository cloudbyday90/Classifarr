# Frozen inventory replay — design

Status: Unreleased design, 24 September 2026. No release or routing change.

## Problem and decision

The preceding v2 release pair executes policy and profile scoring, but passes
no inventory-neighbor evidence. That means a changed destination or safety
block cannot be attributed to the current inventory comparison. The next
bounded gate freezes the **exact candidate-pool retrieval request** made by
the current deterministic evaluator for each held-out correction. It is not a
full classifier evaluation. The published baseline predates this inventory
path, so it legitimately ignores v3 evidence; both workers still see the same
label-free input and the report says `baselineSupported: false`.

The existing read-only, repeatable-read correction cohort and grouped
description holdout remain the source. The capture runs the current policy
evaluation with a fold-local retriever wrapper. If inventory is requested, it
records one sorted library-ID pool and the bounded response returned by the
existing fold-local retriever. If it is not requested, it records
`not_requested`, not invented empty evidence. A second request fails the
capture. The source fingerprint and embedding representation are rechecked
before the private input is returned. Retrieval has no network or provider
call; embedding representation inspection may require the configured local
service and fails closed when unavailable.

## Boundary and report semantics

The v3 contract extends v2 with `inventory` per case. The parent retains
correction labels and source identities; worker projections remove labels.
Allowed response fields are library ID, eligibility/indexing flags,
fold-snapshot digest, relative fit, training-description count and at most
three bounded description/similarity/share observations per candidate. No
file paths, provider payloads, correction narratives, credentials or
membership IDs enter the worker. The total input is capped at 8 MB.
Unknown fields, duplicate or unsorted pools, out-of-range values and
candidate/contract mismatches are rejected. Descriptions are private data:
the capture writes only under ignored `.tmp/` with owner-only file mode, and
the report emits aggregate status counts, not descriptions or titles.

The candidate worker reruns its installed scoring and pure ranking/decision
projections. Its inventory retriever returns only the frozen response for an
exact media-type and candidate-pool match. Mismatch is reported even though
the production inventory service safely falls back to baseline scores. The
archived scorer does not consume inventory. The pair reports how many cases
were frozen and how many were used, unavailable, unrequested, failed or
contract-mismatched. `complete` means the requested replay contract matched;
it does **not** mean that upstream evidence was available, that the
correction labels were independently verified, or that routing accuracy was
measured. AI adjudication, semantic RAG search, authoritative signals,
pattern/history, routing and learning remain outside this gate.

Both roles run as non-root, read-only, no-network containers with no live
database credentials or writable host mount. The candidate uses pure
ranking/decision projections to avoid the live ranker's overlap-metrics
persistence. The archived baseline's legacy ranker can attempt its existing
persistence path, but the disposable container has neither network access nor
database credentials; the next release-schema adapter should remove that
attempt without changing the historical decision algorithm.

The runner records SHA-256 digests of the published and candidate server
lockfiles and whether they are identical. It continues to report
`dependencyProvenanceVerified: false`: comparing lockfiles does not prove
which packages were installed in the shared local image, and these lockfiles
currently differ. A future gate must install/attest the published lockfile
separately before claiming released-dependency equivalence.

## Options and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Keep v2 policy-only replay | Fast, less private text | Misses inventory-induced differences; retain for compatibility. |
| Requery live libraries in each worker | Closer to current service state | Snapshot drift, credentials and possible writes undermine pairing; reject. |
| Freeze fold-local retrieval at capture time | Exact bounded candidate request, offline replay, explicit coverage | Captures private descriptions and only current release supports inventory; selected. |
| Build separately attested release dependencies and pure release adapter | Stronger historical fidelity | More build isolation and compatibility work; next gate. |

Recommended stack: screened correction snapshot → grouped description holdout
→ fold-local policy/profile and exact inventory capture → strict label-blind
v3 worker contract → isolated published/current scorers → aggregate coverage
and errors → human review. No replay result changes routing or learning.

## Official sources checked in September 2026

- [W3C PROV-O](https://www.w3.org/TR/prov-o/) separates source entities,
  activities and derivation; source/sample/fold/lockfile digests are limited
  provenance anchors, not full PROV compliance.
- [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented test sets, conditions and limitations. The report
  therefore keeps full-pipeline accuracy and promotion unavailable.
- [npm `ci`](https://docs.npmjs.com/cli/commands/npm-ci/) describes frozen
  lockfile installs; digest comparison alone is not such an install.
- [Docker build attestations](https://docs.docker.com/build/metadata/attestations/)
  distinguish image contents from build provenance. The local shared image
  ID is recorded but is not a published-dependency attestation.
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) would govern any future UI
  presentation of these diagnostics. This increment changes no UI.
