/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export function getDefaultLibrary(libraries, mediaType) {
    if (!libraries || libraries.length === 0) {
        return null;
    }

    const generalNames = mediaType === 'movie'
        ? ['movies', 'films', 'general movies']
        : ['tv shows', 'tv series', 'series', 'television'];

    const generalLib = libraries.find(l =>
        generalNames.some(name => l.name.toLowerCase().includes(name))
    );

    return generalLib || libraries[libraries.length - 1];
}

export function buildContractViolationWhyUncertain({ violationReason, targetLibrary }) {
    const generic = targetLibrary
        ? `The AI returned an invalid classification response that did not match the required response contract. Deterministic scoring currently favors "${targetLibrary.name}", but the malformed AI output cannot be trusted as-is.`
        : 'The AI returned an invalid classification response that did not match the required response contract.';

    switch (violationReason) {
        case 'narrative_no_format_match':
            return targetLibrary
                ? `The AI returned narrative text instead of the required response contract format. Deterministic scoring currently favors "${targetLibrary.name}", but the malformed AI output cannot be trusted as-is.`
                : 'The AI returned narrative text instead of the required response contract format.';
        case 'single_valid_option':
            return targetLibrary
                ? `The AI returned a clarification response, but only one valid library option could be mapped. Deterministic scoring currently favors "${targetLibrary.name}", but the malformed AI output cannot be trusted as-is.`
                : 'The AI returned a clarification response, but only one valid library option could be mapped.';
        case 'no_valid_options':
            return targetLibrary
                ? `The AI returned a clarification response, but none of its library options matched known libraries. Deterministic scoring currently favors "${targetLibrary.name}", but the malformed AI output cannot be trusted as-is.`
                : 'The AI returned a clarification response, but none of its library options matched known libraries.';
        case 'no_format_matched':
        default:
            return generic;
    }
}

export function createFallbackResult(libraries, metadata, options = {}) {
    const parseFailureReason = options.parseFailureReason || 'unknown_parse_failure';
    const defaultLibrary = getDefaultLibrary(libraries, metadata?.media_type);
    const orderedLibraries = [];

    if (defaultLibrary) {
        orderedLibraries.push(defaultLibrary);
    }

    for (const library of libraries || []) {
        if (!orderedLibraries.some(candidate => candidate.id === library.id)) {
            orderedLibraries.push(library);
        }
    }

    return {
        library: defaultLibrary,
        confidence: 50,
        reason: 'AI could not determine classification - manual review needed',
        parse_failure_reason: parseFailureReason,
        needs_clarification: true,
        clarification: {
            problem_summary: 'Unable to auto-classify',
            why_uncertain: 'The AI classification returned an unexpected format. Manual review is recommended.',
            question: `Which library should "${metadata?.title || 'this item'}" be added to?`,
            options: orderedLibraries.slice(0, 4).map(lib => ({
                label: lib.name,
                value: `library_${lib.id}`,
                library_id: lib.id,
                library_name: lib.name,
            })),
        },
        libraries: libraries,
        format: 'fallback'
    };
}

export function createVerifyDisagreementResult(context, details = {}) {
    const { libraries, signalContext, metadata } = context;
    const suggestedLibrary = signalContext?.suggestedLibrary;
    if (!suggestedLibrary) {
        return createFallbackResult(libraries, metadata, {
            parseFailureReason: 'verify_missing_suggested_library'
        });
    }

    const title = metadata?.title || 'this item';
    const orderedAlternatives = [];

    if (details.conflictingLibrary && details.conflictingLibrary.id !== suggestedLibrary.id) {
        orderedAlternatives.push(details.conflictingLibrary);
    }

    for (const library of libraries) {
        if (library.id !== suggestedLibrary.id && !orderedAlternatives.some(candidate => candidate.id === library.id)) {
            orderedAlternatives.push(library);
        }
    }

    const options = [
        {
            label: suggestedLibrary.name,
            value: `library_${suggestedLibrary.id}`,
            library_id: suggestedLibrary.id,
            library_name: suggestedLibrary.name,
        },
        ...orderedAlternatives.slice(0, 3).map(lib => ({
            label: lib.name,
            value: `library_${lib.id}`,
            library_id: lib.id,
            library_name: lib.name,
        }))
    ].slice(0, 4);

    const whyUncertain = details.conflictingLibrary
        ? `The AI verify response selected "${details.conflictingLibrary.name}" instead of confirming the suggested library "${suggestedLibrary.name}".`
        : 'The AI returned a narrative response instead of confirming the suggested library, indicating disagreement or uncertainty.';
    const question = `The AI disagreed with classifying "${title}" as "${suggestedLibrary.name}". Please confirm or choose an alternative.`;
    const policyQuestion = {
        problem_summary: 'AI disagreed with suggested classification',
        why_uncertain: whyUncertain,
        question,
        options,
        generated_at: new Date().toISOString(),
        signal_breakdown: signalContext?.breakdown || [],
        calculated_confidence: signalContext?.confidence || null,
        meta: {
            source_format: details.sourceFormat || 'verify_disagreement',
            conflicting_library_id: details.conflictingLibrary?.id || null,
            conflicting_library_name: details.conflictingLibrary?.name || null,
            disagreement_reason: details.disagreementReason || null
        }
    };

    return {
        library: suggestedLibrary,
        confidence: Number.isFinite(Number(signalContext?.confidence))
            ? Number(signalContext.confidence)
            : 50,
        reason: 'Needs clarification: AI disagreed with suggested classification',
        needs_clarification: true,
        clarification: policyQuestion,
        pending_reason: 'AI disagreed with suggested classification',
        policy_question: policyQuestion,
        libraries,
        format: details.sourceFormat === 'narrative' ? 'narrative_clarify' : 'verify_disagreement',
    };
}

