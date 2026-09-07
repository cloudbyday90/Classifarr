# QEMU action update design

Date: 2026-09-07. Status: selected for local adoption.

## Selection and scope

One random draw from the five open PRs (526–530) selected
[PR #526](https://github.com/cloudbyday90/Classifarr/pull/526). Its head was
`fa6dfe3ce58eadb343a445b1d3a0bc5ae38a8736`. Adopt its single workflow change locally:
update `docker/setup-qemu-action` from the pinned v4.2.0 commit to the pinned v4.3.0
commit, `1f40c72289eff860ee54a304f1438e3cff362e0a`. Do not merge the original PR
through GitHub. Integrate the tested local work with the lifecycle feature.

The GitHub MCP confirmed the official upstream v4.3.0 tag resolves directly to
that commit. The [official release](https://github.com/docker/setup-qemu-action/releases/tag/v4.3.0)
was published September 1, 2026. It is a current open-PR dependency update, **not**
evidence of what was available in August. Its release notes describe maintenance
updates to the Docker actions toolkit and supporting dependencies.

## Recommendation and tradeoffs

| Option | Benefit | Cost or limitation |
| --- | --- | --- |
| Adopt the verified full SHA | Reproducible action revision with current dependency maintenance | Requires future reviewed pin updates; newer than the research cutoff |
| Retain v4.2.0 | Avoids a dependency change | Leaves the selected maintenance update unapplied |
| Use a floating major tag | Fewer manual pin edits | Upstream changes can silently alter the executed action |

Recommend the full SHA, keeping Dependabot and the existing tag-only release job.
[GitHub's secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use)
recommends full commit pinning and verifying the commit belongs to the upstream
repository. This established guidance was available by August; the living page
was read on September 7 through web search.

The [pinned action metadata](https://github.com/docker/setup-qemu-action/blob/1f40c72289eff860ee54a304f1438e3cff362e0a/action.yml)
uses Node 24. Its upstream packaged runner is CommonJS; no upstream runner code is
vendored or converted in this repository. Application and test changes remain ESM.
The action's default binfmt image is still a floating `latest` image. Pinning the
action does not freeze that image or prove the whole release supply chain secure.
An independently maintained binfmt digest pin is a possible subsequent hardening
task, with an explicit automated update strategy to avoid stale emulators.

## Validation boundary

Run local actionlint against the changed workflow, verify the exact diff and
upstream tag identity, and exercise ARM64 execution through local Docker/Buildx.
Build and start the application in a disposable container for the feature.
Do not invoke the tag-triggered publishing job, push images, create a tag or cut
a release. Local emulation does not exercise GitHub's action cache or runner
bootstrap; record this boundary in the separate outcome document.
