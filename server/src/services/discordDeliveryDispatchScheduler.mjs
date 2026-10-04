/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createRuntimeDiscordDispatcher } from './discordDeliveryDispatchRuntime.mjs';

export function registerDiscordDeliveryDispatchSchedule(scheduler, { worker = createRuntimeDiscordDispatcher() } = {}) {
  scheduler.discordDeliveryDispatchWorker?.stop();
  scheduler.discordDeliveryDispatchWorker = worker;
  scheduler.schedule('discord-deferred-delivery', '* * * * *', async () => {
    const result = await worker.run();
    if (result.status === 'failed') throw new Error('discord_deferred_delivery_unavailable');
    return result;
  }, null, { noOverlap: true, quiet: true });
}
