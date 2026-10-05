# Restricted restore HTTP outcome

Date: 2026-10-05. See [design and sources](selected-restore-http-design.md).

Implemented modular ESM source-file preparation, one-use stream client/broker,
restricted HTTP launcher and entrypoint. The existing authenticated restore UI
contract delegates to a narrow service rather than importing the privileged
backup service. The worker revalidates input and retains existing SQL exclusion
and durable quarantine. Existing encryption/API keys are not regenerated.

## Validation

- Backend unit run: 1,694 suites, 52,521 passed, one Linux-only filesystem case
  skipped on Windows. The Linux image separately passed copy/fsync, unchanged
  source and no-overwrite assertions. These are not a claim that Windows ran it.
- Final focused restore/import-graph/inventory tests: 80/80 passed, including
  the corrected invalid-input message. Invalid preparation does not consume the
  capability or require a restart; a submitted attempt does.
- Backend lint/type checks, copyright, ownership review, dependency analysis,
  ESM guards and 30 tooling checks passed. Markdown: 1,906 files, zero errors.
  Scoped secret scan found no leaks. No client endpoint or UI contract changed.
- Initial no-cache image source: `2e62d0e876880ae3d3ae5dbe6681967a46560b7f`;
  inspected local Docker ID
  `sha256:eccf9474addde24cd52bca12423b42e459efeba11aa421b1f468c4ab0d27a605`.
  All 12 top-level isolated checks passed, including the new restricted HTTP
  restore subcase, in 162.372 seconds. Standard, custom and Unraid-shaped saved
  identity profiles passed real shutdown/restart checks. Exact project cleanup
  passed; no installation volumes were used or deleted.
- Real HTTP denied unauthenticated/CSRF requests and symlink/wrong-password
  previews before worker launch. Killing HTTP during a locked restore joined the
  worker, left quarantine and no verification receipt, and preserved the original
  keys. New login plus explicit retry verified restoration; another request in
  that process was refused. This tests process death, not every browser/network
  failure or malicious same-UID filesystem race.
- `dump-schema` ran on isolated PostgreSQL 18 from the candidate image after the
  build. Fresh load and dump round trip had zero drift; no migration or tracked
  schema change was needed.

Final no-cache rebuild and local replacement after the wording correction are
pending. No release, live restore, template update or production selection is
performed. The existing unknown ingestion-owner warning is not resolved here.

The recovery skill required bounded work, no replay after uncertainty and an
actual isolated HTTP/database test. The release-evidence skill separates that
same-image fixture from a published upgrade or sustained resource soak.

Random open [PR 556](node-types-pr-556-outcome.md) was applied and tested locally;
its Node 26 declarations failed the Node 24 baseline and were removed. No merge.

Next: integrate normal/restore selection into the production dispatcher without
losing saved deployment settings, then rehearse published-old-image upgrades.
Database-enforced ingestion fencing remains necessary before unattended legacy
ownership recovery can be claimed safe.
