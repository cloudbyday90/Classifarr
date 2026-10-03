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

Inspect every alias writer. `docker-release` publishes version tags only;
`promote-published-latest` calls the same workflow used for manual retries after
consumer checks and immutable GitHub publication. Require current-schema asset
validation plus release/asset/CI attestation verification, not a passed flag.
Read `releasePromotionAuthority.mjs` and `releaseImagePromotion.mjs` before
running their CLI. It defaults to read-only; `--write` requires user authority.

Both registry graphs must pass before either alias changes. Copy the original
index by digest, including attestation children; never rebuild it. Check all
workflow writers share the concurrency group. Serialization is not ordering:
the verified current source must be an ancestor of the candidate. A missing or
unverifiable alias is a stop, not permission to guess a baseline or force it.

Read the actual environment policy: this repository admits `v*` tags, so manual
dispatch must select the exact approved release tag and matching `source_tag`.
Do not weaken that policy to make a branch dispatch work. Historical v1/v2
records do not authorize promotion through the new path.

Cross-registry updates are not atomic. Inspect each registry's bounded status
after failure, retain `write_started` as an uncertain outcome, and retry the
same verified digest only with approval. Never silently roll back the registry
that succeeded. A canceled pending job is not a successful promotion.

## Exercise the guidance

Before handoff, check these cases against the actual validators:

- Same source label, wrong child digest: reject before any rehearsal.
- AMD64 receipt supplied twice: reject even if both say passed.
- Old run/attempt or stale receipt: rerun; never edit timestamps.
- Cleanup failure or one attempted provider write: block publication.
- Local rehearsal passed, native ARM not run: report the missing evidence.
- Newer source already at latest: reject an older delayed promotion.
- Second registry fails: report partial progress; never claim atomic success.
- Manual retry on main: reject; select the approved release tag instead.
- User asks for status only: inspect and report; do not publish or deploy.

Use the existing script/workflow mutation tests and separate outcome document.
Skill metadata validation is not a substitute for exercising these boundaries.
