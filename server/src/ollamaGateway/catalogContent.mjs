/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { catalogTables } from './catalogContract.mjs';
import { visitCatalogRows } from './catalogRowReader.mjs';
import { gatewayError } from './errors.mjs';
export { visitCatalogRows } from './catalogRowReader.mjs';

export async function captureCatalogContent(client, signal, budget, version = 1, first = 0) {
  if (first !== 0 && (first !== 3 || version !== 3)) throw gatewayError('gateway_catalog_contract');
  const tables = {};
  const names = catalogTables(version);
  for (let index = first; index < names.length; index++) {
    const hash = createHash('sha256'); let count = 0, maxId = null;
    await visitCatalogRows(client, index, row => {
      budget.bytes += Buffer.byteLength(row.row) + 1;
      if (budget.bytes > 268435456) throw gatewayError('gateway_catalog_size_limit');
      hash.update(row.row).update('\n'); count++; maxId = row.id;
    }, signal, version);
    tables[names[index]] = { count, maxId, sha256: hash.digest('hex') };
  }
  return tables;
}
