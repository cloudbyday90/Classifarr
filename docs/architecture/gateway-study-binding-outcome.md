# Gateway study input binding outcome

## Implementation subject

Implementation is in progress. Exact committed source/image identities and native
results will be recorded after verification; this document is not a passed receipt.
See the separate [design](gateway-study-binding-design.md) for scope and research.

The common five-mode runner now stages committed bytes, records separate fixture
and image identities, pins the expected manifest digest in its inspected command,
and checks every input before importing executable fixtures. Test code and its
manifest are read-only in every workload; generated observations use `/results`.
Row-mode application parity and all existing native safety assertions remain.

No production application files, schemas, schedules, retry budgets or provider
settings changed. No release, Unraid operation or shared Ollama call is authorized.

## Verification status

Focused tooling checks initially passed 59 tests with one Windows symlink-creation
skip. Native Linux staging additionally checks that the no-follow reader refuses
a symlink; actual Docker and all five mode results remain pending here.

## Limitations and next item

These are trusted-host local integrity checks, not signatures or published-image
attestations. The fixture list is intentionally fixed and covered by relative
import-closure tests. The common CLI still defaults to equal image/fixture source;
the neutral helper supports explicitly separate revisions and tests that contract.
Existing mixed-image upgrade callers remain unchanged, rather than being forced
through a same-revision restriction.

Default archive/catalog/retention, qualification/cleanup and scheduling/rotation
families remain deferred and unbound. Next: extend the verified pattern to those
three staging mechanisms without changing recovery authority or receipt schemas.
