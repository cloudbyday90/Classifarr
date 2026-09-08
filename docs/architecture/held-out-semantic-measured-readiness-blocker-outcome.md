# Measured held-out study readiness blocker outcome

Status: implemented, unreleased. See the separate
[design](held-out-semantic-measured-readiness-blocker-design.md) for
architecture, research, alternatives, and the recommendation stack.

## Delivered

- Added an ESM measured-blocker service that derives one fixed prerequisite
  from source readiness and a fingerprint-current aggregate audit receipt.
- Extracted the v6 eligibility-audit identifiers into a small ESM contract so
  the readiness path does not depend on audit orchestration.
- Advanced the closed administrator readiness projection and browser
  validator to v3, including a concise current-condition display.
- Kept the route administrator-only, rate-limited, parameter-free, and
  no-store. It remains aggregate-only and exposes no identities,
  configuration, provider data, raw receipt, scores, or rules.
- Added tests for a current exact declared-purpose blocker, stale-receipt
  rejection, source-prerequisite deferral, service-state loading, and browser
  rejection of contradictory authority or extra fields.

## Measured context

The private v6 audit previously completed over 6,641 canonical candidates and
found zero ready policy-only comparisons. Every candidate stopped at
`no_qualifying_policy_evaluations`; the source screen reported that all
observed purpose rules were inferred profile evidence. No cohort was captured,
no labels were collected, and no semantic selection, provider call, policy
change, or routing ran.

The v3 readiness contract does not reinterpret profile evidence as a declared
purpose. It gives future automation a bounded way to recognize a current
measured prerequisite when a lifecycle-managed audit receipt is available.
If source evidence changes, the old receipt is deliberately ignored until the
passive re-audit stores a matching complete receipt.

## Verification

Focused backend tests cover the new ESM contract, readiness builder, readiness
service, and audit contract extraction. Focused frontend tests validate the
v3 closed projection. The full backend unit suite passed and the client build
completed.

A no-cache local Compose rebuild completed on 8 September 2026; the recreated
service reached its configured health endpoint. The private read-only v6 audit
again completed over 6,641 canonical candidates with zero ready policy-only
comparisons and 6,641 `no_qualifying_policy_evaluations` receipts. Its source
screen again found ten active policies, zero retained declared-purpose rules,
and fifteen excluded inferred-profile observations. No cohort, labels,
semantic selection, provider call, policy change, or routing ran.

## Next item

The remaining platform event is a separately governed declared-purpose
revision. It cannot be manufactured from a profile, configuration, or library
observation. After that durable source event, the existing passive re-audit
will refresh automatically. Only a receipt that supports a balanced 24–32-case
policy-only cohort can proceed to independent labels, readiness, and
frozen-study preflight.
