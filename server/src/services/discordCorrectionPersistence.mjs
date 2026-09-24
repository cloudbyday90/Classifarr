/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { recordClassificationCorrection } from './classificationCorrectionWriter.mjs';

/** No Discord or routing I/O inside the transaction. */
export async function persistDiscordCorrection(db, outcomeService, { classificationId, newLibraryId, actor }) {
  return db.withTransaction(async client => {
    const { rows: [classification] } = await client.query(
      'SELECT * FROM classification_history WHERE id = $1 FOR UPDATE', [classificationId]);
    if (!classification) return { message: 'Classification not found' };
    const { rows: [library] } = await client.query(
      'SELECT name, media_type, is_active FROM libraries WHERE id = $1 FOR SHARE', [newLibraryId]);
    if (!library) return { message: 'Library not found' };
    if (!library.is_active || !['movie', 'tv'].includes(classification.media_type) ||
        library.media_type !== classification.media_type) return { message: 'Library is inactive or has an incompatible media type' };
    if (Number(classification.library_id) === Number(newLibraryId)) {
      return { message: '\u2705 Already processed \u2014 no changes made.' };
    }
    await client.query(`UPDATE classification_history
      SET library_id = $1, library_name = $2, status = 'corrected',
          clarification_status = 'resolved', pending_reason = NULL, clarification_response = $4
      WHERE id = $3`, [newLibraryId, library.name, classificationId, JSON.stringify({
      corrected_library_id: newLibraryId, corrected_library_name: library.name,
      corrected_by: actor, corrected_at: new Date().toISOString(),
    })]);
    await recordClassificationCorrection(client, { classification,
      originalLibraryId: classification.library_id, destinationLibraryId: newLibraryId, correctedBy: actor });
    const outcomeRecord = await outcomeService.recordOutcome(classificationId, {
      type: 'corrected', source: 'discord_correction', actor,
      final_library_id: newLibraryId, final_library_name: library.name,
    }, { client });
    if (outcomeRecord.updated !== true) throw new Error('discord_correction_outcome_not_recorded');
    return { classification, newLibraryName: library.name, outcomeRecord };
  });
}
