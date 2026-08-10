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

import {
  DEFAULT_GITHUB_API_BASE_URL,
  GHCR_MANIFEST_RETENTION_INVENTORY_SCHEMA_VERSION,
} from './ghcrManifestRetentionInventory.mjs';

const RELEASE_TAG_PATTERN = /^v\d+\.\d+\.\d+(?:[a-z0-9.-]+)?$/iu;
const GITHUB_REPOSITORY_COMPONENT_PATTERN = /^[A-Za-z0-9_.-]+$/u;
const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/iu;

export const DEFAULT_GITHUB_RELEASE_OWNER = 'cloudbyday90';
export const DEFAULT_GITHUB_RELEASE_REPOSITORY = 'Classifarr';
export const PUBLISHED_IMAGE_RELEASE_RETIREMENT_PLAN_SCHEMA_VERSION =
  'published_image_release_retirement_plan.v1';

export const PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS = Object.freeze({
  INVALID_INPUT: 'invalid_input',
  INVENTORY_GRAPH_COMPLETE: 'inventory_graph_complete',
  INVENTORY_TAG_NOT_INCOMPLETE: 'inventory_tag_not_incomplete',
  INVENTORY_UNRESOLVED_REFERENCE_MISSING: 'inventory_unresolved_reference_missing',
  INVALID_INVENTORY: 'invalid_inventory',
  MISSING_GITHUB_TOKEN: 'missing_github_token',
  RELEASE_NOT_FOUND: 'release_not_found',
});

export class PublishedImageReleaseRetirementError extends Error {
  constructor(statusId) {
    super(statusId);
    this.name = 'PublishedImageReleaseRetirementError';
    this.statusId = statusId;
  }
}

function retirementError(statusId) {
  return new PublishedImageReleaseRetirementError(statusId);
}

function asNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function assertGithubRepositoryComponent(value, label) {
  const normalized = asNonEmptyString(value);
  if (!normalized || !GITHUB_REPOSITORY_COMPONENT_PATTERN.test(normalized)) {
    throw retirementError(`${PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS.INVALID_INPUT}:${label}`);
  }
  return normalized;
}

export function assertReleaseTag(value) {
  const tag = asNonEmptyString(value);
  if (!tag || !RELEASE_TAG_PATTERN.test(tag)) {
    throw retirementError(`${PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS.INVALID_INPUT}:tag`);
  }
  return tag;
}

function assertGithubApiBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw retirementError(`${PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS.INVALID_INPUT}:github_api_base_url`);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw retirementError(`${PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS.INVALID_INPUT}:github_api_base_url`);
  }
  return url.toString().replace(/\/$/u, '');
}

function assertInventory(inventory, tag) {
  if (!inventory || typeof inventory !== 'object' || Array.isArray(inventory)) {
    throw retirementError(PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS.INVALID_INVENTORY);
  }
  if (inventory.schemaVersion !== GHCR_MANIFEST_RETENTION_INVENTORY_SCHEMA_VERSION) {
    throw retirementError(PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS.INVALID_INVENTORY);
  }
  if (inventory.operatorBoundary?.mode !== 'read_only_manual_review' ||
    inventory.operatorBoundary?.deletionEligibleArtifacts !== 0) {
    throw retirementError(PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS.INVALID_INVENTORY);
  }
  if (inventory.manifestGraph?.complete) {
    throw retirementError(PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS.INVENTORY_GRAPH_COMPLETE);
  }
  if (!Array.isArray(inventory.manifestGraph?.incompleteRetainedTags) ||
    !inventory.manifestGraph.incompleteRetainedTags.includes(tag)) {
    throw retirementError(PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS.INVENTORY_TAG_NOT_INCOMPLETE);
  }

  const unresolvedReferences = Array.isArray(inventory.manifestGraph?.unresolvedReferences)
    ? inventory.manifestGraph.unresolvedReferences.filter(reference =>
      Array.isArray(reference?.retainedTags) && reference.retainedTags.includes(tag)
    )
    : [];
  if (unresolvedReferences.length === 0) {
    throw retirementError(PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS.INVENTORY_UNRESOLVED_REFERENCE_MISSING);
  }

  const rootDigest = inventory.manifestGraph?.rootDigestsByTag?.[tag];
  if (!SHA256_DIGEST_PATTERN.test(String(rootDigest || ''))) {
    throw retirementError(PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS.INVALID_INVENTORY);
  }

  const packageName = asNonEmptyString(inventory.package?.name);
  const packageOwner = asNonEmptyString(inventory.package?.owner);
  if (!packageName || !packageOwner) {
    throw retirementError(PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS.INVALID_INVENTORY);
  }

  return {
    generatedAt: asNonEmptyString(inventory.generatedAt),
    packageName,
    packageOwner,
    rootDigest: rootDigest.toLowerCase(),
    unresolvedReferences: unresolvedReferences.map(reference => ({
      parentDigest: asNonEmptyString(reference.parentDigest),
      reference: asNonEmptyString(reference.reference),
      statusId: asNonEmptyString(reference.statusId),
    })),
  };
}

