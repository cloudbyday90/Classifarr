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
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { createLogger } from '../utils/logger.mjs';
import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';
import { ragRetriever } from './ragRetriever.mjs';

const logger = createLogger('discordNotificationBuilder');

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

export function createTieredComponents(
  classificationId,
  libraries,
  tier,
  metadata,
  confidence,
  requireAllConfirmations = false,
  clarification = null
) {
  const components = [];

  if (
    clarification &&
    clarification.options &&
    clarification.options.length > 0
  ) {
    const clarificationButtons = clarification.options.map((opt, idx) =>
      new ButtonBuilder()
        .setCustomId(`ai_clarify_${classificationId}_${idx}`)
        .setLabel(opt.label.substring(0, 80))
        .setStyle(
          idx === 0
            ? ButtonStyle.Primary
            : idx === clarification.options.length - 1
              ? ButtonStyle.Secondary
              : ButtonStyle.Primary,
        ),
    );

    components.push(
      new ActionRowBuilder().addComponents(clarificationButtons.slice(0, 5)),
    );

    if (libraries && libraries.length > 1) {
      const options = libraries.map((lib) => ({
        label: lib.name,
        value: `${classificationId}_${lib.id}`,
        description: `${lib.media_type} library`,
      }));

      components.push(
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('library_select')
            .setPlaceholder('Or manually select a library...')
            .addOptions(options),
        ),
      );
    }

    return components;
  }

  const effectiveTier =
    tier.tier === 'auto' && requireAllConfirmations ? 'verify' : tier.tier;

  if (effectiveTier === 'auto') {
    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`acknowledge_${classificationId}`)
          .setLabel('\u2713 Acknowledged')
          .setStyle(ButtonStyle.Success),
      ),
    );
  } else if (effectiveTier === 'verify') {
    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`verify_yes_${classificationId}`)
          .setLabel('\u2713 Yes, Correct')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`verify_no_${classificationId}`)
          .setLabel('\u2717 No, Choose Different')
          .setStyle(ButtonStyle.Danger),
      ),
    );
  } else if (effectiveTier === 'clarify' || effectiveTier === 'manual') {
    if (libraries.length > 1) {
      const options = libraries.map((lib) => ({
        label: lib.name,
        value: `${classificationId}_${lib.id}`,
        description: `${lib.media_type} library`,
      }));

      components.push(
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('library_select')
            .setPlaceholder('Or manually select a library...')
            .addOptions(options),
        ),
      );
    }
  }

  return components;
}

