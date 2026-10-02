# Unraid Template And Community Applications Review Outcome

Date: 2026-10-02. No application release, catalog submission or live deployment.

## Result

The project template's Docker option was in the wrong field. The old command
reproduced an exit-127 startup failure; the corrected command reached healthy
status and stopped cleanly in a disposable no-cache image test.

The expanded review found a stale second XML and missing submission profile.
The project now has one canonical template, root profile, concise movie/TV
wording, optional-AI requirements and accurate beta metadata. The prior
`templates/classifarr.xml` copy was removed; its TemplateURL already pointed at
the retained `unraid/classifarr.xml`. The old copy remains in Git history.

Crucially, the current public CA listing uses a separate maintainer's XML,
which did not contain the bad PostArgs flag. These changes do not rewrite that
listing or users' saved settings. See the separate
[design and tradeoffs](unraid-template-startup-design.md) and
[submission workflow](../../unraid/SUBMISSION.md).

## Counted September Template Survey

All XML files at the following repository commits were parsed locally as XML,
without executing their contents or fetching their referenced assets. Commit
selection used a `2026-09-30T23:59:59Z` cutoff. Five sparse Git snapshots were
read-only inputs; no provider's template text was copied into this project.

| Maintainer source | Pinned revision | XML files | Valid Docker templates |
| --- | --- | ---: | ---: |
| [LinuxServer](https://github.com/linuxserver/templates) | `b4058a4d5eb38cf8b97c69d19314567b16ee8788` | 243 | 242 |
| [Selfhosters](https://github.com/selfhosters/unRAID-CA-templates) | `f85de5c602582112fcf248165df6468819870020` | 136 | 134 |
| [hotio](https://github.com/hotio/unraid-templates) | `c81150b472fdbd5747693a6d90e913418732fdeb` | 28 | 27 |
| [IBRACORP](https://github.com/ibracorp/unraid-templates) | `d80a5d8498f70ae067e5a8e854ab05d7996d51a2` | 56 | 55 |
| [binhex, archived](https://github.com/binhex/docker-templates) | `8047ff1e74d8f708323bad8cd2271e87dc43d53e` | 67 | 66 |
| Total | | 530 | 524 |

The remaining files were five repository profiles and one strict XML parse
failure (`selfhosters/templates/SeerrDiscordBot.xml`). Of the 524 templates,
66 came from the archived binhex repository and 51 were in deprecated paths;
407 were outside both groups. The sample includes multiple templates for
similar products and is not a random or complete catalog census. It measures
source structure, not current catalog acceptance, safety or runtime operation.

| Observation among 524 valid templates | Count | Interpretation |
| --- | ---: | --- |
| Container version 2 | 522 | Use the established v2 format |
| Nonempty overview | 521 | Describe the purpose; median overview was 33 words |
| Nonempty support link | 518 | Give users a real help destination |
| HTTPS icon | 508 | Retain the existing project-owned HTTPS icon |
| Explicit nonempty Shell | 452 | Select a shell actually present in the image |
| Raw GitHub TemplateURL | 392 | Keep a canonical raw URL; historical omissions are not guidance |
| Nonempty ExtraParams | 219 | Docker options belong before the image |
| Nonempty PostArgs | 9 | Application commands/arguments are uncommon and intentional |
| Privileged set true | 13 | Other apps' requirements do not justify privilege here |

The nine nonempty PostArgs entries were also inspected individually; none
started with the surveyed Docker-only option names (`add-host`, `privileged`,
`network`, `memory`, `cpus`, `restart`). This is a bounded pattern observation,
not proof that every template is safe. Common practice did not override the
official field definitions or our application requirements.

Generated input/analysis intermediates remain under `.tmp/`. The per-file
survey manifest hash was
`475961f04c6994cc7dc6888e98434c19f1b6710d1877c023e379a0b38b5fc726`.
The source revisions and inclusion rules above identify the counted corpus.

## Official Guidelines And Catalog Ownership

The [current submission form](https://ca.unraid.net/submit/new) and
[profile requirements](https://ca.unraid.net/submit/help/repository-info-xml)
were read alongside the public [field reference](https://ca.unraid.net/submit/help/xml-field-reference).
They require an active public repository, suitable repository license, valid
XML and a root profile. Validate/Scan, duplicate review and moderator acceptance
are distinct from local regression tests. These live pages were reviewed in
October; they are not claimed to be archived September documentation.

The [live Classifarr entry](https://ca.unraid.net/apps/classifarr-14a9cw815dlis4)
links to the external nwithan8 template. Its saved-default appdata path and
user/group IDs differ from ours. Its source describes Ollama as required and
the latest channel as stable, although the newest published Classifarr release
checked here is the `v0.48.4-beta` prerelease from August 29. Coordinate those
metadata corrections with the maintainer, preserving that template's existing
paths and identities; do not silently swap defaults or submit a duplicate.

The user's earlier [Selfhosters PR #618](https://github.com/selfhosters/unRAID-CA-templates/pull/618)
received XML/field cleanup requests and later approval, then was closed without
merging on May 30. The current maintainer has an existing open
[Classifarr discussion #372](https://github.com/nwithan8/unraid_templates/discussions/372)
and directs questions there; GitHub Issues are disabled. The submission guide
records that history and the correct handoff route. No new thread or comment
was posted during the initial review. After subsequent user authorization,
the [metadata-only update request](https://github.com/nwithan8/unraid_templates/discussions/372#discussioncomment-18721433)
was posted and read back on 2026-10-02. It includes a concrete diff against
the maintainer's template, validated against their XSD, with all deployment
settings preserved. Upstream application and catalog acceptance remain pending;
see the submission guide for the source revision and remaining steps.

## Local Startup Evidence

Final clean tested source: `173d577294b333c761f64b55e0dbf45a39773cb1`.
No-cache image:
`sha256:341d7c034b310e28a48df35facbf94e4dfdf7ff8f0856b3c120ac069b9c30e50`.
Completed at `2026-10-02T19:50:19.832Z`.

The initial startup-only source `cd5b0dbe2059013d590f0eaf490707cab2aaf807`
also passed a separate no-cache run at `2026-10-02T19:31:13.382Z`, using image
`sha256:555fb421c65b939a5b60ee1ebe366ad03bdd65c28c9fc86d2b08d441eb8647d6`.
The final run rebuilt and repeated both cases after the expanded metadata
changes; the earlier receipt was not relabeled as evidence for a later source.

The actual old and corrected XML fields determined the tested argument order.
Both disposable containers used the same image with empty anonymous appdata,
network disabled, no published ports, and 2-CPU / 2-GiB / 128-PID test limits.
Those limits were test controls, not new template requirements.

| Check | Old XML | Corrected XML |
| --- | --- | --- |
| Default startup command | Replaced by host-mapping flag | Preserved |
| Host mapping applied | No | Yes, IPv4 and IPv6 entries |
| Startup | Exit 127 | Application and Docker health passed |
| Application identity | Never started | UID 99 / GID 100 |
| Ordered stop | Not applicable | Exit 0, no OOM kill |

An initial diagnostic run incorrectly expected exactly one hosts-file entry.
Docker Desktop returned both IPv4 and IPv6 aliases. The check was corrected to
accept the valid address-family alternatives; no application guard was weakened.
The successful rerun rebuilt without cache and repeated both cases.

Both owned containers, their disposable data volumes and the candidate tag
were removed. Synthetic data is regenerable; real appdata was untouched. The
live Classifarr container retained its original ID and start time and stayed
healthy. This is a local Docker command/startup test, not actual Unraid operator
acceptance or a replacement for the frozen release soak.

## Validation And Remaining Work

The initial startup commit passed 416 client suites / 5,905 tests, client
lint/type checks and Markdown lint. Its exact-source
[CI/CD run 37053967570](https://github.com/cloudbyday90/Classifarr/actions/runs/37053967570)
passed, including database and installation acceptance. CodeQL, Gitleaks, OSV,
Trivy, copyright and resource-capacity workflows also passed.

Expanded metadata validation passed nine XML contract checks and the full
416-suite / 5,909-test client suite. Client lint/type checks, Markdown lint and
`git diff --check` passed. The final-source no-cache run independently confirmed
the actual XML startup contract after all template changes.

For final template source `173d577294b333c761f64b55e0dbf45a39773cb1`,
[CI/CD run 37056358617](https://github.com/cloudbyday90/Classifarr/actions/runs/37056358617)
passed its Build and Test, Tests with Database, and Fresh Install and Published
Upgrade jobs. CodeQL, Gitleaks, OSV, Trivy, copyright and resource-capacity
workflows also passed for that source. These checks are not CA moderator
approval or actual Unraid host acceptance.

GitHub MCP search and the saved GitHub CLI login returned no open Classifarr
PRs. No random PR could be selected, and no closed or unrelated PR was
substituted. No PR was merged.

Recommendation stack:

1. Maintain the single canonical XML and CI contract tests. This prevents local
   drift with little complexity, but cannot update a separate maintainer's feed.
2. Coordinate a focused metadata patch with the current CA maintainer; prefer
   preserving the existing listing over a second submission. This needs external
   review, but avoids duplicate identities and accidental data-path changes.
3. Complete actual saved-Unraid acceptance and define the supported upgrade
   floor before release. Docker Desktop checks remain useful but insufficient
   evidence for that host-specific claim.
