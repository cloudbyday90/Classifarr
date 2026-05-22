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
import { createLogger } from '../utils/logger.mjs';
import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';
import {
  formatDisplayPercent,
  formatMethod,
  getMediaTypeEmoji,
  getTopAlternatives,
  resolveSuggestedLibraryName,
} from './discordNotificationBuilder.mjs';
import { ragRetriever } from './ragRetriever.mjs';

const logger = createLogger('discordTieredEmbedBuilder');

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