export function createCorrectionComponents(
  classificationId,
  libraries,
  buttonCount = 3,
  includeDropdown = true
) {
  const components = [];

  const alternativeLibraries = libraries.slice(1, buttonCount + 1);

  if (alternativeLibraries.length > 0) {
    const buttons = [
      new ButtonBuilder()
        .setCustomId(`correct_${classificationId}`)
        .setLabel('\u2713 Correct')
        .setStyle(ButtonStyle.Success),
    ];

    alternativeLibraries.forEach((lib) => {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`reclassify_${classificationId}_${lib.id}`)
          .setLabel(`\u2192 ${lib.name}`)
          .setStyle(ButtonStyle.Secondary),
      );
    });

    components.push(new ActionRowBuilder().addComponents(buttons));
  }

  if (includeDropdown && libraries.length > 1) {
    const options = libraries.map((lib) => ({
      label: lib.name,
      value: `${classificationId}_${lib.id}`,
      description: `${lib.media_type} library`,
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('library_select')
      .setPlaceholder('Or choose a different library...')
      .addOptions(options);

    components.push(new ActionRowBuilder().addComponents(selectMenu));
  }

  return components;
}

export async function createTieredEmbed(
  metadata,
  result,
  tier,
  requireAllConfirmations = false,
  hasClarification = false,
) {
  const colors = {
    auto: 0x00ff00,
    verify: 0xffff00,
    clarify: 0x0099ff,
    manual: 0xff0000,
    clarification: 0x9333ea,
  };

  const icons = {
    auto: '\u2705',
    verify: '\u26A0\uFE0F',
    clarify: '\u2753',
    manual: '\uD83D\uDED1',
    clarification: '\uD83E\uDD14',
  };

  const effectiveTier = hasClarification ? 'clarification' : tier.tier;

  const titleEmoji = hasClarification
    ? getMediaTypeEmoji(metadata.media_type)
    : icons[effectiveTier];

  const embed = new EmbedBuilder()
    .setTitle(`${titleEmoji} ${metadata.title} (${metadata.year || 'N/A'})`)
    .setColor(colors[effectiveTier])
    .setTimestamp();

  const topAlternatives = getTopAlternatives(result, 3);
  const suggestedLibraryName = resolveSuggestedLibraryName(result, topAlternatives);

  if (hasClarification && result.clarification) {
    const clarification = result.clarification;
    const mediaTypeLabel =
      metadata.media_type === 'movie' ? 'movie' : 'TV show';
    embed.setDescription(
      `\uD83E\uDD14 **I need your help classifying this ${mediaTypeLabel}**\n\n` +
        `\u26A0\uFE0F **Problem:** ${clarification.problem_summary}\n\n` +
        `\uD83D\uDCAD **Why I'm asking:** ${clarification.why_uncertain}\n\n` +
        `\uD83D\uDCC1 **Question:** ${clarification.question}`,
    );
  } else if (tier.tier === 'auto' && !requireAllConfirmations) {
    embed.setDescription(
      `\u2705 **Automatically routed to: ${result.library_name}**\n${tier.description}`,
    );
  } else if (tier.tier === 'auto' && requireAllConfirmations) {
    embed.setDescription(
      `\u26A0\uFE0F **Suggested library: ${suggestedLibraryName}**\n${tier.description}\n\n\uD83D\uDD12 **Manual confirmation required** (setting enabled)\nPlease confirm or select another option.`,
    );
    embed.setColor(colors.verify);
  } else if (tier.tier === 'verify') {
    embed.setDescription(
      `\u26A0\uFE0F **Suggested library: ${suggestedLibraryName}**\n${tier.description}\n\nPlease confirm or select another option.`,
    );
  } else if (tier.tier === 'clarify') {
    embed.setDescription(
      `\u2753 **Suggested library: ${suggestedLibraryName}**\n${tier.description}\n\nPlease answer the questions below to improve accuracy.`,
    );
  } else {
    embed.setDescription(
      `\uD83D\uDED1 **Suggested library: ${suggestedLibraryName}**\n${tier.description}\n\nPlease answer the questions or select a library manually.`,
    );
  }

  const fields = [
    {
      name: 'Media Type',
      value: metadata.media_type === 'movie' ? 'Movie' : 'TV Show',
      inline: true,
    },
    { name: 'Confidence', value: `${result.confidence}%`, inline: true },
    { name: 'Method', value: formatMethod(result.method), inline: true },
  ];

  if (result.reason && !hasClarification) {
    fields.push({ name: 'Reason', value: result.reason, inline: false });
  }

  if (topAlternatives.length > 0) {
    const alternativesText = topAlternatives
      .map((entry) => {
        const pct = formatDisplayPercent(entry.score);
        return pct ? `${entry.name} (${pct})` : entry.name;
      })
      .join(', ');

    fields.push({
      name: '\uD83D\uDCCA Top Alternatives',
      value: alternativesText,
      inline: false,
    });
  }

  if (result.signal_scores) {
    const signalBreakdown = Object.entries(result.signal_scores)
      .filter(([_, score]) => score > 0)
      .map(([signal, score]) => `${signal}: ${score}%`)
      .join(', ');
    if (signalBreakdown) {
      fields.push({
        name: '\uD83D\uDD0D Signal Breakdown',
        value: signalBreakdown,
        inline: false,
      });
    }
  }

  const normalizedGenres = normalizeMetadataList(metadata.genres);
  if (normalizedGenres.length > 0) {
    const genreList = normalizedGenres.slice(0, 5).join(', ');
    fields.push({
      name: '\uD83C\uDFAD Genres',
      value: genreList,
      inline: false,
    });
  }

  try {
    if (metadata.title && result.library_id) {
      const similarItems = await ragRetriever.findSimilarItems(
        metadata.title,
        result.library_id,
        3,
      );
      if (similarItems && similarItems.length > 0) {
        const similarList = similarItems
          .map((item) => item.title || item.name)
          .filter(Boolean)
          .join(', ');
        if (similarList) {
          fields.push({
            name: '\uD83D\uDCDA Similar in Library',
            value: similarList,
            inline: false,
          });
        }
      }
    }
  } catch (ragError) {
    logger.info('[Discord] RAG similar items not available:', ragError.message);
  }

  if (metadata.contentAnalysis && metadata.contentAnalysis.bestMatch) {
    const analysis = metadata.contentAnalysis.bestMatch;
    fields.push({
      name: 'Content Type Detected',
      value: `${analysis.type} (${analysis.confidence}% confidence)`,
      inline: true,
    });
  }

  embed.addFields(fields);

  if (metadata.poster_path) {
    embed.setThumbnail(
      `https://image.tmdb.org/t/p/w200${metadata.poster_path}`,
    );
  }

  return embed;
}
