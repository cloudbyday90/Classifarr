# Community Applications Submission And Maintenance

## Current Ownership: Check Before Submitting

As checked on 2026-10-02, the [Classifarr catalog entry](https://ca.unraid.net/apps/classifarr-14a9cw815dlis4)
is supplied by grtgbln's Repository and links to
[nwithan8's template](https://raw.githubusercontent.com/nwithan8/unraid_templates/main/templates/classifarr.xml).
That GitHub repository identifies itself as a read-only mirror of
[the maintainer's Codeberg repository](https://codeberg.org/nwithan8/unraid_templates).

Our canonical source is `unraid/classifarr.xml`. Updating it does **not** update
the separate catalog source or an installed user's saved XML. Do not submit a
second Classifarr listing to bypass the maintainer. Prefer a coordinated patch
to the actual source; consider a CA-reviewed ownership transfer only if agreed.
Recheck the listing's Template link before acting because ownership can change.

The maintainer's GitHub README directs questions to Discussions; GitHub Issues
are disabled. The existing [Classifarr discussion #372](https://github.com/nwithan8/unraid_templates/discussions/372)
was open with no comments when checked. Prefer a focused reply there to agree
the update route before preparing changes against the Codeberg source. A saved
GitHub CLI login can access that discussion, but does not establish a Codeberg
or Unraid login. No reply has been posted by this work.

## Previous Submission And Lessons

The user's [Selfhosters PR #618](https://github.com/selfhosters/unRAID-CA-templates/pull/618)
was closed without merging on 2026-05-30. Earlier reviews requested cleaned XML,
no hardcoded restart/network arguments, and requirements in the appropriate
field rather than a repeated Overview section. A later review approved the
updated proposal, but approval did not result in a merge or catalog update.
Do not describe the whole history as a rejected or failed validation.

The current project XML has concise Overview/Requires fields, no embedded saved
Config values, no forced restart policy, and bridge networking in the Network
field. Its only ExtraParams option is the host-gateway mapping; this has a
separate regression test proving its position before the image. The current
catalog template has no host-gateway option, so a metadata-only upstream patch
need not add one. Discuss any functional additions separately.

The old PR targeted Selfhosters; today's catalog points to nwithan8's source.
Do not reopen the old PR or submit a duplicate to a different feed without
agreeing ownership. Carry forward its review lessons and the new test evidence,
not the old proposal wholesale.

## Preserve Installed Defaults

The external template currently differs from this repository:

| Setting | Listed external template | Project template default |
| --- | --- | --- |
| Host appdata directory | `/mnt/user/appdata/classifarr/data` | `/mnt/user/appdata/classifarr` |
| PUID / PGID | `1000 / 1000` | `99 / 100` |
| UMASK | `002` | `022` |
| Host-gateway option | Not present in the inspected XML | Extra Parameters |

These are observations, not migration instructions. Existing users must keep
their saved paths, identities and custom limits. Neither installation should
be pointed at the other's default directory as an upgrade shortcut.

## Repository Contract

The official [submission form](https://ca.unraid.net/submit/new) requires a
public, active repository, an OSI-approved license, valid Docker/plugin XML,
and a root `ca_profile.xml` with a nonempty Profile. This project retains its
existing GPL-3.0-or-later license; adding CA metadata does not relicense it.

For this single-container application, maintain one Docker template and keep
its canonical raw URL stable. The root profile describes the project and uses
real support/home/icon links. No placeholder account, invented forum thread or
new service is needed. See the official [repository XML guide](https://ca.unraid.net/submit/help/repository-xml)
and [profile requirements](https://ca.unraid.net/submit/help/repository-info-xml).

Keep the summary short and accurate: movies/TV, optional AI, embedded database,
and setup through the WebUI. Mark the current beta line honestly. Do not add a
second `latest` branch merely to label it stable. Keep deployment controls
explicit, but do not copy another application's privileged mode, devices,
startup scripts, memory limits or Docker socket access.

## Maintainer Workflow

1. Confirm catalog ownership and coordinate whether this is a patch to the
   existing source or an agreed transfer. Keep one listing identity.
2. Update the XML and documentation together; preserve existing saved-setting
   compatibility. Add or update regression tests for changed fields.
3. Run the local XML contract suite from `client/`:

   ```text
   node scripts/run-vitest.mjs run src/__tests__/unraidTemplate.test.js
   ```

   Also run client lint/type checks. For Docker command changes, test normal
   image startup, health and shutdown against isolated empty appdata. Never
   execute commands copied from surveyed templates or use live library data.
4. Commit and push the reviewed template to the agreed source. Local lint is
   not the portal scanner, and pushing XML is not an application release.
5. If a new repository/transfer submission is appropriate, open the official
   [submission flow](https://ca.unraid.net/submit/new), authenticate with Unraid,
   and enter the repository URL. Run **Validate**, then **Scan** after meaningful
   XML changes; review the parsed preview, links, requirements and duplicate
   findings. Correct failures before final confirmation.
6. Submit for review only with the maintainer's authorization. Retain the
   submission status and moderator notes. Do not claim acceptance from a local
   test or assume a GitHub CLI login is an Unraid account.
7. After an approved catalog change, verify the live Template link and perform
   the [saved-installation checklist](README.md#saved-installation-acceptance-checklist)
   on actual Unraid. An image pull does not prove saved settings were rewritten.

The official [builder guide](https://ca.unraid.net/submit/help/builders) describes
the validation/review sequence, and the [portal announcement](https://unraid.net/blog/new-community-apps)
explains duplicate detection. Existing legacy templates are comparison evidence,
not exemptions from current submission checks.

## Outstanding Handoff

The local metadata cleanup is ready for review, not a submitted catalog change.
The external template's mandatory-Ollama wording and stable label should be
reviewed with its maintainer. Preserve its existing appdata/identity defaults
when preparing that patch; do not replace the whole file with ours.

The proposed discussion reply should link the old PR and the source-bound test
outcome, request the preferred Codeberg patch or agreed ownership-transfer path,
and keep metadata corrections separate from optional media mounts or networking.
Wait for authorization to post, and record the resulting comment URL here.

No external submission, maintainer message, PR, ownership transfer or release
was performed in this work. The counted survey and measured local checks are
recorded in the [design](../docs/architecture/unraid-template-startup-design.md)
and [outcome](../docs/architecture/unraid-template-startup-outcome.md).
