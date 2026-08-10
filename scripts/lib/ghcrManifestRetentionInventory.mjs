/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/iu;
const REPOSITORY_COMPONENT_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;
const OCI_INDEX_MEDIA_TYPES = new Set([
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
]);

export const GHCR_MANIFEST_RETENTION_INVENTORY_SCHEMA_VERSION =
  'ghcr.manifest_retention_inventory.v1';
export const DEFAULT_GHCR_OWNER = 'cloudbyday90';
export const DEFAULT_GHCR_PACKAGE = 'classifarr';
export const DEFAULT_GITHUB_API_BASE_URL = 'https://api.github.com';
export const DEFAULT_GHCR_REGISTRY_BASE_URL = 'https://ghcr.io';
export const DEFAULT_PACKAGE_VERSION_PAGE_SIZE = 100;
export const DEFAULT_MAX_PACKAGE_VERSION_PAGES = 100;
export const DEFAULT_MAX_MANIFEST_REQUESTS = 1_000;

export const GHCR_MANIFEST_RETENTION_STATUS_IDS = Object.freeze({
  INVALID_INPUT: 'invalid_input',
  MISSING_GITHUB_TOKEN: 'missing_github_token',
  GITHUB_PACKAGE_PAGE_LIMIT_REACHED: 'github_package_page_limit_reached',
  GHCR_MANIFEST_REQUEST_LIMIT_REACHED: 'ghcr_manifest_request_limit_reached',
  GHCR_MANIFEST_DIGEST_MISSING: 'ghcr_manifest_digest_missing',
  GHCR_MANIFEST_DESCRIPTOR_INVALID: 'ghcr_manifest_descriptor_invalid',
});

export class GhcrManifestRetentionInventoryError extends Error {
  constructor(statusId) {
    super(statusId);
    this.name = 'GhcrManifestRetentionInventoryError';
    this.statusId = statusId;
  }
}

function inventoryError(statusId) {
  return new GhcrManifestRetentionInventoryError(statusId);
}

function asNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function sortStrings(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function isSha256Digest(value) {
  return SHA256_DIGEST_PATTERN.test(String(value || ''));
}

function normalizeDigest(value) {
  const normalized = asNonEmptyString(value)?.toLowerCase() || null;
  return isSha256Digest(normalized) ? normalized : null;
}

export function assertRepositoryComponent(value, label) {
  const normalized = asNonEmptyString(value);
  if (!normalized || normalized !== normalized.toLowerCase() || !REPOSITORY_COMPONENT_PATTERN.test(normalized)) {
    throw inventoryError(`${GHCR_MANIFEST_RETENTION_STATUS_IDS.INVALID_INPUT}:${label}`);
  }
  return normalized;
}

function assertHttpsBaseUrl(value, label) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw inventoryError(`${GHCR_MANIFEST_RETENTION_STATUS_IDS.INVALID_INPUT}:${label}`);
  }

  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw inventoryError(`${GHCR_MANIFEST_RETENTION_STATUS_IDS.INVALID_INPUT}:${label}`);
  }

  return parsed.toString().replace(/\/$/u, '');
}

function buildUrl(baseUrl, pathname, searchParameters = {}) {
  const url = new URL(pathname, `${baseUrl}/`);
  for (const [name, value] of Object.entries(searchParameters)) {
    url.searchParams.set(name, String(value));
  }
  return url;
}

function errorStatusId(prefix, response) {
  const status = Number.isInteger(response?.status) ? response.status : 'network';
  return `${prefix}_${status}`;
}

function normalizeHeaders(headers) {
  return headers && typeof headers.get === 'function' ? headers : new Headers();
}

async function readJson({ fetchImpl, headers, statusPrefix, url }) {
  const response = await fetchImpl(url, {
    headers,
    method: 'GET',
  });
  if (!response?.ok) {
    throw inventoryError(errorStatusId(statusPrefix, response));
  }

  try {
    return {
      headers: normalizeHeaders(response.headers),
      payload: await response.json(),
    };
  } catch {
    throw inventoryError(`${statusPrefix}_invalid_json`);
  }
}

function packageVersionTags(version) {
  const tags = version?.metadata?.container?.tags;
  if (!Array.isArray(tags)) {
    return [];
  }
  return sortStrings(tags.map(asNonEmptyString));
}

