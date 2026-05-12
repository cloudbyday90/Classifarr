# Issue 275 Settings Key Manifest (V1)

Canonical source for Issue 275 settings contract:
- code: `server/src/utils/ragLoopConfig.mjs`
- API route wiring: `server/src/routes/settings.mjs` (`GET/PUT /api/settings/ai`)

## Contract Rules
- Request key maps 1:1 to `ai_provider_config` column.
- Unknown keys in Issue 275 namespaces are rejected (`400`).
- V1.1 override keys are rejected in V1 scope (`400`).
- Invalid enum/range/type values are normalized to safe deterministic values.
- Partial updates preserve unrelated fields and masked secrets.

## Keys
- `rag_retrieval_loop_enabled`: boolean, default `false`
- `rag_loop_rollout_mode`: enum `shadow|apply`, default `shadow`
- `rag_loop_low_confidence_threshold`: int `0..100`, default `70`
- `rag_loop_max_passes`: int `1..2`, default `2`
- `rag_loop_use_hybrid_on_retry`: boolean, default `true`
- `rag_loop_conflict_detection_enabled`: boolean, default `false`
- `rag_retry_strategy`: enum `auto|hybrid|semantic`, default `auto`
- `rag_retry_low_signal_similarity_floor`: number `0..1`, default `0.55`
- `rag_retry_conflict_semantic_preferred`: boolean, default `true`
- `rag_retry_sparse_metadata_prefers_hybrid`: boolean, default `true`
- `rag_loop_candidate_limit`: int `1..100`, default `25`
- `rag_conflict_top_n`: int `1..50`, default `5`
- `rag_conflict_min_matches`: int `1..50`, default `3`
- `rag_conflict_min_votes_per_library`: int `1..10`, default `2`
- `rag_conflict_max_vote_gap`: int `0..10`, default `1`
- `rag_conflict_max_similarity_margin_ratio`: number `0..1`, default `0.10`
- `rag_conflict_min_avg_similarity`: number `0..1`, default `0.55`
- `policy_recheck_below_prompt_threshold_enabled`: boolean, default `false`
- `policy_recheck_max_attempts`: int `0..5`, default `1`
- `policy_recheck_identifier_caps`: JSON `{keywords,genres,studios,cast}` each int `0..25`, default `{8,5,3,3}`
- `policy_recheck_min_similarity_delta`: number `0..1`, default `0.08`
- `policy_recheck_min_margin_delta`: number `0..100`, default `10`
- `policy_recheck_min_confidence_gain`: number `0..100`, default `5`
- `policy_recheck_max_ai_calls_per_item`: int `1..5`, default `2`
- `policy_recheck_metadata_enrichment_enabled`: boolean, default `true`
- `policy_recheck_metadata_missing_fields_min`: int `0..10`, default `2`
- `policy_recheck_metadata_timeout_ms`: int `100..30000`, default `2000`
- `policy_recheck_metadata_max_attempts`: int `0..5`, default `1`
- `policy_recheck_metadata_source`: enum `authoritative_only`, default `authoritative_only`
- `rag_loop_shadow_min_samples`: int `1..1000000`, default `200`
- `rag_loop_shadow_max_error_rate_delta`: number `0..1`, default `0.01`
- `rag_loop_shadow_max_p95_latency_delta_ms`: int `0..600000`, default `250`
- `rag_loop_trace_enabled`: boolean, default `true`
- `rag_loop_trace_max_events`: int `1..200`, default `20`
- `rag_loop_trace_max_bytes`: int `256..131072`, default `16384`
- `rag_loop_trace_include_stage_metrics`: boolean, default `true`
- `policy_learning_second_pass_requires_manual_confirmation`: boolean, default `true`
- `policy_learning_include_shadow_feedback`: boolean, default `false`
- `policy_learning_allow_machine_only_second_pass_feedback`: boolean, default `false`
- `rag_alias_expansion_enabled`: boolean, default `true`
- `rag_alias_max_terms`: int `1..20`, default `5`
- `rag_alias_min_token_length`: int `1..10`, default `3`
- `rag_alias_source_policy`: enum `authoritative_only`, default `authoritative_only`
- `rag_title_precedence_mode`: enum `canonical_first`, default `canonical_first`
- `rag_alias_weight`: number `0..1`, default `0.60`
- `rag_loop_resilience_enabled`: boolean, default `true`
- `rag_loop_resilience_window_ms`: int `1000..3600000`, default `300000`
- `rag_loop_resilience_min_samples`: int `1..10000`, default `20`
- `rag_loop_resilience_timeout_streak_threshold`: int `1..20`, default `3`
- `rag_loop_resilience_timeout_rate_threshold`: number `0..1`, default `0.35`
- `rag_loop_resilience_error_rate_threshold`: number `0..1`, default `0.50`
- `rag_loop_cooldown_tmdb_ms`: int `0..86400000`, default `900000`
- `rag_loop_cooldown_rag_ms`: int `0..86400000`, default `600000`
- `rag_loop_cooldown_ai_ms`: int `0..86400000`, default `900000`
- `rag_loop_half_open_probe_count`: int `1..20`, default `2`
- `rag_loop_global_bypass_multi_open_enabled`: boolean, default `true`
- `rag_loop_global_bypass_ms`: int `0..86400000`, default `600000`

## V1.1 Keys Explicitly Rejected in V1
- `rag_loop_override`
- `policy_rag_loop_override`
- `library_policy_rag_loop_override`
- `library_policies.rag_loop_override`
