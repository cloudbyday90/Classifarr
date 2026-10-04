/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createDiscordDeliveryReviewRepository } from '../../services/discordDeliveryReviewRepository.mjs';

export function createDiscordDeliveryReviewHandler(db) {
  const repository = createDiscordDeliveryReviewRepository(db);
  let active = 0;
  return async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const before = req.query.before ?? '9223372036854775807';
    if (typeof before !== 'string' || !/^[1-9]\d{0,18}$/.test(before) ||
        BigInt(before) > 9223372036854775807n) {
      return res.status(400).json({ error: 'Invalid delivery cursor' });
    }
    if (active >= 4) {
      return res.status(503).json({ error: 'Delivery records are busy. Try again shortly.' });
    }
    active++;
    try {
      return res.json(await repository.list(before));
    } catch {
      return res.status(503).json({ error: 'Delivery records are unavailable. Try again shortly.' });
    } finally {
      active--;
    }
  };
}
