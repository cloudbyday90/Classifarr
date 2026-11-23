/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ComponentType } from 'discord.js';

export const CLASSIFICATION_CORRECTION_PLACEHOLDER = 'Or choose a different library...';
export const VERIFICATION_CORRECTION_PLACEHOLDER = 'Select the correct library...';

export function getOfferedDiscordCorrectionKind(interaction) {
  const menu = interaction.message?.components?.flatMap(row => row.components ?? []).find(component =>
    component.type === ComponentType.StringSelect && component.customId === interaction.customId &&
    !component.disabled && component.options?.some(option => option.value === interaction.values[0]),
  );

  // Discord identifies the selected menu by custom ID. Its placeholder distinguishes
  // the two existing correction controls from the old manual-selection control.
  if (menu?.placeholder === CLASSIFICATION_CORRECTION_PLACEHOLDER) return 'classification';
  if (menu?.placeholder === VERIFICATION_CORRECTION_PLACEHOLDER) return 'confidence';
  return null;
}
