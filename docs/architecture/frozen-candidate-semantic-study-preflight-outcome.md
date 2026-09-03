# Frozen Candidate Semantic Study Preflight Outcome

## Status

Implemented on the unreleased branch on 2026-09-02. No release or tag is
created by this change.

## Delivered

- Added modular ESM contract and service modules for a frozen,
  candidate-scoped semantic study preflight.
- Added a read-only local CLI that requires a complete external
  fixture/snapshot/manifest/reference-label/proposal bundle and emits only an
  aggregate report.
- Bound the exact study documents to a content-free proposal using stable
  SHA-256 addresses and an opaque server-generated proposal-cohort marker.
- Enforced fixed candidate retrieval, advisory model-output, and authorized
  time-bounded review scope identifiers plus a maximum 31-day study window.
- Kept every live authority false: no AI invocation, RAG query, database
  write, learning, policy mutation, retry, or media route is possible.

## Validation

- Unit coverage proves that a matching 24-case independently labelled bundle
  can reach `ready_for_human_study_review`, remains unable to route or change
  policy, and does not emit fixture text or the caller-supplied study
  identifier.
- Unit coverage rejects changed document bindings, expired study windows, and
  unknown content-bearing proposal fields.
- CLI coverage proves that a complete temporary bundle produces only
  aggregate output and that partial input fails without echoing a supplied
  path.
- Focused server tests and syntax checks passed. The complete server unit suite
  passed **1,034 files / 28,576 tests**; the integration suite passed **81
  files / 874 tests**, with one intentionally skipped suite. Root type-check,
  static ESM-import, Markdown-lint, and client production-build checks also
  passed.

## Security Outcome

This component narrows the study boundary rather than exposing more RAG data.
It introduces no endpoint, persistence, setting, live provider call, or index
query. The new proposal accepts only fixed identifiers, opaque fingerprints,
and timestamps, while the existing project-file loader enforces containment
and size limits. An external study owner still controls reviewer access and
deletes external study material; the preflight stores none of it and treats an
expiry as an admission failure.

## Pull-Request Check

GitHub's public pull-request page reported zero open pull requests for
`cloudbyday90/Classifarr` during this work. No random open PR was available to
implement locally, and no closed or merged change was substituted.

## Next Item

Run a real access-controlled, independently reviewed 24–32 case bundle using
the existing readiness command and then this preflight. If it reaches the
human-study state, the next engineering item is an access-scoped study
workbench that can create and delete a candidate-inventory snapshot without
retaining it in normal Classifarr operations. It must still remain offline and
outside routing.