function normalizePackageVersion(version) {
  const id = Number.isSafeInteger(version?.id) ? version.id : null;
  return {
    createdAt: asNonEmptyString(version?.created_at),
    digest: normalizeDigest(version?.name),
    packageVersionId: id,
    packageVersionName: asNonEmptyString(version?.name),
    tags: packageVersionTags(version),
    updatedAt: asNonEmptyString(version?.updated_at),
    versionUrl: asNonEmptyString(version?.html_url),
  };
}

export async function listGhcrPackageVersions({
  fetchImpl = globalThis.fetch,
  githubApiBaseUrl = DEFAULT_GITHUB_API_BASE_URL,
  githubToken,
  maxPages = DEFAULT_MAX_PACKAGE_VERSION_PAGES,
  owner = DEFAULT_GHCR_OWNER,
  packageName = DEFAULT_GHCR_PACKAGE,
  pageSize = DEFAULT_PACKAGE_VERSION_PAGE_SIZE,
} = {}) {
  const apiBaseUrl = assertHttpsBaseUrl(githubApiBaseUrl, 'github_api_base_url');
  const verifiedOwner = assertRepositoryComponent(owner, 'owner');
  const verifiedPackageName = assertRepositoryComponent(packageName, 'package');
  const token = asNonEmptyString(githubToken);

  if (!token) {
    throw inventoryError(GHCR_MANIFEST_RETENTION_STATUS_IDS.MISSING_GITHUB_TOKEN);
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > DEFAULT_PACKAGE_VERSION_PAGE_SIZE) {
    throw inventoryError(`${GHCR_MANIFEST_RETENTION_STATUS_IDS.INVALID_INPUT}:page_size`);
  }
  if (!Number.isInteger(maxPages) || maxPages < 1) {
    throw inventoryError(`${GHCR_MANIFEST_RETENTION_STATUS_IDS.INVALID_INPUT}:max_pages`);
  }

  const versions = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const url = buildUrl(
      apiBaseUrl,
      `/users/${encodeURIComponent(verifiedOwner)}/packages/container/${encodeURIComponent(verifiedPackageName)}/versions`,
      { page, per_page: pageSize, state: 'active' }
    );
    const { payload } = await readJson({
      fetchImpl,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2026-03-10',
      },
      statusPrefix: 'github_package_versions',
      url,
    });
    if (!Array.isArray(payload)) {
      throw inventoryError('github_package_versions_invalid_response');
    }

    versions.push(...payload.map(normalizePackageVersion));
    if (payload.length < pageSize) {
      return versions.sort((left, right) => (left.packageVersionId || 0) - (right.packageVersionId || 0));
    }
  }

  throw inventoryError(GHCR_MANIFEST_RETENTION_STATUS_IDS.GITHUB_PACKAGE_PAGE_LIMIT_REACHED);
}

export async function requestGhcrPullToken({
  fetchImpl = globalThis.fetch,
  githubActor = DEFAULT_GHCR_OWNER,
  githubToken,
  owner = DEFAULT_GHCR_OWNER,
  packageName = DEFAULT_GHCR_PACKAGE,
  registryBaseUrl = DEFAULT_GHCR_REGISTRY_BASE_URL,
} = {}) {
  const registryBase = assertHttpsBaseUrl(registryBaseUrl, 'registry_base_url');
  const verifiedOwner = assertRepositoryComponent(owner, 'owner');
  const verifiedPackageName = assertRepositoryComponent(packageName, 'package');
  const actor = asNonEmptyString(githubActor);
  const token = asNonEmptyString(githubToken);
  if (!actor || !token) {
    throw inventoryError(GHCR_MANIFEST_RETENTION_STATUS_IDS.MISSING_GITHUB_TOKEN);
  }

  const url = buildUrl(registryBase, '/token', {
    scope: `repository:${verifiedOwner}/${verifiedPackageName}:pull`,
    service: new URL(registryBase).host,
  });
  const credentials = Buffer.from(`${actor}:${token}`, 'utf8').toString('base64');
  const { payload } = await readJson({
    fetchImpl,
    headers: {
      Authorization: `Basic ${credentials}`,
    },
    statusPrefix: 'ghcr_pull_token',
    url,
  });
  const pullToken = asNonEmptyString(payload?.token) || asNonEmptyString(payload?.access_token);
  if (!pullToken) {
    throw inventoryError('ghcr_pull_token_invalid_response');
  }
  return pullToken;
}

