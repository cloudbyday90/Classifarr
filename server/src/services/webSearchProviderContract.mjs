/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as z from 'zod';

export const WEB_SEARCH_PROVIDER_CONTRACT_VERSION = 1;

export const WEB_SEARCH_PURPOSES = Object.freeze([
  'classification',
  'content_advisory',
  'holiday',
  'anime',
  'manual_test',
  'metadata_enrichment',
]);

export const WEB_SEARCH_CAPABILITY_KEYS = Object.freeze([
  'generalSearch',
  'answerSummary',
  'siteSearch',
  'safeSearch',
]);

const PROVIDER_KEY_PATTERN = /^[a-z0-9_-]{1,40}$/;
// safe-regex flags the bounded label quantifier nested inside the group repeat,
// but this pattern cannot catastrophically backtrack: each label run of
// [a-z0-9-] is separated by a mandatory literal '.', so there is no ambiguous
// overlap to backtrack across, and every consumer applies it through a Zod
// `.max(253)` guard (below) that caps input length before the regex ever runs.
// eslint-disable-next-line security/detect-unsafe-regex -- bounded labels + mandatory '.' separators + upstream .max(253) length cap make this linear-time
const DOMAIN_PATTERN = /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/i;
const SAFE_TRACE_ID_PATTERN = /^[a-zA-Z0-9:_-]{1,120}$/;

const functionSchema = z.custom((value) => typeof value === 'function', {
  message: 'Expected function',
});

const capabilitySchema = z.object({
  generalSearch: z.boolean().default(false),
  answerSummary: z.boolean().default(false),
  siteSearch: z.boolean().default(false),
  safeSearch: z.boolean().default(false),
}).strict();

const providerSchema = z.object({
  contractVersion: z.literal(WEB_SEARCH_PROVIDER_CONTRACT_VERSION).optional(),
  providerKey: z.string().regex(PROVIDER_KEY_PATTERN),
  displayName: z.string().trim().min(1).max(80),
  capabilities: capabilitySchema,
  testConnection: functionSchema,
  search: functionSchema,
}).strict();

const mediaSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  year: z.union([
    z.number().int().min(1800).max(2200),
    z.string().regex(/^\d{4}$/),
  ]).optional(),
  mediaType: z.enum(['movie', 'tv', 'unknown']).optional(),
  tmdbId: z.union([
    z.number().int().positive(),
    z.string().regex(/^\d+$/),
  ]).optional(),
}).strict();

const searchOptionsSchema = z.object({
  maxResults: z.coerce.number().int().min(1).max(20).default(5),
  includeAnswer: z.boolean().default(true),
  safeSearch: z.boolean().default(true),
  domains: z.array(
    z.string().trim().min(1).max(253).regex(DOMAIN_PATTERN)
  ).max(20).default([]),
}).strict();

const traceContextSchema = z.object({
  correlationId: z.string().trim().regex(SAFE_TRACE_ID_PATTERN).optional(),
  classificationId: z.union([
    z.number().int().nonnegative(),
    z.string().regex(/^\d+$/),
  ]).optional(),
  traceId: z.string().trim().regex(SAFE_TRACE_ID_PATTERN).optional(),
  spanId: z.string().trim().regex(SAFE_TRACE_ID_PATTERN).optional(),
}).strict();

const searchRequestSchema = z.object({
  purpose: z.enum(WEB_SEARCH_PURPOSES).default('classification'),
  query: z.string().trim().min(1).max(500),
  media: mediaSchema.default({}),
  options: searchOptionsSchema.default({}),
  traceContext: traceContextSchema.default({}),
}).strict();

const warningSchema = z.object({
  code: z.string().regex(/^[a-z0-9_-]{1,80}$/),
  count: z.number().int().min(1).max(100000),
}).strict();

const normalizedResultSchema = z.object({
  title: z.string().max(240),
  url: z.string().url(),
  snippet: z.string().max(1000),
  rank: z.number().int().min(1).max(20),
  score: z.number().min(0).max(1).nullable(),
  publishedAt: z.string().datetime().nullable(),
  sourceDomain: z.string().trim().min(1).max(253),
  providerMetadata: z.record(z.string(), z.unknown()).default({}),
}).strict();

const normalizedResponseSchema = z.object({
  provider: z.string().regex(PROVIDER_KEY_PATTERN),
  providerRequestId: z.string().max(160).nullable(),
  query: z.string().max(500),
  answer: z.string().max(1200),
  results: z.array(normalizedResultSchema).max(20),
  usage: z.object({
    costUnits: z.number().int().min(0).max(1000),
    quotaBucket: z.string().trim().min(1).max(80).nullable(),
  }).strict(),
  warnings: z.array(warningSchema).max(50),
}).strict();

function formatPath(path) {
  return path.length > 0 ? path.join('.') : '(root)';
}

function normalizeIssues(issues = []) {
  return issues.map((issue) => ({
    path: formatPath(issue.path || []),
    code: issue.code || 'invalid',
    message: issue.message || 'Invalid value',
  }));
}

export class WebSearchProviderContractError extends Error {
  constructor(message, issues = []) {
    super(message);
    this.name = 'WebSearchProviderContractError';
    this.code = 'WEB_SEARCH_PROVIDER_CONTRACT_INVALID';
    this.issues = normalizeIssues(issues);
  }
}

function parseContractSchema(schema, value, message) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new WebSearchProviderContractError(message, parsed.error.issues);
  }
  return parsed.data;
}

export function validateWebSearchProvider(provider) {
  return parseContractSchema(
    providerSchema,
    provider,
    'Invalid web search provider contract'
  );
}

export function validateWebSearchRequest(request) {
  return parseContractSchema(
    searchRequestSchema,
    request,
    'Invalid web search request contract'
  );
}

export function validateWebSearchResponse(response) {
  return parseContractSchema(
    normalizedResponseSchema,
    response,
    'Invalid normalized web search response contract'
  );
}

export function isValidWebSearchProvider(provider) {
  try {
    validateWebSearchProvider(provider);
    return true;
  } catch {
    return false;
  }
}

export function assertWebSearchProvider(provider) {
  validateWebSearchProvider(provider);
  return provider;
}
