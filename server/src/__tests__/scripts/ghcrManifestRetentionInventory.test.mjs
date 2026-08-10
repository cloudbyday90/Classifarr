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
  GHCR_MANIFEST_RETENTION_INVENTORY_SCHEMA_VERSION,
  createGhcrManifestRetentionInventory,
} from '../../../../scripts/lib/ghcrManifestRetentionInventory.mjs';
import {
  parseGhcrManifestRetentionInventoryCliArgs,
  resolveGhcrRetentionInventoryOutputPath,
} from '../../../../scripts/generate-ghcr-manifest-retention-inventory.mjs';

const DIGESTS = Object.freeze({
  amd64: `sha256:${'a'.repeat(64)}`,
  arm64: `sha256:${'b'.repeat(64)}`,
  index: `sha256:${'c'.repeat(64)}`,
  orphan: `sha256:${'d'.repeat(64)}`,
});

const INDEX_MEDIA_TYPE = 'application/vnd.oci.image.index.v1+json';
const MANIFEST_MEDIA_TYPE = 'application/vnd.oci.image.manifest.v1+json';

function jsonResponse(payload, { headers = {}, status = 200 } = {}) {
  return new Response(JSON.stringify(payload), {
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    status,
  });
}

function createFetchMock({ missingChildDigest = null } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const parsedUrl = new URL(url);
    calls.push({
      headers: Object.fromEntries(new Headers(options.headers).entries()),
      method: options.method,
      pathname: parsedUrl.pathname,
      search: parsedUrl.search,
    });

    if (parsedUrl.host === 'api.github.com') {
      return jsonResponse([
        {
          created_at: '2026-08-01T00:00:00Z',
          html_url: 'https://github.com/cloudbyday90/packages/container/classifarr/100',
          id: 100,
          metadata: { container: { tags: ['latest', 'v0.48.0c-beta'] } },
          name: DIGESTS.index,
          updated_at: '2026-08-01T00:00:00Z',
        },
        {
          created_at: '2026-08-01T00:00:00Z',
          html_url: 'https://github.com/cloudbyday90/packages/container/classifarr/101',
          id: 101,
          metadata: { container: { tags: [] } },
          name: DIGESTS.amd64,
          updated_at: '2026-08-01T00:00:00Z',
        },
        {
          created_at: '2026-08-01T00:00:00Z',
          html_url: 'https://github.com/cloudbyday90/packages/container/classifarr/102',
          id: 102,
          metadata: { container: { tags: [] } },
          name: DIGESTS.arm64,
          updated_at: '2026-08-01T00:00:00Z',
        },
        {
          created_at: '2026-07-01T00:00:00Z',
          html_url: 'https://github.com/cloudbyday90/packages/container/classifarr/103',
          id: 103,
          metadata: { container: { tags: [] } },
          name: DIGESTS.orphan,
          updated_at: '2026-07-01T00:00:00Z',
        },
      ]);
    }

    if (parsedUrl.pathname === '/token') {
      return jsonResponse({ token: 'registry-pull-token' });
    }

    const reference = decodeURIComponent(parsedUrl.pathname.split('/manifests/')[1] || '');
    if (reference === 'latest' || reference === 'v0.48.0c-beta') {
      return jsonResponse({
        manifests: [
          {
            digest: DIGESTS.amd64,
            mediaType: MANIFEST_MEDIA_TYPE,
            platform: { architecture: 'amd64', os: 'linux' },
          },
          {
            digest: DIGESTS.arm64,
            mediaType: MANIFEST_MEDIA_TYPE,
            platform: { architecture: 'arm64', os: 'linux' },
          },
        ],
        mediaType: INDEX_MEDIA_TYPE,
      }, {
        headers: {
          'content-type': INDEX_MEDIA_TYPE,
          'docker-content-digest': DIGESTS.index,
        },
      });
    }
    if (reference === missingChildDigest) {
      return jsonResponse({ errors: [] }, { status: 404 });
    }
    if (reference === DIGESTS.amd64 || reference === DIGESTS.arm64) {
      return jsonResponse({
        config: { digest: `sha256:${'e'.repeat(64)}` },
        mediaType: MANIFEST_MEDIA_TYPE,
      }, {
        headers: {
          'content-type': MANIFEST_MEDIA_TYPE,
          'docker-content-digest': reference,
        },
      });
    }
    return jsonResponse({ errors: [] }, { status: 404 });
  };

  return { calls, fetchImpl };
}

