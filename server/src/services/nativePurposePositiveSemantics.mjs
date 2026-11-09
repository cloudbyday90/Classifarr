/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isPolicyDeclaredNativePurposeRule } from './policyDeclaredPurposeProvenance.mjs';
import { normalizeMetadataListLower } from '../utils/metadataNormalization.mjs';
import { keywordMatchesTerm } from './policyEngineUtils.mjs';

const signals = new Set(['genres', 'keywords', 'studios', 'media_type']);
const operators = new Set(['require_any', 'require_all', 'include', 'prefer']);
export const NATIVE_PURPOSE_POSITIVE_LIMITS = Object.freeze({ terms: 50, termLength: 120 });

/** Interpretation only; callers retain native authority, binding and receipt checks. */
export function readNativePurposePositiveRule(rule) {
  if (rule?.intent_role !== 'purpose' || !isPolicyDeclaredNativePurposeRule(rule) ||
      !signals.has(rule.signal_type) || !operators.has(rule.operator) ||
      !['identity', 'compatibility'].includes(rule.semantics)) return null;
  const values = rule.values;
  if (!values || typeof values !== 'object' || Array.isArray(values) ||
      Object.keys(values).some(key => key !== rule.operator && key !== 'weight') ||
      !Object.hasOwn(values, rule.operator) ||
      (Object.hasOwn(values, 'weight') && !(typeof values.weight === 'number' && Number.isFinite(values.weight) && values.weight > 0))) return null;
  const list = values[rule.operator];
  if (!Array.isArray(list) || list.length === 0 || list.length > NATIVE_PURPOSE_POSITIVE_LIMITS.terms ||
      list.some(term => typeof term !== 'string' || !term.length || term.length > NATIVE_PURPOSE_POSITIVE_LIMITS.termLength || term !== term.trim())) return null;
  const terms = list.map(term => term.toLowerCase());
  return { signalType: rule.signal_type, operator: rule.operator, evidenceMode: rule.semantics, terms,
    requiredTerms: rule.semantics === 'identity' && rule.signal_type !== 'media_type' && rule.operator !== 'prefer' ? terms : [] };
}

function termMatcher(signalType, item) {
  if (signalType === 'genres') {
    const genres = normalizeMetadataListLower(item.genres);
    return term => genres.includes(term);
  }
  if (signalType === 'keywords') {
    const keywords = normalizeMetadataListLower(item.keywords);
    const text = [(item.overview || '').toLowerCase(), (item.title || '').toLowerCase()].filter(Boolean).join(' ');
    return term => keywordMatchesTerm(term, keywords, text);
  }
  if (signalType === 'studios') {
    // Retain the existing scalar scorer's precedence and name/substring matching.
    const raw = typeof item.studios === 'string' ? JSON.parse(item.studios) :
      typeof item.production_companies === 'string' ? JSON.parse(item.production_companies) :
        (item.studios || item.production_companies || []);
    const studios = raw.map(value => typeof value === 'string' ? value : value && value.name)
      .filter(Boolean).map(value => value.toLowerCase());
    return term => studios.some(studio => studio.includes(term));
  }
  const mediaType = item.media_type?.toLowerCase();
  return term => mediaType === term;
}

/** Null preserves legacy execution; a recognized rule with bad item data scores zero. */
export function evaluateNativePurposePositiveRule(rule, item = {}) {
  const definition = readNativePurposePositiveRule(rule);
  if (!definition) return null;
  const { signalType, operator, terms, evidenceMode, requiredTerms } = definition;
  try {
    const matches = termMatcher(signalType, item);
    const count = terms.filter(matches).length;
    let score;
    if (operator === 'prefer') score = count === 0 && evidenceMode === 'identity' ? 0 : 50 + (count / terms.length) * 30;
    else if (operator === 'require_all') score = count === terms.length ? 100 : 0;
    else if (operator === 'include' && signalType === 'media_type') {
      score = !item.media_type && evidenceMode === 'compatibility' ? 50 : count > 0 ? 100 : 0;
    } else score = count > 0 ? 80 : 0;
    // Preserve the existing single-signal floating-point normalization too.
    const weight = rule.values.weight ?? 1;
    score = (score * weight) / weight;
    return { score, evidenceMode, requiredTerms, matchedRequiredTerms: requiredTerms.filter(matches) };
  } catch {
    return { score: 0, evidenceMode, requiredTerms, matchedRequiredTerms: [] };
  }
}
