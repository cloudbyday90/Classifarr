# Published routing and promotion evidence

Read this for registry verification, architecture matrices or release-pipeline
changes. It adds no permission to push an image, tag, release or deployment.

## Trace identity

Use `publishedRoutingSubject.mjs` and `publishedRoutingReceipt.mjs`, not a new
ad-hoc parser. Bind the source commit and verified CI attestation to the parent
index; hash raw index/child bytes; select one native platform; inspect the
directly pulled child. Classic Docker's config ID and containerd's manifest ID
are distinct supported representations. Neither a tag, a revision label nor an
unselected parent ID proves the tested child. Do not rebuild the candidate.

## Trace the gate

Check producer, same-run artifact download, expected identity and release
assembler. Require both AMD64 and ARM64 receipts, current run and attempt,
freshness, exact routing counts, zero attempted provider writes and cleanup.
Historical v1/v2 release records remain readable, but new publication needs v3.
Wrong platform, duplicate architecture or failure swallowed by shell/YAML must
block. Never inject GitHub context to manufacture CI evidence from a local run.

Inspect alias ordering separately. As of this implementation, `docker-release`
publishes `latest` before consumer checks. Say "blocks GitHub publication",
not "prevents users receiving a failed candidate". Recheck the actual workflow
before carrying this observation forward; promotion is the next planned change.

## Exercise the guidance

Before handoff, check these cases against the actual validators:

- Same source label, wrong child digest: reject before any rehearsal.
- AMD64 receipt supplied twice: reject even if both say passed.
- Old run/attempt or stale receipt: rerun; never edit timestamps.
- Cleanup failure or one attempted provider write: block publication.
- Local rehearsal passed, native ARM not run: report the missing evidence.
- User asks for status only: inspect and report; do not publish or deploy.

Use the existing script/workflow mutation tests and separate outcome document.
Skill metadata validation is not a substitute for exercising these boundaries.
