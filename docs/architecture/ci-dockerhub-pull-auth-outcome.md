# Docker Hub CI pull authentication outcome

Date: 2026-10-09. [Design and tradeoffs](ci-dockerhub-pull-auth-design.md).

## Setup

The maintainer selected a dedicated read-only token. Before implementation,
GitHub listed only `DOCKERHUB_USERNAME` and the publishing `DOCKERHUB_TOKEN`;
secret values were not retrieved. The pull credential still needs provisioning.

1. In Docker Account settings, open Personal access tokens and create
   `Classifarr CI pulls`. Prefer **Repo Public Read-only** for these public images
   (or **Read-only** if that is the available UI label), with a 90-day expiry.
   Use the same Docker account as `DOCKERHUB_USERNAME`; do not change the existing
   username or publishing token for this setup.
2. In the Classifarr GitHub repository, open Settings → Secrets and variables →
   Actions, and add repository secret `DOCKERHUB_PULL_TOKEN`. Transfer the token
   directly there, never through chat, source files, shell arguments or logs.
3. Record its expiry privately and rotate before expiration. Update the same
   secret, verify a trusted-main run, then revoke the superseded pull token.
4. Verify all four login steps and their image-consuming steps on the exact
   new commit. Login success alone does not prove the tests or receipts passed.

An empty credential produces the login action's credentials-required error in
the step named `Authenticate Docker Hub pulls (requires DOCKERHUB_PULL_TOKEN)`.
For invalid/expired credentials, check Docker token status and username ownership.
An authenticated rate-limit error still requires quota/pull-volume investigation.
Do not retry with publishing credentials or add secrets to PR jobs.

## Implementation and validation

Added guarded login steps in the existing CI and resource workflows, with
explicit logout and no permission expansion. A small ESM contract module extends
the existing runtime workflow validator; mutation tests cover the four consumers.
The existing installation/receipt acceptance checks remain in place.

The clean starting checkout was `d003a891` on `main`. Local verification passed:

- Nine targeted workflow, installation-receipt and resource-recovery suites:
  **305 tests**. Mutations reject missing/duplicate/late login, PR and tag access,
  removal of repository/ref restrictions, publishing-token fallback, credential
  outputs/environment, mutable actions, disabled logout and masked failures.
- The extended runtime-installation workflow validator CLI.
- ESLint for all five changed ESM files, backend typecheck, and both Knip modes.
- Markdown validation: 2,040 documents, no errors; copyright and diff checks.

The release-evidence skill kept the existing receipt rejection and publication
gates intact and kept local tests separate from hosted authentication evidence.
The action's pinned source was also inspected: it supplies the password through
stdin and rejects an empty password before attempting login.

Hosted authentication remains **blocked on secret provisioning**. No successful
authenticated pull is claimed until the secret is installed and CI uses it.
The four image-consuming jobs are deliberately not allowed an anonymous or
publishing-token fallback on trusted main. Tag-triggered tests and PR tests keep
their pre-existing credential behavior and remain a follow-up quota concern.

No application code, schema, Compose deployment, Unraid service, shared provider,
release or published image is changed by this setup. A local image rebuild was
not repeated for a CI-credential-only change; it could not verify hosted secrets.

Next: provision the dedicated secret, then inspect the login, actual pulls,
integration results and cleanup for this exact commit. Investigate any remaining
installation/resource failure from its own error evidence rather than assuming
all previous failures shared the confirmed database pull-limit cause.
