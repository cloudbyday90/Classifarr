/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const VECTOR_PROBLEMS = {
  shape: 'The vector was missing, empty, or outside the supported size limit.',
  dimensions: 'The vector length did not match the declared embedding dimensions.',
  nonfinite: 'The vector contained missing or non-finite numeric values.',
  float32: 'A vector value could not be represented safely as float32.',
  zero: 'The vector contained no nonzero values, so similarity cannot be calculated.',
};
const ISSUES = Object.freeze({
  ...Object.fromEntries(['query', 'profile'].flatMap(source => Object.entries(VECTOR_PROBLEMS).map(([cause, problem]) =>
    [`${source}_${cause}`, { source, problem }]))),
  profile_structure: { source: 'profile', problem: 'The profile starts, selected view, groups or support counts were malformed.' },
  profile_header: { source: 'profile', problem: 'The cached or fitted model did not match the supported profile contract.' },
  query_contract: { source: 'query', problem: 'The query identity, description fingerprint or configuration binding was invalid.' },
  query_representation: { source: 'query', problem: 'The query did not identify a valid embedding provider, model and dimensions.' },
  decision_identity: { source: 'decision', problem: 'The item identity changed between embedding and the final decision.' },
  decision_description: { source: 'decision', problem: 'The description changed or was unavailable after embedding.' },
  decision_contract: { source: 'decision', problem: 'The final decision was not eligible for this comparison.' },
  decision_scope: { source: 'decision', problem: 'The decision did not preserve a complete, compatible candidate scope.' },
  clock_invalid: { source: 'runtime', problem: 'A valid observation time was unavailable.' },
  unknown_check: { source: 'runtime', problem: 'An unexpected validation failure prevented the comparison; its payload was not logged.' },
});
const REMINDER_MS = 1_800_000;
export function representativeValidationIssue(error) {
  try {
    const code = error?.representativeIssue;
    return typeof code === 'string' && Object.hasOwn(ISSUES, code) ? code : 'unknown_check';
  } catch { return 'unknown_check'; }
}

/** Fixed vocabulary and bounded process-local deduplication. Never receives or retains payloads. */
export function createRepresentativeValidationDiagnostics({ log, now = Date.now } = {}) {
  const active = new Map();
  const emit = (level, message, data) => {
    try { Promise.resolve(log?.[level]?.(message, data)).catch(() => {}); } // swallow-error: Do not recurse into logging or interrupt classification/recovery.
    catch { /* Diagnostics cannot interrupt classification or recovery. */ }
  };
  return {
    report(input) {
      const code = typeof input === 'string' && Object.hasOwn(ISSUES, input) ? input : 'unknown_check', issue = ISSUES[code];
      let time;
      try { time = now(); } catch { time = NaN; }
      const entry = active.get(code) ?? { count: 0, reportedAt: null };
      entry.count = Math.min(1_000_000, entry.count + 1); active.set(code, entry);
      if (!Number.isFinite(time) || (entry.reportedAt !== null && time - entry.reportedAt < REMINDER_MS)) return;
      entry.reportedAt = time;
      const profile = issue.source === 'profile';
      emit('warn', 'Library comparison data failed validation', { code, ...issue, occurrences: entry.count,
        recovery: profile ? 'Discard the invalid private profile cache and rebuild on the scheduled retry with backoff.'
          : 'Exclude this observation. Future eligible classifications can supply fresh valid data; this rejected query is not replayed.',
        steps: profile ? 'No action is normally needed. If this repeats after rebuilding, inspect the embedding provider and refresh logs; do not edit vectors manually.'
          : code === 'query_contract' ? 'Check metadata refresh logs for invalid item identity or changed description/configuration. Keep the original identity; do not invent a replacement to bypass validation.'
            : issue.source === 'query' ? 'Check the configured embedding model and provider health. It must return one nonzero finite vector of the declared dimensions. Do not pad or truncate the response.'
              : code === 'clock_invalid' ? 'Check the server clock and runtime health. Invalid observation times are excluded rather than retained indefinitely.'
                : issue.source === 'decision' ? 'Check metadata refresh and classification logs for a changed identity, description or candidate contract. Do not force the rejected comparison into routing.'
                  : 'Check the Classifarr version and preceding operational logs. Report this fixed failure code without attaching raw metadata, vectors or credentials.',
        routingAffected: false });
    },
    profilesRecovered() {
      for (const [code, entry] of active) if (ISSUES[code].source === 'profile') {
        active.delete(code);
        emit('info', 'Library comparison profile validation recovered', { code, occurrences: entry.count,
          recovery: 'Valid profiles were published after source and representation revalidation. Pending observations can resume within their existing lifetime.',
          routingAffected: false });
      }
    },
  };
}
