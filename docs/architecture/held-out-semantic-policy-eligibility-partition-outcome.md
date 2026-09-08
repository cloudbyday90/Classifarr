# Held-out semantic policy eligibility partition outcome

Status: implemented, unreleased. See the separate
[design](held-out-semantic-policy-eligibility-partition-design.md) for the
architecture, research, alternatives, and recommendation stack.

## Delivered

- Added a pure ESM source-disposition classifier and moved the profile-rule
  predicate into its own narrow ESM module. The v3 policy source screen now
  reports a fixed partition of absent, profile-only, and retained declared
  purpose; the counts sum to the active-policy count.
- Added a pure ESM comparison-eligibility partition. Every completed
  policy-only assessment contributes to one of five fixed aggregate outcomes,
  including an explicit `invalid_contract` failure class.
- Advanced the private eligibility-audit receipt to v6 and validate that the
  comparison partition covers the candidate population and agrees with the
  stratum-level ready total.
- Made the passive lifecycle re-audit refresh an old receipt version only when
  its existing qualified source is still present. A source with no complete
  current purpose evidence remains deferred and performs no candidate scan.
- Added focused unit tests for the source partition, comparison partition,
  audit integration, version refresh behavior, and no-data exposure.

## Operational outcome

The next private receipt can state the blocked condition directly. For
example, a profile-only source partition together with a comparison partition
whose entire population is `not_pending_policy_decision` means no retained
policy-only purpose was available to form a comparison. It does not mean the
source inventory is invalid, that semantic retrieval failed, or that a
threshold should be changed.

The partitions remain descriptive. A zero-ready result leaves cohort capture,
independent labels, readiness, frozen-study preflight, semantic selection,
policy change, and routing disabled.

## Verification

Focused tests, the full backend unit suite, static ESM import validation,
server lint and type checking, documentation lint, a no-cache Compose rebuild,
and a read-only local audit are recorded with this change. The audit output is
kept only in ignored local temporary storage and contains aggregate counts.

## Next item

Keep the process passive until a separately governed native-purpose revision
creates retained current evidence. The lifecycle gate can then refresh the
private audit without operator selection. Only a real balanced 24–32-case
cohort with independent labels may enter readiness and frozen-study preflight;
a later qualifying semantic counter-evidence feature may refer ambiguous cases
to review only.
