# Unraid Template Startup Design

## Decision

Move the host-gateway Docker option from `PostArgs` to `ExtraParams` in the
shipped Unraid XML. Keep `PostArgs` empty so the image's startup command runs.
Test the actual XML, not only the existing Compose profile with Unraid-style
user IDs. No new service, dependency, Docker socket access or release is needed.

This is the next concrete release-readiness fix. It does not certify a real
Unraid installation or change the supported upgrade floor.

## Expanded Community Applications Review

The user requested a survey of hundreds of CA templates and the submission
guidelines. The September-pinned survey covers 530 XML files from five public
maintainer repositories: 524 valid Docker templates, five profiles and one XML
parse failure. These are template files, not 524 unique apps or a random sample
of the entire catalog. The outcome records revisions, counts and limitations.

Official submission rules take precedence over popularity. Older repositories
contain missing metadata, deprecated templates and archived sources; copying
their omissions would not satisfy the current submission process.

The review found a second stale copy at `templates/classifarr.xml`. Consolidate
on `unraid/classifarr.xml`, the canonical URL already recorded inside both
copies. Remove the duplicate source file, not a service or installed user
template. Git retains its history. Document the path change for direct-file
consumers; do not silently rewrite existing appdata or identities.

Add the required root `ca_profile.xml`, explicit shell/license metadata, a
concise movie/TV overview, accurate optional-AI requirements, and a beta marker
matching the current release line. Remove the redundant latest/stable branch
description. Retain existing image, mounts, port and user/group defaults.
Extend the XML tests to cover submission metadata and single-source ownership.

The currently listed CA entry is maintained separately by grtgbln/nwithan8,
using `nwithan8/unraid_templates`, whose GitHub repository describes itself as
a read-only Codeberg mirror. Its XML does not contain our bad PostArgs field.
Therefore this fix is not evidence that the current catalog entry was broken,
and pushing this repository does not update that listing. Coordinate a change
with its maintainer, or a reviewed ownership transfer with CA, before submitting
a duplicate. No submission, external PR or ownership transfer is authorized or
performed by this local template update.

| Follow-up option | Benefit | Cost or risk | Recommendation |
| --- | --- | --- | --- |
| Coordinate changes with the existing listing maintainer | Preserves catalog identity and existing users' settings | Requires external review | First choice |
| Reviewed transfer to this repository | Keeps app and template maintenance together | Requires CA/maintainer coordination and saved-settings acceptance | Alternative if agreed |
| Submit a second listing immediately | No handoff work | Duplicate identity, divergent defaults and user confusion | Do not do this |

Keep CI XML checks and isolated Docker startup checks together. Portal Validate
and Scan and an actual Unraid operator pass remain separate acceptance steps;
local checks cannot stand in for either.

## Root Cause And Boundary

### Media access follow-up

The initial upstream request was too narrow: the user also wanted the media
mounts from the earlier proposal. Keep the existing appdata mount and add
optional `/data/media`, `/data/movies` and `/data/tv` fields with blank host
paths. File moves need writable mounts; API-only routing does not. Add the
host-gateway alias only in ExtraParams. Do not force restart or network mode.

