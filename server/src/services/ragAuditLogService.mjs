/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export async function persistRagAuditLog({
  client,
  logger = null,
  level = 'warning',
  type = 'system',
  message,
}) {
  if (!client || !message) {
    return false;
  }

  try {
    await client.query(
      'INSERT INTO rag_logs (level, type, message) VALUES ($1, $2, $3)',
      [level, type, message]
    );
    return true;
  } catch (error) {
    logger?.error?.('Failed to persist RAG audit log', {
      error: error.message,
      level,
      type,
    });
    return false;
  }
}
