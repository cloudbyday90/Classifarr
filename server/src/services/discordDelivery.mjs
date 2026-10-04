/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { createDiscordDeliveryRepository } from './discordDeliveryRepository.mjs';
import { createDiscordDeliveryService } from './discordDeliveryService.mjs';
import { createDiscordDeliveryWriter } from './discordDeliveryWriter.mjs';
import { discordProviderGate } from './discordProviderRuntime.mjs';

export const discordDelivery = createDiscordDeliveryService(createDiscordDeliveryRepository(db),
  createDiscordDeliveryWriter({ gate: discordProviderGate }));