The Unraid Compose base remains usable without media access. A separate
`docker-compose.unraid.media.yml` overlay adds `/data/media` only when selected
and requires an explicit host folder. `create_host_path: false` prevents a
misspelled path from silently creating an empty directory. This adds one
opt-in file, but avoids a new startup requirement for existing deployments.
The [Docker Compose volume reference](https://docs.docker.com/reference/compose-file/services/#volumes)
documents the bind-mount option. Saved installations still require an operator
to select their paths; an image update cannot create these host mounts.

### Startup command

Unraid constructs its Docker command with `ExtraParams` before the image and
`PostArgs` after it. Docker treats arguments after the image as a replacement
for `CMD`. Classifarr uses `tini` as `ENTRYPOINT` and its startup script as `CMD`.
The old template therefore asks `tini` to execute the host-mapping flag instead
of starting Classifarr, and does not configure the intended host alias.

The existing Unraid-style Compose fixture exercises IDs 99/100 and saved
configuration. It does not consume `unraid/classifarr.xml`; its passing result
could not detect this defect. Both checks are useful, but they prove different
contracts.

An image-contained maintenance worker cannot repair a host-side Docker command
that prevents the application from starting. Do not work around this by
ignoring arbitrary commands, mounting the Docker socket, changing host settings
or enabling privileged mode.

## Implementation And Saved Installations

- Put `--add-host=host.docker.internal:host-gateway` in `ExtraParams` only.
- Preserve the repository, port, appdata mapping, PUID/PGID and optional paths.
- Add ESM regression tests using the client's existing XML DOM test environment.
  Parse the real file and check the startup/security/mount contract. No XML
  parser is added to the runtime.
- Reproduce the old and corrected Docker argument ordering in isolated local
  containers. Use an explicit local image ID, no real appdata or external
  integrations, bounded resources and cleanup of only owned test containers.
- Explain the one-time saved-template correction in the Unraid guide. An image
  update must not be presented as automatically rewriting saved XML.
- Replace blanket recursive ownership changes and appdata deletion instructions
  with reviewed, recoverable backup/restore guidance. Do not assume every
  historical appdata layout has the same numeric ownership.

If the saved template contains the bad flag, the operator moves only that flag
from Post Arguments to Extra Parameters in Advanced View, preserves other
settings, and applies the change. An already-correct template needs no edit.
An unfamiliar application command or other custom argument requires review,
not an instruction to clear all fields.

## Options And Tradeoffs

| Option | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Correct XML plus saved-template instructions | Fixes Docker command construction without changing runtime behavior | Affected saved templates need a one-time operator edit | Implement |
| Make the image ignore command arguments | Could conceal this symptom | Breaks intentional command overrides; cannot create the host alias | Reject |
| Give the app host Docker access to rewrite itself | Could change host configuration | Excessive authority; app still cannot run before startup is fixed | Reject |
| Require a new Compose/template configuration for all users | Uniform deployment definition | Disrupts working saved installations unnecessarily | Reject |

## Acceptance And Next Steps

1. Regression tests fail against the old XML and pass after the move.
2. Disposable Docker checks show the old override failing and the corrected
   mapping preserving normal startup, health and shutdown.
3. Tests, lint and documentation checks pass without version changes.
4. Separately accept an actual saved Unraid installation: preserve settings,
   validate startup and import/metadata recovery, then verify clear waiting and
   failure states. Optional AI jobs do not hold recovery open; unknown writers
   must not be silently taken over.
5. Define and test the supported upgrade floor before freezing a release.

The separate [outcome](unraid-template-startup-outcome.md) records measured
results and remaining limits. No live installation is changed by this test.

## Official Research

Reviewed on 2026-10-02 for the requested September 2026 baseline. Sampled
repositories and Unraid command construction are pinned to commits no later
than September 30. The official portal documents are live pages, not archived
September snapshots; no new October-only runtime feature is required.

- [Unraid's September command construction](https://github.com/unraid/webgui/blob/ebd05afeb31878dca76d22c198b236d27cfec163/emhttp/plugins/dynamix.docker.manager/include/Helpers.php)
  establishes the placement of the two template fields.
- [Docker container command semantics](https://docs.docker.com/engine/containers/run/)
  explains command replacement and how it interacts with an entrypoint.
- [Docker run options](https://docs.docker.com/reference/cli/docker/container/run/)
  documents the host-gateway mapping as a Docker option.
- [Community Applications](https://docs.unraid.net/community-applications/)
  documents saved user templates and the application update workflow.
- [Unraid share guidance](https://docs.unraid.net/unraid-os/using-unraid-to/manage-storage/shares/)
  cautions against changing permissions on default shares without need.
- [W3C error identification guidance](https://www.w3.org/WAI/WCAG22/Understanding/error-identification)
  informs the explicit symptom, affected field and corrective action in the
  operator guide. This documentation change makes no UI conformance claim.
- [Official submission flow](https://ca.unraid.net/submit/new),
  [repository profile requirements](https://ca.unraid.net/submit/help/repository-info-xml)
  and [XML field reference](https://ca.unraid.net/submit/help/xml-field-reference)
  define the current metadata contract. See the separate
  [submission and maintenance guide](../../unraid/SUBMISSION.md).
- [Official portal announcement](https://unraid.net/blog/new-community-apps)
  describes pre-submission scanning and duplicate detection.
- [Current Classifarr listing](https://ca.unraid.net/apps/classifarr-14a9cw815dlis4)
  identifies the catalog maintainer and links to its independent template.
