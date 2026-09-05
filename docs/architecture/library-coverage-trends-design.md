# Per-library coverage trends design

## Decision

Extend the automatic [acquisition history](observation-acquisition-history-design.md)
with per-library coverage and explicit comparison boundaries. The platform should
show which libraries gained attributable metadata without requiring manual runs,
labels or per-item setup. Counts describe synchronized inventory rows, including
duplicate placements; they do not measure classification accuracy.

## Population and comparison contract

The existing single PostgreSQL snapshot supplies both coverage counts and a
SHA-256 population fingerprint per library. The ordered input contains each
inventory row ID, raw media type and typed TMDb identity, including missing IDs.
Membership, type and identity changes therefore invalidate comparisons even when
row counts remain equal. Metadata changes and library renames do not change the
population. Source titles are neither part of this population definition nor
stored in history. Fingerprints are private comparison aids, not anonymization,
authentication, or proof that source identities are correct.

Compare only consecutive UTC hour slots with valid detail, equal population
fingerprints and unchanged acquisition-configuration presence. Show signed
captured, fresh, keyword and language row deltas. Selection changes are reported
separately: changing another library does not invalidate this library's population.
An inventory-change marker remains visible even if a missing hour also prevents
comparison. First samples, newly selected libraries, missing/invalid old detail,
capacity limits, configuration changes and gaps cannot produce invented deltas.

Count consecutive comparable intervals with unchanged captured, keyword and
language counts. Freshness expiry does not reset this count. This is a description
of unchanged measured coverage, not an outage diagnosis or a claim that work is
stalled: valid empty provider responses can leave traits unknown. There is no
interpolation, estimated completion date, causal attribution or routing authority.

## Bounded storage and services

Add nullable versioned JSON detail to each existing hourly sample. A database
constraint permits at most 12 library entries and 16 KiB per frame; 168 fixed slots
bound logical payload storage to 2.625 MiB before database overhead. Detail and
aggregate counts share the existing atomic first-sample/upsert statement. Reads
retain the same seven-day window. Old slots are overwritten on reuse; physical
deletion at seven days is not promised. Old samples stay unknown, without backfill.

Changing the population definition or the meaning of coverage counts requires a
new detail version; do not reinterpret stored `v1` frames across such a change.

Small ESM modules separate complete-frame validation and trend projection from
the existing sampler and read service. Validation checks IDs, unique selection,
fingerprint format, count nesting and agreement with aggregate totals before any
comparison. API projection allowlists per-library counts and strips fingerprints
and unexpected stored fields. No dependency, provider call or new endpoint is
required. The existing authenticated, rate-limited, parameterless GET remains
read-only with `no-store` and generic errors.

The client reuses the existing named API function and current library names from
the Libraries store. Names are display labels, not historical names. Native
details, table captions, row/column headers and labelled keyboard-scrollable
regions present denominators and comparison reasons without relying on color.

## Official research and August 2026 scope

These URLs were discovered through web search and read on 5 September 2026.
The established W3C and PostgreSQL 18 guidance predates the August cutoff; living
OWASP guidance was checked currently, without claiming an archived August text.

- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) recommends
  recording quality, provenance and versions. Applied here, the denominator,
  population definition and sample time travel with each measurement.
- [PostgreSQL aggregate functions](https://www.postgresql.org/docs/18/functions-aggregate.html)
  documents order-sensitive aggregates. Put ordering inside the aggregate so
  population fingerprints do not depend on execution order.
- [PostgreSQL binary functions](https://www.postgresql.org/docs/18/functions-binarystring.html)
  provides SHA-256 and byte encoding without adding a hashing extension.
- [W3C accessible tables](https://www.w3.org/WAI/tutorials/tables/) explains
  captions and header associations. Keep comparisons readable as semantic tables.
- [OWASP REST security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  supports endpoint access control, restricted input, generic errors and
  `no-store` for sensitive responses. Preserve these existing protections.

## Alternatives and recommendation stack

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Bounded per-library frames with private fingerprints | Automatic; atomic; catches equal-count population changes | Seven-day horizon; 12-library/20,000-row limit | Implement |
| Compare percentages and row counts alone | Smallest payload | Replacements can masquerade as metadata progress | Reject |
| Per-item historical ledger | Exact change attribution | Larger sensitive retention and operational complexity | Defer |
| Full time-series platform and alerts | Longer history and dashboards | Extra infrastructure; premature failure thresholds | Defer |

Recommended stack: synchronized inventory → attributable observations → automatic
profiles and bounded health → population-aware coverage trends → bounded library
comparisons → independently evaluated, review-only semantic evidence. Keep the
existing readiness and frozen-study gates. Controlled fixtures and source
placements cannot substitute for independent human labels.
