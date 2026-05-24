export const LANGUAGE_LABELS = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
  ar: 'Arabic',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  hi: 'Hindi',
  ta: 'Tamil',
  te: 'Telugu',
  kn: 'Kannada',
  ml: 'Malayalam',
  mr: 'Marathi',
  bn: 'Bengali',
  pa: 'Punjabi',
  ur: 'Urdu',
  th: 'Thai',
  vi: 'Vietnamese',
  id: 'Indonesian',
  ms: 'Malay',
  nl: 'Dutch',
  pl: 'Polish',
  sv: 'Swedish',
  da: 'Danish',
  no: 'Norwegian',
  nb: 'Norwegian',
  fi: 'Finnish',
  cs: 'Czech',
  hu: 'Hungarian',
  ro: 'Romanian',
  el: 'Greek',
  tr: 'Turkish',
  uk: 'Ukrainian',
  bg: 'Bulgarian',
  hr: 'Croatian',
  sk: 'Slovak',
  ca: 'Catalan',
  he: 'Hebrew',
  fa: 'Farsi',
};

export function formatLanguage(code) {
    if (!code) return 'non-English';
    return LANGUAGE_LABELS[code.toLowerCase()] || code.toUpperCase();
}

export function formatLanguageList(codes) {
    const uniqueCodes = Array.from(new Set((codes || []).filter(Boolean).map(code => code.toLowerCase())));
    if (uniqueCodes.length === 0) {
        return 'non-English';
    }
    if (uniqueCodes.length === 1) {
        return formatLanguage(uniqueCodes[0]);
    }
    return uniqueCodes.map(code => formatLanguage(code)).join('/');
}

export function toOption(label, library) {
    const safeLabel = label?.toString() || 'Option';
    const value = safeLabel
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 30);

    return {
        label: safeLabel,
        value,
        library_id: library?.id || null,
        library_name: library?.name || null
    };
}

export function buildQuestionPayload(metadata, { problem_summary, why_uncertain, question, options, candidates, extras = {} }, { normalizeMetadataList, logger }) {
    const topCandidate = (candidates || [])[0];
    const primaryCandidateLibraryId = topCandidate?.library_id ?? topCandidate?.library?.id ?? options?.[0]?.library_id ?? null;
    const primaryCandidateLibraryName = topCandidate?.library_name ?? topCandidate?.library?.name ?? options?.[0]?.library_name ?? null;
    const questionAnchorLibrary = extras.question_anchor_library
        || topCandidate?.library
        || (primaryCandidateLibraryId ? { id: primaryCandidateLibraryId, name: primaryCandidateLibraryName } : null);
    const questionAnchorReason = extras.question_anchor_reason
        || (questionAnchorLibrary?.id === primaryCandidateLibraryId ? 'primary_candidate' : 'manual_review_required');
    const policyScores = topCandidate?.scores || null;
    const policyWeights = topCandidate?.weights || null;
    const candidateDiagnostics = topCandidate?.candidate_diagnostics || topCandidate?.candidateDiagnostics || null;
    const decisionDiagnostics = extras.policyResult?.decisionDiagnostics || null;
    const ragSummary = extras.ragContext?.similarItems
        ? extras.ragContext.similarItems.map(item => ({
            title: item.title,
            library: item.libraryName || item.library_name,
            similarity: item.similarity
        }))
        : null;
    const aiRationale = extras.aiResult?.reason || null;
    const relatedEvidenceSummary = extras.relatedEvidenceSummary ?? null;
    const tags = {
        genres: normalizeMetadataList(metadata.genres),
        keywords: normalizeMetadataList(metadata.keywords).slice(0, 10)
    };

    if (
        primaryCandidateLibraryId != null &&
        options?.[0]?.library_id != null &&
        primaryCandidateLibraryId !== options[0].library_id &&
        questionAnchorReason === 'primary_candidate'
    ) {
        logger.warn('Policy question option order diverges from primary candidate', {
            title: metadata?.title,
            primaryCandidateLibraryId,
            primaryCandidateLibraryName,
            firstOptionLibraryId: options[0].library_id,
            firstOptionLibraryName: options[0].library_name
        });
    }

    return {
        type: 'policy',
        problem_summary,
        why_uncertain,
        question,
        options,
        meta: {
            candidates: (candidates || []).map(candidate => ({
                library_id: candidate.library_id,
                library_name: candidate.library_name,
                score: candidate.score,
                policy_id: candidate.policy_id,
                policy_name: candidate.policy_name,
                candidate_diagnostics: candidate.candidate_diagnostics || candidate.candidateDiagnostics || null
            })),
            policy_scores: policyScores,
            policy_weights: policyWeights,
            candidate_diagnostics: candidateDiagnostics,
            decision_diagnostics: decisionDiagnostics,
            rag_summary: ragSummary,
            ai_rationale: aiRationale,
            related_evidence_summary: relatedEvidenceSummary,
            primary_candidate_library_id: primaryCandidateLibraryId,
            primary_candidate_library_name: primaryCandidateLibraryName,
            question_anchor_library_id: questionAnchorLibrary?.id ?? null,
            question_anchor_library_name: questionAnchorLibrary?.name ?? null,
            question_anchor_reason: questionAnchorReason,
            tags
        },
        generated_at: new Date().toISOString()
    };
}

export function getLanguagesForPolicy(presets) {
    const languages = new Set();
    (presets || []).forEach(preset => {
        const languageSignals = preset.signals?.language || {};
        ['require_any', 'prefer', 'exclude'].forEach(key => {
            const values = languageSignals[key] || [];
            values.forEach(code => languages.add(code.toLowerCase()));
        });
    });
    return Array.from(languages);
}

export function collectSignalTypes(presetsByPolicy, candidates) {
    const types = new Set();
    candidates.forEach(candidate => {
        const presets = presetsByPolicy[candidate.policy_id] || [];
        presets.forEach(preset => {
            Object.entries(preset.signals || {}).forEach(([signalType, config]) => {
                if (signalType === 'media_type') return;
                if (config && Object.keys(config).length > 0) {
                    types.add(signalType);
                }
            });
        });
    });
    return Array.from(types);
}
