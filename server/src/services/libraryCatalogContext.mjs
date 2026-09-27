/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ConflictError, NotFoundError } from '../utils/appError.mjs';
import { validateLibraryCatalog } from './mediaServers/shared/libraryCatalog.mjs';

export async function readLibraryCatalogContext(db, resolveService, sourceId = null) {
  const { rows: [source] } = await db.query(`SELECT * FROM media_server
    WHERE is_active=true AND ($1::integer IS NULL OR id=$1) ORDER BY id LIMIT 1`, [sourceId]);
  if (!source) throw new NotFoundError('No active media server configured');
  const service = await resolveService(source.type);
  const catalog = validateLibraryCatalog(await service.getLibraryCatalog(source.url, source.api_key));
  return { source, catalog };
}

export function catalogSourceVersion(source) {
  return [source.id, source.type, source.url, source.api_key, source.updated_at];
}

export async function lockLibraryCatalogSource(db, source) {
  const { rows: [current] } = await db.query('SELECT * FROM media_server WHERE id=$1 AND is_active=true FOR UPDATE', [source.id]);
  if (!current || JSON.stringify(catalogSourceVersion(current)) !== JSON.stringify(catalogSourceVersion(source))) {
    throw new ConflictError('Media server configuration changed. Refresh discovery and try again.', { code: 'library_catalog_source_changed' });
  }
}