export async function getGithubReleaseByTag({
  fetchImpl = globalThis.fetch,
  githubApiBaseUrl = DEFAULT_GITHUB_API_BASE_URL,
  githubToken,
  owner = DEFAULT_GITHUB_RELEASE_OWNER,
  repository = DEFAULT_GITHUB_RELEASE_REPOSITORY,
  tag,
} = {}) {
  const apiBaseUrl = assertGithubApiBaseUrl(githubApiBaseUrl);
  const verifiedOwner = assertGithubRepositoryComponent(owner, 'owner');
  const verifiedRepository = assertGithubRepositoryComponent(repository, 'repository');
  const verifiedTag = assertReleaseTag(tag);
  const token = asNonEmptyString(githubToken);
  if (!token) {
    throw retirementError(PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS.MISSING_GITHUB_TOKEN);
  }

  const url = new URL(
    `/repos/${encodeURIComponent(verifiedOwner)}/${encodeURIComponent(verifiedRepository)}/releases/tags/${encodeURIComponent(verifiedTag)}`,
    `${apiBaseUrl}/`
  );
  const response = await fetchImpl(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2026-03-10',
    },
    method: 'GET',
  });
  if (response?.status === 404) {
    throw retirementError(PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS.RELEASE_NOT_FOUND);
  }
  if (!response?.ok) {
    throw retirementError(`github_release_${Number.isInteger(response?.status) ? response.status : 'network'}`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw retirementError('github_release_invalid_json');
  }
  if (payload?.tag_name !== verifiedTag) {
    throw retirementError('github_release_tag_mismatch');
  }

  return {
    isDraft: Boolean(payload.draft),
    isImmutable: Boolean(payload.immutable),
    isPrerelease: Boolean(payload.prerelease),
    name: asNonEmptyString(payload.name),
    publishedAt: asNonEmptyString(payload.published_at),
    targetCommitish: asNonEmptyString(payload.target_commitish),
    url: asNonEmptyString(payload.html_url),
  };
}

export async function createPublishedImageReleaseRetirementPlan({
  fetchImpl = globalThis.fetch,
  generatedAt = new Date().toISOString(),
  githubApiBaseUrl = DEFAULT_GITHUB_API_BASE_URL,
  githubToken,
  inventory,
  owner = DEFAULT_GITHUB_RELEASE_OWNER,
  repository = DEFAULT_GITHUB_RELEASE_REPOSITORY,
  tag,
} = {}) {
  const verifiedTag = assertReleaseTag(tag);
  const inventoryEvidence = assertInventory(inventory, verifiedTag);
  const release = await getGithubReleaseByTag({
    fetchImpl,
    githubApiBaseUrl,
    githubToken,
    owner,
    repository,
    tag: verifiedTag,
  });

  return {
    generatedAt,
    operatorBoundary: {
      allowedMethods: ['GET'],
      packageVersionDeletionAuthorized: false,
      registryMutationAuthorized: false,
      releaseMutationAuthorized: false,
      mode: 'read_only_retirement_assessment',
    },
    recommendation: {
      disposition: release.isImmutable
        ? 'immutable_release_requires_external_advisory'
        : 'mutable_release_requires_explicit_annotation_approval',
      doNotRepublishTag: true,
      doNotUseGenericPackageDeletion: true,
      remoteRetirementRequiresSeparateApproval: true,
    },
    schemaVersion: PUBLISHED_IMAGE_RELEASE_RETIREMENT_PLAN_SCHEMA_VERSION,
    target: {
      image: {
        digest: inventoryEvidence.rootDigest,
        package: `${inventoryEvidence.packageOwner}/${inventoryEvidence.packageName}`,
        unresolvedReferences: inventoryEvidence.unresolvedReferences,
      },
      inventoryGeneratedAt: inventoryEvidence.generatedAt,
      release,
      tag: verifiedTag,
    },
  };
}
