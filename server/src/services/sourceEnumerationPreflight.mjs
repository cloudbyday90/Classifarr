/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createMediaSyncCompleteness } from './mediaSyncCompleteness.mjs';
import { SourceEnumerationError } from './sourceEnumerationError.mjs';
import { SourcePreflightError, sourcePreflightFailureReason } from './sourcePreflightDiagnostic.mjs';
import { SourceContentDeferredError } from './sourceContentFailure.mjs';

/** Bounded canary, NOT a completeness receipt. Buffers are used only by this owning run. */
export async function preflightSourceEnumeration({ service, url, apiKey, libraryKey, owner, batchSize }) {
  const pages = { media: [], collections: [] };
  for (const [phase, method] of [['media', 'getLibraryPage'], ['collections', 'getCollectionPage']]) {
    const enumeration = createMediaSyncCompleteness();
    for (let index = 0; index < 2 && !enumeration.complete; index++) {
      owner.signal?.throwIfAborted();
      await owner.assertSource();
      let page;
      try {
        page = await service[method](url, apiKey, libraryKey, {
          offset: enumeration.offset, limit: Math.min(2, batchSize), signal: owner.signal, preflight: true,
        });
        enumeration.accept(page);
        // Optional upstream metadata is not evidence of a complete import.
        if (enumeration.total === null) throw new SourceEnumerationError('unknown_source_total');
      } catch (error) {
        owner.signal?.throwIfAborted();
        await owner.assertSource();
        if (error instanceof SourceContentDeferredError || error instanceof SourcePreflightError) throw error;
        throw new SourcePreflightError(phase, sourcePreflightFailureReason(error));
      }
      owner.signal?.throwIfAborted();
      await owner.assertSource();
      pages[phase].push(page);
    }
  }
  return pages;
}
