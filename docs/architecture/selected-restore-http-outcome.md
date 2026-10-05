# Restricted restore HTTP outcome

Date: 2026-10-05. See [design and sources](selected-restore-http-design.md).

Implemented modular ESM source-file preparation, one-use stream client/broker,
restricted HTTP launcher and entrypoint. The existing authenticated restore UI
contract delegates to a narrow service rather than importing the privileged
backup service. The worker revalidates input and retains existing SQL exclusion
and durable quarantine. Existing encryption/API keys are not regenerated.

Validation is in progress. Record exact checks and image identity here before
handoff. No release, live restore, template update or production selection is
performed. The existing unknown ingestion-owner warning is not resolved by this
restore component.

The recovery skill required bounded work, no replay after uncertainty and an
actual isolated HTTP/database test. The release-evidence skill separates that
same-image fixture from a published upgrade or sustained resource soak.

Random open [PR 556](node-types-pr-556-outcome.md) was applied and tested locally;
its Node 26 declarations failed the Node 24 baseline and were removed. No merge.

Next: integrate normal/restore selection into the production dispatcher without
losing saved deployment settings, then rehearse published-old-image upgrades.
Database-enforced ingestion fencing remains necessary before unattended legacy
ownership recovery can be claimed safe.
