/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { EmbedBuilder } from 'discord.js';

export function getMediaTypeEmoji(mediaType) {
  return mediaType === 'movie' ? '\uD83C\uDFAC' : '\uD83D\uDCFA';
}

export function getColorForConfidence(confidence) {
  if (confidence >= 90) return 0x22c55e;
  if (confidence >= 70) return 0x3b82f6;
  if (confidence >= 50) return 0xf59e0b;
  return 0xef4444;
}

export function formatMethod(method) {
  const methods = {
    exact_match: '\uD83C\uDFAF Exact Match',
    learned_pattern: '\uD83E\uDDE0 Learned Pattern',
    rule_match: '\uD83D\uDCCB Rule Match',
    ai_fallback: '\uD83E\uDD16 AI Classification',
  };
  return methods[method] || method;
}

export function safeParseJson(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    return null;
  }
}

export function toFiniteNumber(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function formatDisplayPercent(value) {
  const numeric = toFiniteNumber(value);
  if (numeric === null) return null;
  const rounded = Math.round(numeric * 100) / 100;
  if (Number.isInteger(rounded)) {
    return `${rounded}%`;
  }
  return `${rounded.toFixed(2).replace(/\.?0+$/, '')}%`;
}

export function getTopAlternatives(result, limit = 3) {
  const selectedLibraryId = toFiniteNumber(
    result?.library_id ?? result?.library?.id
  );
  const selectedLibraryName =
    typeof result?.library_name === 'string' && result.library_name.trim()
      ? result.library_name.trim().toLowerCase()
      : null;

  const preferredSources = [
    result?.clarification?.meta?.candidates,
    result?.policy_question?.meta?.candidates,
    result?.policyResult?.ranked,
    result?.signalContext?.ranked,
    result?.libraries,
  ];

  let source = [];
  for (const candidateSource of preferredSources) {
    if (Array.isArray(candidateSource) && candidateSource.length > 0) {
      source = candidateSource;
      break;
    }
  }

  if (!Array.isArray(source) || source.length === 0) {
    return [];
  }

  const normalized = source
    .map((entry) => {
      const id = toFiniteNumber(
        entry?.library_id ??
          entry?.id ??
          entry?.library?.id
      );
      const nameRaw =
        entry?.library_name ??
        entry?.name ??
        entry?.library?.name ??
        null;
      const name =
        typeof nameRaw === 'string' ? nameRaw.trim() : null;
      const score = toFiniteNumber(entry?.score ?? entry?.confidence);
      return { id, name, score };
    })
    .filter((entry) => entry.name);

  const filtered = normalized.filter((entry) => {
    if (
      selectedLibraryId !== null &&
      entry.id !== null &&
      entry.id === selectedLibraryId
    ) {
      return false;
    }
    if (
      selectedLibraryName &&
      entry.name.toLowerCase() === selectedLibraryName
    ) {
      return false;
    }
    return true;
  });

  const deduped = [];
  const seenKeys = new Set();
  for (const entry of filtered) {
    const key = entry.id !== null ? `id:${entry.id}` : `name:${entry.name.toLowerCase()}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    deduped.push(entry);
  }

  deduped.sort((a, b) => {
    const aScore = a.score ?? -1;
    const bScore = b.score ?? -1;
    return bScore - aScore;
  });

  return deduped.slice(0, Math.max(1, limit));
}

export function resolveSuggestedLibraryName(result, topAlternatives = []) {
  const candidates = [
    result?.library_name,
    result?.library?.name,
    result?.suggested_library_name,
    result?.signalContext?.suggestedLibrary?.name,
    result?.policyResult?.library?.library_name,
    result?.policyResult?.library?.name,
    Array.isArray(topAlternatives) && topAlternatives.length > 0 ? topAlternatives[0]?.name : null,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return 'Unknown';
}

export function buildSimpleNotificationEmbed(metadata, result, config) {
  const embed = new EmbedBuilder()
    .setTitle(
      `${getMediaTypeEmoji(metadata.media_type)} ${metadata.title} (${metadata.year || 'N/A'})`,
    )
    .setDescription(`Classified as: **${result.library_name}**`)
    .setColor(getColorForConfidence(result.confidence))
    .setTimestamp();

  const fields = [
    {
      name: 'Media Type',
      value: metadata.media_type === 'movie' ? 'Movie' : 'TV Show',
      inline: true,
    },
  ];

  if (config.show_confidence) {
    fields.push({
      name: 'Confidence',
      value: `${result.confidence}%`,
      inline: true,
    });
  }

  if (config.show_method) {
    fields.push({
      name: 'Method',
      value: formatMethod(result.method),
      inline: true,
    });
  }

  if (config.show_reason && result.reason) {
    fields.push({ name: 'Reason', value: result.reason, inline: false });
  }

  if (config.show_metadata && metadata) {
    const metadataStr = Object.entries(metadata)
      .filter(
        ([key]) =>
          !['title', 'year', 'media_type', 'poster_path'].includes(key),
      )
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    if (metadataStr) {
      fields.push({
        name: 'Metadata',
        value: metadataStr.substring(0, 1024),
        inline: false,
      });
    }
  }

  embed.addFields(fields);

  if (config.show_poster && metadata.poster_path) {
    embed.setThumbnail(
      `https://image.tmdb.org/t/p/w200${metadata.poster_path}`,
    );
  }

  return embed;
}
