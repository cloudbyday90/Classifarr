/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { 
    normalizeResponseForParsing, 
    stripThinkingBlocks, 
    stripMarkdownFences, 
    normalizeNumericString 
} from '../services/aiResponseNormalizer.mjs';

describe('aiResponseNormalizer', () => {
    describe('stripThinkingBlocks', () => {
        it('removes properly closed <think> blocks', () => {
            const input = '<think>Let me see. This looks like a movie.</think>CONFIDENT|4|95|reason';
            expect(stripThinkingBlocks(input)).toBe('CONFIDENT|4|95|reason');
        });

        it('removes unclosed <think> blocks at the end of text', () => {
            const input = '<think>Thinking about this...';
            expect(stripThinkingBlocks(input)).toBe('');
        });

        it('handles case-insensitive tags', () => {
            const input = '<THINK>Analyzing libraries...</THINK>CONFIRM|1|reason';
            expect(stripThinkingBlocks(input)).toBe('CONFIRM|1|reason');
        });
    });

    describe('stripMarkdownFences', () => {
        it('removes triple backtick code fences with languages', () => {
            const input = '```text\nCONFIDENT|4|95|reason\n```';
            expect(stripMarkdownFences(input)).toBe('CONFIDENT|4|95|reason');
        });

        it('removes simple triple backticks', () => {
            const input = '```CONFIDENT|4|95|reason```';
            expect(stripMarkdownFences(input)).toBe('CONFIDENT|4|95|reason');
        });

        it('removes single backticks', () => {
            const input = '`CONFIDENT|4|95|reason`';
            expect(stripMarkdownFences(input)).toBe('CONFIDENT|4|95|reason');
        });
    });

    describe('normalizeNumericString', () => {
        it('removes percentage sign and spaces', () => {
            expect(normalizeNumericString(' 95% ')).toBe('95');
        });

        it('handles decimal numbers', () => {
            expect(normalizeNumericString('95.5')).toBe('95.5');
        });

        it('removes approximate signs and currency symbols', () => {
            expect(normalizeNumericString('~95')).toBe('95');
            expect(normalizeNumericString('$4')).toBe('4');
        });

        it('removes surrounding brackets or parentheses', () => {
            expect(normalizeNumericString('(4)')).toBe('4');
        });
    });

    describe('normalizeResponseForParsing', () => {
        it('cleans Gemma 4 style bold keywords and percentage signs', () => {
            const input = '**CONFIDENT**|4|95%|Excellent true crime series';
            expect(normalizeResponseForParsing(input)).toBe('CONFIDENT|4|95|Excellent true crime series');
        });

        it('handles loose preambles and postambles', () => {
            const input = 'Here is the result of classification:\n\nCONFIDENT|4|95|Looks good\n\nHope this helps!';
            expect(normalizeResponseForParsing(input)).toBe('CONFIDENT|4|95|Looks good');
        });

        it('cleans up markdown and thinking blocks combined', () => {
            const input = '<think>\nChecking libraries...\n</think>\n```text\nCONFIDENT|4|95%|reason\n```';
            expect(normalizeResponseForParsing(input)).toBe('CONFIDENT|4|95|reason');
        });

        it('normalizes CONFIRM structures correctly', () => {
            const input = 'CONFIRM| 4. | True crime documentary';
            expect(normalizeResponseForParsing(input)).toBe('CONFIRM|4|True crime documentary');
        });

        it('normalizes CLARIFY structures correctly', () => {
            const input = 'CLARIFY|Problem|Uncertain|Which library?| (4) | 5 ';
            expect(normalizeResponseForParsing(input)).toBe('CLARIFY|Problem|Uncertain|Which library?|4|5');
        });

        it('preserves inner formatting of free-text reason field', () => {
            const input = 'CONFIDENT|4|95|"This is a **Reality** show."';
            expect(normalizeResponseForParsing(input)).toBe('CONFIDENT|4|95|This is a **Reality** show.');
        });
    });
});