export function createContractViolationResult(context, details = {}) {
    const { libraries, metadata, signalContext } = context;
    if (!Array.isArray(libraries) || libraries.length === 0) {
        return null;
    }

    const suggestedLibrary = signalContext?.suggestedLibrary || getDefaultLibrary(libraries, metadata?.media_type);
    const orderedLibraries = [];
    const matchedOptions = Array.isArray(details.matchedOptions) ? details.matchedOptions : [];

    for (const option of matchedOptions) {
        const matchedLibrary = libraries.find(lib => lib.id === option.library_id);
        if (matchedLibrary && !orderedLibraries.some(candidate => candidate.id === matchedLibrary.id)) {
            orderedLibraries.push(matchedLibrary);
        }
    }

    if (suggestedLibrary && libraries.some(lib => lib.id === suggestedLibrary.id) && !orderedLibraries.some(candidate => candidate.id === suggestedLibrary.id)) {
        orderedLibraries.push(suggestedLibrary);
    }

    for (const library of libraries) {
        if (!orderedLibraries.some(candidate => candidate.id === library.id)) {
            orderedLibraries.push(library);
        }
    }

    const clarificationOptions = orderedLibraries.slice(0, 4).map(lib => ({
        label: lib.name,
        value: `library_${lib.id}`,
        library_id: lib.id,
        library_name: lib.name
    }));

    const title = metadata?.title || 'this item';
    const targetLibrary = suggestedLibrary || orderedLibraries[0] || null;

    const confidence = Number.isFinite(Number(signalContext?.confidence))
        ? Math.min(95, Math.max(50, Number(signalContext.confidence)))
        : 50;
    const violationReason = details.violationReason || 'no_format_matched';
    const whyUncertain = buildContractViolationWhyUncertain({
        violationReason,
        targetLibrary,
    });
    const question = targetLibrary
        ? `The AI returned an invalid classification response. Should "${title}" go to "${targetLibrary.name}", or to a different library?`
        : `The AI returned an invalid classification response. Which library should "${title}" be added to?`;

    const policyQuestion = {
        problem_summary: 'AI response contract violation',
        why_uncertain: whyUncertain,
        question,
        options: clarificationOptions,
        generated_at: new Date().toISOString(),
        signal_breakdown: signalContext?.breakdown || [],
        calculated_confidence: signalContext?.confidence || null,
        meta: {
            suggested_library_id: targetLibrary?.id || null,
            suggested_library_name: targetLibrary?.name || null,
            parser_mode: 'classify',
            violation_reason: violationReason,
            validation_errors: details.validationErrors || null,
            requested_options: Array.isArray(details.requestedOptions) ? details.requestedOptions : [],
            matched_option_count: matchedOptions.length
        }
    };

    return {
        library: targetLibrary,
        confidence,
        reason: 'Needs clarification: AI response contract violation',
        needs_clarification: true,
        clarification: policyQuestion,
        pending_reason: 'AI response contract violation',
        policy_question: policyQuestion,
        validation_errors: details.validationErrors || null,
        libraries,
        format: 'contract_violation'
    };
}