function normalizeDescriptor(descriptor) {
  const digest = normalizeDigest(descriptor?.digest);
  if (!digest) {
    throw inventoryError(GHCR_MANIFEST_RETENTION_STATUS_IDS.GHCR_MANIFEST_DESCRIPTOR_INVALID);
  }
  const platform = descriptor?.platform && typeof descriptor.platform === 'object'
    ? {
      architecture: asNonEmptyString(descriptor.platform.architecture),
      os: asNonEmptyString(descriptor.platform.os),
      variant: asNonEmptyString(descriptor.platform.variant),
    }
    : null;
  return {
    digest,
    mediaType: asNonEmptyString(descriptor?.mediaType),
    platform,
  };
}

async function readGhcrManifest({ fetchImpl, pullToken, reference, registryBaseUrl, repository }) {
  const url = buildUrl(
    registryBaseUrl,
    `/v2/${repository}/manifests/${encodeURIComponent(reference)}`
  );
  const { headers, payload } = await readJson({
    fetchImpl,
    headers: {
      Accept: [
        'application/vnd.oci.image.index.v1+json',
        'application/vnd.docker.distribution.manifest.list.v2+json',
        'application/vnd.oci.image.manifest.v1+json',
        'application/vnd.docker.distribution.manifest.v2+json',
      ].join(', '),
      Authorization: `Bearer ${pullToken}`,
    },
    statusPrefix: 'ghcr_manifest',
    url,
  });

  const digest = normalizeDigest(headers.get('docker-content-digest')) || normalizeDigest(reference);
  if (!digest) {
    throw inventoryError(GHCR_MANIFEST_RETENTION_STATUS_IDS.GHCR_MANIFEST_DIGEST_MISSING);
  }
  const contentType = asNonEmptyString(headers.get('content-type'))?.split(';', 1)[0] || null;
  const mediaType = asNonEmptyString(payload?.mediaType) || contentType;
  const descriptors = Array.isArray(payload?.manifests)
    ? payload.manifests.map(normalizeDescriptor)
    : [];
  const kind = descriptors.length > 0 || OCI_INDEX_MEDIA_TYPES.has(mediaType)
    ? 'index'
    : 'manifest';

  return { descriptors, digest, kind, mediaType };
}

function createNode(manifest) {
  return {
    childDigests: [],
    digest: manifest.digest,
    kind: manifest.kind,
    mediaType: manifest.mediaType,
    parentDigests: [],
    platforms: [],
    tags: [],
  };
}

function normalizeNode(node) {
  return {
    childDigests: sortStrings(node.childDigests),
    digest: node.digest,
    kind: node.kind,
    mediaType: node.mediaType,
    parentDigests: sortStrings(node.parentDigests),
    platforms: node.platforms
      .map(platform => ({
        architecture: platform.architecture,
        os: platform.os,
        variant: platform.variant,
      }))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    tags: sortStrings(node.tags),
  };
}

function recordUnresolvedReference(unresolvedReferences, reference, statusId, parentDigest = null) {
  unresolvedReferences.push({
    parentDigest,
    reference,
    statusId,
  });
}

function resolveRetainedTagsForDigest(digest, nodes, rootDigestsByTag, visitedDigests = new Set()) {
  if (!digest || visitedDigests.has(digest)) {
    return [];
  }
  visitedDigests.add(digest);

  const directlyRetainedTags = [...rootDigestsByTag.entries()]
    .filter(([, rootDigest]) => rootDigest === digest)
    .map(([tag]) => tag);
  const node = nodes.get(digest);
  if (!node) {
    return directlyRetainedTags;
  }

  return sortStrings([
    ...directlyRetainedTags,
    ...node.parentDigests.flatMap(parentDigest =>
      resolveRetainedTagsForDigest(parentDigest, nodes, rootDigestsByTag, new Set(visitedDigests))
    ),
  ]);
}

