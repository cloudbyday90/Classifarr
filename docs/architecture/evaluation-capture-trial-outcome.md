# Local capture trial and provider preflight outcome

Date: 2026-10-09. See the separate [design](evaluation-capture-trial-design.md).

## Finding

The five-call trial stopped at preflight, before budget activation or generation.
At 19:41 UTC, local inventory had 10 completed imports and 10 completed backfill
handoffs. Policy replay reported five missing description vectors. Independently,
the configured local provider returned HTTP 200 but listed `gemma4:e4b` twice:
both entries were local and had syntactically valid, **different** model digests.
Repeated inspection at 19:43 UTC confirmed this. The existing client requires
exactly one matching entry and correctly rejected the ambiguous identity.

This explains why this local configuration cannot start the planned AI capture;
it is not evidence that Unraid has the same model listing. No Unraid access, model
download, provider configuration edit, budget activation, reservation reset or
memory-safeguard change was made. Capture/replay success is not claimed.

## Implemented

Added `--source-pair-ai-provider-status` to the existing private evaluation CLI,
backed by a small ESM diagnostic service. It reads configuration in a read-only
transaction, ends that transaction before HTTP and inspects provider metadata only.
The normal status command still performs no provider requests. Conflicting CLI
modes are rejected before execution. The report excludes endpoints, model names,
digests and raw provider/database errors.

The existing generation client now distinguishes duplicate, missing, remote and
invalid identities. Duplicate rejection remains strict even for identical digests;
no identity rule was relaxed. Unknown failures direct the operator to open a
sanitized GitHub issue. A successful metadata report explicitly does not authorize
capture or claim that policy/inventory/resource checks passed.

## Verification

- Focused backend unit/real HTTP checks: 4 suites, 92 tests passed. Duplicate
  names, including distinct model digests, stop before `/api/show`, generation or
  quota reservation. Fixed diagnoses, cancellation, privacy and CLI separation
  are covered.
- Random open [PR 555](node-types-pr-555-outcome.md): exact local trial rejected
  by the existing runtime-major contract (8/8 → 7/8 → 8/8). No merge or install.
- Tooling policy: 40/40 passed through the supported npm entry point.
- Isolated PostgreSQL: 3 suites, 36 tests passed, covering the actual read-only
  transaction plus existing quota/capture/replay contracts. Quota and cache rows
  remain unchanged by the diagnostic.
- Lint, backend/frontend typechecks, Markdown, copyright and ESM gates passed.
  No dependencies were installed or changed; fresh registry metadata matched the
  rejected PR's package integrity and transitive declaration version.
- Rebuilt-image checks will be recorded below. Full application coverage is not
  claimed for this scoped diagnostic change.

## Recommendation

First make the configured provider expose one unambiguous installed local model,
then rerun the metadata check and verify current vector/policy readiness. Only
then repeat the approved five-call trial and disable its recurring budget after
observation. Keep ambiguous identities blocked: choosing the first entry would
make cached-response provenance unreliable. A provider configuration decision is
needed; this change does not make that choice for the operator.

The recovery skill kept admission and model verification unchanged while adding
specific diagnostics. The dependency skill kept the rejected PR isolated.
