/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { open } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { StringDecoder } from 'node:string_decoder';
import { createMappingCounterParser, MAPPING_MAX_BYTES } from './mappingCounters.mjs';

/** Fixed own-process path, bounded streaming read; errors never expose kernel text. */
export async function readComparisonMappings({ openFile = open, now = () => performance.now() } = {}) {
  const started = now(), parser = createMappingCounterParser();
  let file, result = { status: 'unavailable' };
  try {
    file = await openFile('/proc/self/smaps', 'r');
    const buffer = Buffer.alloc(65536), decoder = new StringDecoder('utf8');
    let bytes = 0;
    while (true) {
      if (now() - started > 1000) throw new Error('comparison_mapping_budget');
      const { bytesRead } = await file.read(buffer, 0, buffer.length, null);
      if (now() - started > 1000 || (bytes += bytesRead) > MAPPING_MAX_BYTES) throw new Error('comparison_mapping_budget');
      if (!bytesRead) break;
      parser.push(decoder.write(buffer.subarray(0, bytesRead)));
    }
    parser.push(decoder.end()); result = parser.finish();
  } catch { /* Unavailable is evidence, never zero usage or raw error details. */ }
  finally {
    try { await file?.close(); } catch { result = { status: 'unavailable' }; }
  }
  return result;
}
