# Unraid Template Startup Design

## Decision

Move the host-gateway Docker option from `PostArgs` to `ExtraParams` in the
shipped Unraid XML. Keep `PostArgs` empty so the image's startup command runs.
Test the actual XML, not only the existing Compose profile with Unraid-style
user IDs. No new service, dependency, Docker socket access or release is needed.

This is the next concrete release-readiness fix. It does not certify a real
Unraid installation or change the supported upgrade floor.

## Root Cause And Boundary

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

Reviewed on 2026-10-02 for the requested September 2026 baseline. These are live
official documents and pinned upstream implementation evidence, not archived
September snapshots; no new October-only feature is required by this fix.

- [Unraid's command construction](https://github.com/unraid/webgui/blob/e331ba36c538a683aa72801d2e1a661c88c98ee3/emhttp/plugins/dynamix.docker.manager/include/Helpers.php)
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
