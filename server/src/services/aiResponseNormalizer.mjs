/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Strips XML-style reasoning blocks (like <think>...</think>) from a response.
 * Handles both properly closed tags and unclosed tags cut off at the end.
 * 
 * @param {string} text Raw AI response text
 * @returns {string} Cleaned response text
 */
export function stripThinkingBlocks(text) {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
}

/**
 * Strips markdown code blocks and wrappers (like ```json or ```text) from a response.
 * 
 * @param {string} text Raw AI response text
 * @returns {string} Cleaned response text
 */
export function stripMarkdownFences(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        .replace(/```[a-z]*\r?\n/gi, '') // Strip language tag only when followed by a newline
        .replace(/```/g, '')
        .replace(/`/g, '')
        .trim();
}

/**
 * Extracts the first line from a text that looks like a structured response
 * starting with or containing CONFIDENT|, CONFIRM|, or CLARIFY|.
 * If none is found, falls back to the first non-empty line.
 * 
 * @param {string} text Sanitized response text
 * @returns {string} The matched structured line or the first line
 */
export function extractStructuredLine(text) {
    if (!text || typeof text !== 'string') return '';
    
    const lines = text.split('\n')
        .map(l => l.trim())
        .filter(Boolean);
        
    // Look for the first line that starts with or contains the format keyword
    for (const line of lines) {
        const cleanLine = line.replace(/[*_`]/g, '').trim(); // Strip markdown markers for matching
        const upper = cleanLine.toUpperCase();
        if (upper.startsWith('CONFIDENT|') || 
            upper.startsWith('CONFIRM|') || 
            upper.startsWith('CLARIFY|')) {
            return line;
        }
    }
    
    // Loose containment match (e.g. if the line has intro text before the keyword)
    for (const line of lines) {
        const cleanLine = line.replace(/[*_`]/g, '').trim();
        const upper = cleanLine.toUpperCase();
        if (upper.includes('CONFIDENT|') || 
            upper.includes('CONFIRM|') || 
            upper.includes('CLARIFY|')) {
            const match = line.match(/(CONFIDENT\||CONFIRM\||CLARIFY\|)[\s\S]*/i);
            if (match) {
                return match[0];
            }
        }
    }
    
    // Fallback: return the first line
    return lines[0] || text.trim();
}

/**
 * Strips all non-digit characters to normalize integer-expected fields.
 * 
 * @param {string} str Raw string field
 * @returns {string} Cleaned integer string
 */
export function normalizeIntegerString(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .replace(/[^\d]/g, '')
        .trim();
}

/**
 * Strips non-numeric characters to normalize float-expected fields.
 * Keeps digits and decimal points.
 * 
 * @param {string} str Raw string field
 * @returns {string} Cleaned float string
 */
export function normalizeFloatString(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .replace(/[^0-9.]/g, '')
        .trim();
}

/**
 * Sanitizes CLARIFY option tokens. If numeric or parenthesized numeric,
 * normalizes to a clean integer string. If it is a library name string,
 * preserves the text while trimming surrounding quotes/spaces.
 * 
 * @param {string} str Raw option token
 * @returns {string} Sanitized option token
 */
export function normalizeClarifyOption(str) {
    if (!str || typeof str !== 'string') return '';
    const trimmed = str.trim();
    // Match purely numeric, parenthesized numeric, or trailing-dot numeric
    if (/^\s*\(?\d+\)?\.?\s*$/.test(trimmed)) {
        return normalizeIntegerString(trimmed);
    }
    // Backward-compatibility: preserve library names
    return trimmed.replace(/^["']|["']$/g, '').trim();
}

/**
 * Strips non-numeric characters (like %, ~, ≈, $, parentheses) from expected numeric fields.
 * Keeps digits, minus signs, and decimal points.
 * 
 * @param {string} str Raw string field
 * @returns {string} Cleaned numeric string
 */
export function normalizeNumericString(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .replace(/[^0-9.-]/g, '')
        .trim();
}

/**
 * Sanitizes a raw response line or multi-line text into a clean, normalized
 * pipe-delimited format suitable for robust parsing.
 * 
 * @param {string} text Raw response text from the AI
 * @returns {string} Normalized pipe-delimited response line
 */
export function normalizeResponseForParsing(text) {
    if (!text || typeof text !== 'string') return '';
    
    // Layer 0: Strip thinking/reasoning blocks
    let processed = stripThinkingBlocks(text);
    
    // Layer 1: Strip markdown code fences
    processed = stripMarkdownFences(processed);
    
    // Layer 2: Find the structured line
    let line = extractStructuredLine(processed);
    if (!line) return '';
    
    // Strip outer quotes
    line = line.trim().replace(/^["']|["']$/g, '').trim();
    
    // Split into parts to normalize individual columns defensively
    const parts = line.split('|').map(p => p.trim());
    if (parts.length === 0 || !parts[0]) return '';
    
    // Layer 3: Clean and uppercase keyword, stripping any markdown bold/italic wrappers
    const keyword = parts[0].replace(/[*_`]/g, '').trim().toUpperCase();
    parts[0] = keyword;
    
    // Layer 4: Normalize specific fields based on keyword contract
    if (keyword === 'CONFIDENT') {
        // CONFIDENT|<library_number>|<confidence_integer>|<brief_reason>
        if (parts.length > 1) {
            parts[1] = normalizeIntegerString(parts[1]);
        }
        if (parts.length > 2) {
            parts[2] = normalizeFloatString(parts[2]);
        }
        if (parts.length > 3) {
            parts[3] = parts[3].trim().replace(/^["']|["']$/g, '').trim();
        }
    } else if (keyword === 'CONFIRM') {
        // CONFIRM|<library_number>|<brief_verification_reason>
        if (parts.length > 1) {
            parts[1] = normalizeIntegerString(parts[1]);
        }
        if (parts.length > 2) {
            parts[2] = parts[2].trim().replace(/^["']|["']$/g, '').trim();
        }
    } else if (keyword === 'CLARIFY') {
        // CLARIFY|<problem_summary>|<why_uncertain>|<question>|<library_number_1>|<library_number_2>|<library_number_3>
        for (let i = 1; i <= 3; i++) {
            if (parts[i]) {
                parts[i] = parts[i].trim().replace(/^["']|["']$/g, '').trim();
            }
        }
        for (let i = 4; i < parts.length; i++) {
            if (parts[i]) {
                parts[i] = normalizeClarifyOption(parts[i]);
            }
        }
    }
    
    return parts.join('|');
}
