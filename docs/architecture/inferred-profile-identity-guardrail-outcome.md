# Inferred Profile Identity Guardrail Outcome

## Local Compose evidence

The latest local `Deep Water` classification retained its decision evidence.
It reported a `62.13` policy score for `Comedy and Standup`, an AI abstention,
and no usable cross-library identity match. The persisted score drivers were:

- native intent: `80`;
- observed library profile: `30.02`;
- RAG, history, pattern, and preset contributions: `0`.

The active policy's inferred profile purpose rule was:

```text
genres require_any: Comedy, Documentary, TV Movie, Biography, Drama
source: media_server_library_profile
inference state: inferred
semantics: identity
```

`Deep Water` matched `Documentary` and `Drama`. That is the direct cause of
the false Comedy proposal. It is neither a missing AI request nor evidence that
the item belongs in the library.

## Implemented outcome

The specialized identity stage now removes matching broad genre terms from an
inferred media-server profile rule before it determines whether the candidate
has a unique identity anchor. The remaining policy score may still be useful
as compatibility context, but it is calibrated as weak evidence and cannot
trigger the confirmation route solely on that basis.

The regression test uses the exact genre-rule shape and metadata family from
the local Compose incident. It asserts that the candidate becomes
`insufficient_specialized_evidence` rather than a specialized identity match.

## Operator impact

No local configuration was changed automatically. The existing `Comedy and
Standup Policy` is still too broad and should be maintained after this code is
deployed: remove generic inferred genres from its identity purpose or replace
them with operator-declared, specific evidence such as stand-up/special
keywords, relevant studios, and explicit exclusion rules.

## Recommended stack

1. **Ship this guardrail** — prevents profile-only broad genre matches from
   becoming routing identity.
2. **Add a policy-maintenance indicator** — expose the offending inferred
   rules, source, and safe remediation in Settings.
3. **Evaluate semantic retrieval offline** — only consider RAG/AI as an
   advisory corroborator after measuring precision against confirmed outcomes.

The first item reduces immediate false positives with the smallest behavioral
change. The second makes existing configuration understandable. The third can
improve recall, but is not a substitute for a deterministic policy boundary.
