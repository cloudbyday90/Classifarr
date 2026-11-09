/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { NATIVE_PURPOSE_POSITIVE_LIMITS } from './nativePurposePositiveSemantics.mjs';

const includeList = "CASE WHEN jsonb_typeof(rule.values -> 'include') = 'array' THEN rule.values -> 'include' ELSE '[]'::jsonb END";
const termText = "checked.value #>> '{}'";
// ECMAScript trim whitespace, plus UTF-16 units rather than PostgreSQL code points.
const trimCharacters = "\\0009\\000A\\000B\\000C\\000D\\0020\\00A0\\1680\\2000\\2001\\2002\\2003\\2004\\2005\\2006\\2007\\2008\\2009\\200A\\2028\\2029\\202F\\205F\\3000\\FEFF";

/** Correlated fragment for the existing `rule` alias; never accepts request SQL. */
export const NATIVE_PURPOSE_INCLUDE_TERMS_SQL = `
  SELECT included.value AS term_value
  FROM jsonb_array_elements(${includeList}) AS included(value)
  WHERE rule.intent_role = 'purpose'
    AND rule.source IN ('native_intent', 'operator_declared_intent')
    AND rule.semantics = 'identity'
    AND rule.signal_type IN ('genres', 'keywords', 'studios')
    AND rule.operator = 'include'
    AND jsonb_typeof(rule.values) = 'object'
    AND jsonb_array_length(${includeList}) BETWEEN 1 AND ${NATIVE_PURPOSE_POSITIVE_LIMITS.terms}
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_object_keys(CASE WHEN jsonb_typeof(rule.values) = 'object' THEN rule.values ELSE '{}'::jsonb END) AS field(key)
      WHERE field.key NOT IN ('include', 'weight')
    )
    AND (NOT (rule.values ? 'weight') OR CASE WHEN jsonb_typeof(rule.values -> 'weight') = 'number'
      THEN (rule.values ->> 'weight')::numeric BETWEEN 5e-324 AND 1.7976931348623157e308
      ELSE FALSE END)
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(${includeList}) AS checked(value)
      WHERE jsonb_typeof(checked.value) <> 'string'
        OR char_length(${termText}) + char_length(regexp_replace(${termText}, U&'[\\0001-\\FFFF]', '', 'g'))
          NOT BETWEEN 1 AND ${NATIVE_PURPOSE_POSITIVE_LIMITS.termLength}
        OR BTRIM(${termText}, U&'${trimCharacters}') <> ${termText}
    )`;