export async function collectGhcrManifestGraph({
  fetchImpl = globalThis.fetch,
  maxManifestRequests = DEFAULT_MAX_MANIFEST_REQUESTS,
  pullToken,
  registryBaseUrl = DEFAULT_GHCR_REGISTRY_BASE_URL,
  repository,
  tags = [],
} = {}) {
  const registryBase = assertHttpsBaseUrl(registryBaseUrl, 'registry_base_url');
  const verifiedRepository = asNonEmptyString(repository);
  const token = asNonEmptyString(pullToken);
  if (!verifiedRepository || !token || !Number.isInteger(maxManifestRequests) || maxManifestRequests < 1) {
    throw inventoryError(`${GHCR_MANIFEST_RETENTION_STATUS_IDS.INVALID_INPUT}:manifest_graph`);
  }

  const nodes = new Map();
  const unresolvedReferences = [];
  const rootDigestsByTag = new Map();
  let manifestRequestCount = 0;

  async function visit(reference, { parentDigest = null, tag = null } = {}) {
    if (manifestRequestCount >= maxManifestRequests) {
      throw inventoryError(GHCR_MANIFEST_RETENTION_STATUS_IDS.GHCR_MANIFEST_REQUEST_LIMIT_REACHED);
    }
    manifestRequestCount += 1;
    const manifest = await readGhcrManifest({
      fetchImpl,
      pullToken: token,
      reference,
      registryBaseUrl: registryBase,
      repository: verifiedRepository,
    });

    let node = nodes.get(manifest.digest);
    if (!node) {
      node = createNode(manifest);
      nodes.set(manifest.digest, node);
    }
    if (parentDigest) {
      node.parentDigests.push(parentDigest);
    }
    if (tag) {
      node.tags.push(tag);
      rootDigestsByTag.set(tag, manifest.digest);
    }

    if (node.childDigests.length > 0 || manifest.descriptors.length === 0) {
      return manifest.digest;
    }

    for (const descriptor of manifest.descriptors) {
      node.childDigests.push(descriptor.digest);
      if (descriptor.platform) {
        node.platforms.push(descriptor.platform);
      }
      try {
        await visit(descriptor.digest, { parentDigest: manifest.digest });
      } catch (error) {
        recordUnresolvedReference(
          unresolvedReferences,
          descriptor.digest,
          error?.statusId || 'ghcr_manifest_unknown_error',
          manifest.digest
        );
      }
    }
    return manifest.digest;
  }

  const discoveredTags = sortStrings(tags.map(asNonEmptyString));
  for (const tag of discoveredTags) {
    try {
      await visit(tag, { tag });
    } catch (error) {
      recordUnresolvedReference(
        unresolvedReferences,
        tag,
        error?.statusId || 'ghcr_manifest_unknown_error'
      );
    }
  }

  const normalizedNodes = [...nodes.values()]
    .map(normalizeNode)
    .sort((left, right) => left.digest.localeCompare(right.digest));
  const normalizedUnresolvedReferences = unresolvedReferences
    .map(unresolved => ({
      ...unresolved,
      retainedTags: unresolved.parentDigest
        ? resolveRetainedTagsForDigest(unresolved.parentDigest, nodes, rootDigestsByTag)
        : discoveredTags.includes(unresolved.reference) ? [unresolved.reference] : [],
    }))
    .sort((left, right) => `${left.parentDigest || ''}:${left.reference}`.localeCompare(`${right.parentDigest || ''}:${right.reference}`));
  const incompleteRetainedTags = sortStrings(
    normalizedUnresolvedReferences.flatMap(unresolved => unresolved.retainedTags)
  );

  return {
    complete: normalizedUnresolvedReferences.length === 0 && rootDigestsByTag.size === discoveredTags.length,
    incompleteRetainedTags,
    manifestRequestCount,
    manifests: normalizedNodes,
    rootDigestsByTag: Object.fromEntries(
      [...rootDigestsByTag.entries()].sort(([left], [right]) => left.localeCompare(right))
    ),
    unresolvedReferences: normalizedUnresolvedReferences,
  };
}

function buildProtectedDigestReasons(graph) {
  const protectedDigests = new Map();
  const rootDigestSet = new Set(Object.values(graph.rootDigestsByTag));
  for (const manifest of graph.manifests) {
    protectedDigests.set(
      manifest.digest,
      rootDigestSet.has(manifest.digest) ? 'tagged_root_manifest' : 'referenced_child_manifest'
    );
  }
  return protectedDigests;
}

