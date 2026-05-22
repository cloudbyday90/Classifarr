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
  StringSelectMenuBuilder,
} from 'discord.js';

export function createTieredComponents(
  classificationId,
  libraries,
  tier,
  metadata,
  confidence,
  requireAllConfirmations = false,
  clarification = null,
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
  includeDropdown = true,
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
