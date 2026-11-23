/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { DISCORD_COMPLETED_BUTTON_REQUIRED, getDiscordCompletedControlRefusal } from './discordCompletedControlAdmission.mjs';

export async function persistDiscordVerification(db, outcomeService, { classificationId, actor, binding }) {
  return db.withTransaction(async client => {
    const { rows: [classification] } = await client.query(
      'SELECT * FROM classification_history WHERE id = $1 FOR UPDATE', [classificationId],
    );
    if (!classification) return { message: 'Classification not found' };
    const refusal = await getDiscordCompletedControlRefusal(client, classification, binding);
    if (refusal) return { message: refusal };
    if (classification.status === 'verified' || classification.status === 'routed') {
      return { message: '\u2705 Already processed \u2014 no changes made.' };
    }
    if (classification.status !== 'completed' || classification.library_id == null) {
      return { message: DISCORD_COMPLETED_BUTTON_REQUIRED };
    }

    const update = await client.query(`UPDATE classification_history
      SET status = 'verified', clarification_status = 'confirmed' WHERE id = $1`, [classificationId]);
    if (update.rowCount !== 1) throw new Error('discord_verification_not_recorded');
    const outcomeRecord = await outcomeService.recordOutcome(classificationId, {
      type: 'verified', source: 'discord_verification', actor,
      final_library_id: classification.library_id, final_library_name: classification.library_name || null,
    }, { client, requireWrite: true });
    if (outcomeRecord.updated !== true) throw new Error('discord_verification_outcome_not_recorded');
    return { classification };
  });
}