describe('ghcrManifestRetentionInventory', () => {
  test('protects tagged indexes and every referenced child while leaving only complete orphan graphs for manual review', async () => {
    const { calls, fetchImpl } = createFetchMock();

    const inventory = await createGhcrManifestRetentionInventory({
      fetchImpl,
      generatedAt: '2026-08-10T00:00:00.000Z',
      githubActor: 'cloudbyday90',
      githubToken: 'test-github-token',
    });

    expect(inventory).toEqual(expect.objectContaining({
      generatedAt: '2026-08-10T00:00:00.000Z',
      schemaVersion: GHCR_MANIFEST_RETENTION_INVENTORY_SCHEMA_VERSION,
      summary: {
        incompleteRetainedTagCount: 0,
        manifestCount: 3,
        manualReviewRequiredCount: 1,
        protectedPackageVersionCount: 3,
        retainedTagCount: 2,
        unresolvedReferenceCount: 0,
      },
    }));
    expect(inventory.operatorBoundary).toEqual({
      allowedMethods: ['GET'],
      deletionCommandsPresent: false,
      deletionEligibleArtifacts: 0,
      mode: 'read_only_manual_review',
    });
    expect(inventory.package.packageVersions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        digest: DIGESTS.index,
        retentionReasons: ['tagged_package_version'],
        retentionStatus: 'protected',
      }),
      expect.objectContaining({
        digest: DIGESTS.amd64,
        retentionReasons: ['referenced_child_manifest'],
        retentionStatus: 'protected',
      }),
      expect.objectContaining({
        digest: DIGESTS.arm64,
        retentionReasons: ['referenced_child_manifest'],
        retentionStatus: 'protected',
      }),
      expect.objectContaining({
        digest: DIGESTS.orphan,
        retentionReasons: ['untagged_unreferenced_package_version'],
        retentionStatus: 'manual_review_required',
      }),
    ]));
    expect(inventory.manualReviewRequired).toEqual([
      expect.objectContaining({ digest: DIGESTS.orphan, packageVersionId: 103 }),
    ]);
    expect(calls).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ method: 'DELETE' }),
    ]));
    expect(calls.every(call => call.method === 'GET')).toBe(true);
    expect(JSON.stringify(inventory)).not.toContain('test-github-token');
    expect(JSON.stringify(inventory)).not.toContain('registry-pull-token');
  });

  test('makes untagged versions review-only when a child manifest cannot be resolved', async () => {
    const { fetchImpl } = createFetchMock({ missingChildDigest: DIGESTS.arm64 });

    const inventory = await createGhcrManifestRetentionInventory({
      fetchImpl,
      githubToken: 'test-github-token',
    });

    expect(inventory.manifestGraph.complete).toBe(false);
    expect(inventory.manifestGraph.incompleteRetainedTags).toEqual(['latest', 'v0.48.0c-beta']);
    expect(inventory.summary.incompleteRetainedTagCount).toBe(2);
    expect(inventory.summary.unresolvedReferenceCount).toBe(1);
    expect(inventory.package.packageVersions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        digest: DIGESTS.arm64,
        retentionReasons: ['registry_graph_incomplete'],
        retentionStatus: 'manual_review_required',
      }),
      expect.objectContaining({
        digest: DIGESTS.orphan,
        retentionReasons: ['registry_graph_incomplete'],
        retentionStatus: 'manual_review_required',
      }),
    ]));
    expect(inventory.operatorBoundary.deletionEligibleArtifacts).toBe(0);
  });

  test('accepts only a bounded CLI contract and keeps evidence under .tmp', () => {
    const cwd = process.cwd();
    const options = parseGhcrManifestRetentionInventoryCliArgs([], {
      cwd,
      environment: { GH_TOKEN: 'test-github-token' },
    });

    expect(options).toEqual(expect.objectContaining({
      githubActor: 'cloudbyday90',
      outputPath: resolveGhcrRetentionInventoryOutputPath({
        cwd,
        owner: 'cloudbyday90',
        packageName: 'classifarr',
      }),
      owner: 'cloudbyday90',
      packageName: 'classifarr',
    }));
    expect(() => parseGhcrManifestRetentionInventoryCliArgs(['--output', 'C:\\temp\\inventory.json'], {
      cwd,
      environment: { GH_TOKEN: 'test-github-token' },
    })).toThrow('invalid_input');
    expect(() => parseGhcrManifestRetentionInventoryCliArgs([], {
      cwd,
      environment: {},
    })).toThrow('missing_github_token');
  });
});
