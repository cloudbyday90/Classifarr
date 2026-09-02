# Independent Reference Study Bundle CLI Outcome

## Status

Implemented on the unreleased branch on 2026-09-02. No release or tag is
created by this change.

## Delivered

- Made the semantic counter-evidence readiness command capable of evaluating a
  complete real-world, redacted study bundle rather than only the checked-in
  eight-case baseline.
- Required external fixture, snapshot, manifest, and independent label files
  together. A partial external bundle is rejected before evaluation, preventing
  mixed provenance.
- Extracted reusable, modular ESM file-boundary and study-input modules, plus
  a small in-memory study-composition service.
- Enforced project-relative JSON paths, realpath containment, regular files,
  a 128 KiB input limit, strict existing schemas, and existing SHA-256 binding.
- Corrected the aggregate evaluation authority label to
  `validated_fixed_input_read_only`; it remains offline-only with every
  automatic action disabled.
- Preserved the checked-in baseline command and its optional bound-label test
  behavior. No real library data, fixtures, labels, or embeddings were added
  to version control.

## Validation

- Focused tests cover baseline compatibility, checkout containment, external
  junction escape rejection, bounded input size, a partial-bundle rejection,
  and a temporary 24-case complete bundle. The latter can reach
  `ready_for_human_review` while its output omits case text and routing remains
  disabled.
- Server lint and TypeScript type checking passed after the modular refactor.
- The focused semantic reference-set, snapshot, and readiness suites passed.
- Root lint, client/server type checks, Markdown lint, static ESM import
  checks, and ESM test mock-shape checks passed.
- A rebuilt local Docker Compose service became healthy; `/health` returned
  HTTP 200 with a connected database.

## Security Outcome

The input boundary is narrowed rather than widened: no new HTTP route or
persistence exists, no raw study document is emitted, and a real case set
cannot be paired accidentally with a checked-in semantic snapshot. The
remaining reviewer-independence claim is intentionally outside the system: a
protocol ID and consensus counts cannot prove that reviewers were blinded.

The final source-backed local diff security review completed with no reportable
findings. It reviewed canonical project containment, external-bundle selection,
aggregate-only output, false automatic-action flags, and the focused regression
coverage. The review intentionally excludes the content of any future operator
study and treats reviewer blinding as an external operational control.

## Open Pull-Request Check

The official public GitHub pull-request page reported zero open pull requests
on 2026-09-02. Therefore no random open PR was available to implement locally;
no closed or merged PR was substituted.

## Next Item

Run an actual access-controlled, double-blind 24–32 case study through this
new command. If its aggregate outcome reaches human-review readiness, the next
engineering item is a frozen candidate-scoped RAG/index/model study proposal
with explicit deletion, access, and drift controls—not a direct routing change.