function classifyPackageVersions(packageVersions, graph) {
  const protectedDigests = buildProtectedDigestReasons(graph);
  return packageVersions.map(version => {
    if (version.tags.length > 0) {
      return {
        ...version,
        retentionStatus: 'protected',
        retentionReasons: ['tagged_package_version'],
      };
    }
    const protectedReason = version.digest ? protectedDigests.get(version.digest) : null;
    if (protectedReason) {
      return {
        ...version,
        retentionStatus: 'protected',
        retentionReasons: [protectedReason],
      };
    }
    if (!version.digest) {
      return {
        ...version,
        retentionStatus: 'manual_review_required',
        retentionReasons: ['package_version_digest_unavailable'],
      };
    }
    if (!graph.complete) {
      return {
        ...version,
        retentionStatus: 'manual_review_required',
        retentionReasons: ['registry_graph_incomplete'],
      };
    }
    return {
      ...version,
      retentionStatus: 'manual_review_required',
      retentionReasons: ['untagged_unreferenced_package_version'],
    };
  });
}

export async function createGhcrManifestRetentionInventory({
  fetchImpl = globalThis.fetch,
  generatedAt = new Date().toISOString(),
  githubActor = DEFAULT_GHCR_OWNER,
  githubApiBaseUrl = DEFAULT_GITHUB_API_BASE_URL,
  githubToken,
  maxManifestRequests = DEFAULT_MAX_MANIFEST_REQUESTS,
  maxPackageVersionPages = DEFAULT_MAX_PACKAGE_VERSION_PAGES,
  owner = DEFAULT_GHCR_OWNER,
  packageName = DEFAULT_GHCR_PACKAGE,
  registryBaseUrl = DEFAULT_GHCR_REGISTRY_BASE_URL,
} = {}) {
  const verifiedOwner = assertRepositoryComponent(owner, 'owner');
  const verifiedPackageName = assertRepositoryComponent(packageName, 'package');
  const token = asNonEmptyString(githubToken);
  if (!token) {
    throw inventoryError(GHCR_MANIFEST_RETENTION_STATUS_IDS.MISSING_GITHUB_TOKEN);
  }

  const packageVersions = await listGhcrPackageVersions({
    fetchImpl,
    githubApiBaseUrl,
    githubToken: token,
    maxPages: maxPackageVersionPages,
    owner: verifiedOwner,
    packageName: verifiedPackageName,
  });
  const tags = sortStrings(packageVersions.flatMap(version => version.tags));
  const pullToken = await requestGhcrPullToken({
    fetchImpl,
    githubActor,
    githubToken: token,
    owner: verifiedOwner,
    packageName: verifiedPackageName,
    registryBaseUrl,
  });
  const graph = await collectGhcrManifestGraph({
    fetchImpl,
    maxManifestRequests,
    pullToken,
    registryBaseUrl,
    repository: `${verifiedOwner}/${verifiedPackageName}`,
    tags,
  });
  const classifiedPackageVersions = classifyPackageVersions(packageVersions, graph);
  const manualReviewRequired = classifiedPackageVersions
    .filter(version => version.retentionStatus === 'manual_review_required')
    .map(version => ({
      digest: version.digest,
      packageVersionId: version.packageVersionId,
      retentionReasons: version.retentionReasons,
      tags: version.tags,
      updatedAt: version.updatedAt,
      versionUrl: version.versionUrl,
    }));

  return {
    generatedAt,
    manifestGraph: graph,
    manualReviewRequired,
    operatorBoundary: {
      allowedMethods: ['GET'],
      deletionCommandsPresent: false,
      deletionEligibleArtifacts: 0,
      mode: 'read_only_manual_review',
    },
    package: {
      name: verifiedPackageName,
      owner: verifiedOwner,
      packageVersions: classifiedPackageVersions,
    },
    schemaVersion: GHCR_MANIFEST_RETENTION_INVENTORY_SCHEMA_VERSION,
    summary: {
      incompleteRetainedTagCount: graph.incompleteRetainedTags.length,
      manifestCount: graph.manifests.length,
      manualReviewRequiredCount: manualReviewRequired.length,
      protectedPackageVersionCount: classifiedPackageVersions.filter(version => version.retentionStatus === 'protected').length,
      retainedTagCount: tags.length,
      unresolvedReferenceCount: graph.unresolvedReferences.length,
    },
  };
}
