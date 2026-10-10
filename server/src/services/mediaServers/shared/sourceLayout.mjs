/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { httpGet } from '../../../utils/httpClient.mjs';
import { captureSourceLayout } from '../../sourceLayoutCapture.mjs';
import { sourceIdentityRecoveryEvidence } from '../../sourceIdentityRecoveryEvidence.mjs';
import { collectPlexGuidCandidates, collectProviderIdCandidates } from './providerIds.mjs';
import { readPlexSourcePage, readEmbySourcePage } from './sourcePage.mjs';

const reject = () => { throw new Error('source_layout_invalid'); };
const validKey = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 500 &&
  !/[\p{Cc}\p{Cf}]/u.test(value) && !['.', '..'].includes(value);

/** Only configured adapter URLs and encoded opaque item IDs; never follow provider links. */
export async function readMediaSourceLayout(kind, url, apiKey, libraryId, externalId, { signal = null } = {}) {
  if (!['plex', 'emby'].includes(kind) || !validKey(libraryId) || !validKey(externalId)) reject();
  const plex = kind === 'plex';
  const headers = plex ? { 'X-Plex-Token': apiKey, Accept: 'application/json' } : { 'X-Emby-Token': apiKey };
  const options = { headers, timeout: 10000, maxResponseBytes: 1048576, signal, redirect: /** @type {const} */ ('error') };
  const readIdentity = async () => {
    const path = plex ? `/library/metadata/${encodeURIComponent(externalId)}` : `/Items/${encodeURIComponent(externalId)}`;
    const response = await httpGet(`${url}${path}`, { ...options,
      params: plex ? { includeGuids: 1 } : { Fields: 'ProviderIds,ParentId,AncestorIds' } });
    const list = response.data?.MediaContainer?.Metadata;
    if (plex && (!Array.isArray(list) || list.length !== 1)) reject();
    const item = plex ? list[0] : response.data;
    const member = plex ? String(item?.librarySectionID) === libraryId :
      String(item?.ParentId) === libraryId || (Array.isArray(item?.AncestorIds) && item.AncestorIds.includes(libraryId));
    if (!item || String(plex ? item.ratingKey : item.Id) !== externalId || !member) reject();
    const type = plex ? item.type : item.Type;
    const mediaType = type === (plex ? 'show' : 'Series') ? 'tv' : type === (plex ? 'movie' : 'Movie') ? 'movie' : null;
    const providerIds = plex ? collectPlexGuidCandidates(item.Guid ?? []) : collectProviderIdCandidates(item.ProviderIds ?? {});
    return sourceIdentityRecoveryEvidence({ external_id: externalId, title: plex ? item.title : item.Name,
      year: plex ? item.year : item.ProductionYear, media_type: mediaType }, libraryId, providerIds);
  };
  const readPage = async ({ offset, limit }) => {
    const response = await httpGet(plex ? `${url}/library/metadata/${encodeURIComponent(externalId)}/grandchildren` : `${url}/Items`, {
      ...options,
      params: plex ? { 'X-Plex-Container-Start': offset, 'X-Plex-Container-Size': limit } :
        { ParentId: externalId, Recursive: true, IncludeItemTypes: 'Episode', StartIndex: offset, Limit: limit,
          EnableTotalRecordCount: true, Fields: 'ParentId', EnableImages: false, EnableUserData: false },
    });
    const page = plex ? readPlexSourcePage(response) : readEmbySourcePage(response);
    return { offset: page.offset, total: page.total, items: page.items.map(item => {
      if (plex ? item.type !== 'episode' || String(item.grandparentRatingKey) !== externalId ||
          String(item.librarySectionID) !== libraryId : item.Type !== 'Episode' || String(item.SeriesId) !== externalId) reject();
      return { id: String(plex ? item.ratingKey : item.Id), season: plex ? item.parentIndex : item.ParentIndexNumber,
        episode: plex ? item.index : item.IndexNumber, end: plex ? item.indexEnd : item.IndexNumberEnd };
    }) };
  };
  try {
    return await captureSourceLayout({ readIdentity, readPage, signal });
  } catch (error) {
    signal?.throwIfAborted();
    if (error?.message === 'source_layout_invalid' || error?.name === 'SourceEnumerationError') reject();
    throw new Error('source_layout_unavailable');
  }
}
