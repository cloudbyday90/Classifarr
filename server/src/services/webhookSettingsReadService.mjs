/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  annotateWebhookSecretStatus,
  maskWebhookSecret,
} from './shared/webhookSettingsModel.mjs';

export async function readWebhookConfig({ webhookService }) {
  const [config, fullSecret] = await Promise.all([
    webhookService.getConfig({ mask: false }),
    webhookService.getFullSecret(),
  ]);

  return annotateWebhookSecretStatus(
    maskWebhookSecret(config, fullSecret),
    fullSecret,
  );
}

export async function readWebhookConfigList({ webhookService }) {
  return webhookService.getAllConfigs();
}

export async function readWebhookConfigById({ webhookService, id }) {
  return webhookService.getConfigById(id);
}
