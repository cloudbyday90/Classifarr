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

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  GHCR_MANIFEST_RETENTION_INVENTORY_SCHEMA_VERSION,
} from '../../../../scripts/lib/ghcrManifestRetentionInventory.mjs';
import {
  PUBLISHED_IMAGE_RELEASE_RETIREMENT_PLAN_SCHEMA_VERSION,
  PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS,
  createPublishedImageReleaseRetirementPlan,
  getGithubReleaseByTag,
} from '../../../../scripts/lib/publishedImageReleaseRetirementPlan.mjs';
import {
  parsePublishedImageReleaseRetirementPlanCliArgs,
  resolvePublishedImageReleaseRetirementPlanOutputPath,
  writePublishedImageReleaseRetirementPlan,
} from '../../../../scripts/generate-published-image-release-retirement-plan.mjs';

const TAG = 'v0.48.0b-beta';
const ROOT_DIGEST = `sha256:${'a'.repeat(64)}`;
const MISSING_CHILD_DIGEST = `sha256:${'b'.repeat(64)}`;

function buildInventory({ complete = false, incompleteTags = [TAG] } = {}) {
  return {
    generatedAt: '2026-08-10T12:00:00.000Z',
    manifestGraph: {
      complete,
      incompleteRetainedTags: incompleteTags,
      rootDigestsByTag: { [TAG]: ROOT_DIGEST },
      unresolvedReferences: [{
        parentDigest: ROOT_DIGEST,
        reference: MISSING_CHILD_DIGEST,
        retainedTags: [TAG],
        statusId: 'ghcr_manifest_404',
      }],
    },
    operatorBoundary: {
      allowedMethods: ['GET'],
      deletionEligibleArtifacts: 0,
      mode: 'read_only_manual_review',
    },
    package: {
      name: 'classifarr',
      owner: 'cloudbyday90',
    },
    schemaVersion: GHCR_MANIFEST_RETENTION_INVENTORY_SCHEMA_VERSION,
  };
}

function jsonResponse(payload, { status = 200 } = {}) {
  return new Response(JSON.stringify(payload), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

function createGithubReleaseFetchMock({ immutable = true, status = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({
      headers: Object.fromEntries(new Headers(options.headers).entries()),
      method: options.method,
      pathname: new URL(url).pathname,
    });
    return jsonResponse({
      draft: false,
      html_url: `https://github.com/cloudbyday90/Classifarr/releases/tag/${TAG}`,
      immutable,
      name: TAG,
      prerelease: true,
      published_at: '2026-08-09T12:00:00Z',
      tag_name: TAG,
      target_commitish: '8db2adec',
    }, { status });
  };
  return { calls, fetchImpl };
}

describe('publishedImageReleaseRetirementPlan', () => {
  test('produces a GET-only plan for an incomplete graph bound to an immutable release', async () => {
    const { calls, fetchImpl } = createGithubReleaseFetchMock();

    const plan = await createPublishedImageReleaseRetirementPlan({
      fetchImpl,
      generatedAt: '2026-08-10T12:01:00.000Z',
      githubToken: 'test-github-token',
      inventory: buildInventory(),
      tag: TAG,
    });

    expect(plan).toEqual(expect.objectContaining({
      generatedAt: '2026-08-10T12:01:00.000Z',
      operatorBoundary: {
        allowedMethods: ['GET'],
        mode: 'read_only_retirement_assessment',
        packageVersionDeletionAuthorized: false,
        registryMutationAuthorized: false,
        releaseMutationAuthorized: false,
      },
      recommendation: {
        disposition: 'immutable_release_requires_external_advisory',
        doNotRepublishTag: true,
        doNotUseGenericPackageDeletion: true,
        remoteRetirementRequiresSeparateApproval: true,
      },
      schemaVersion: PUBLISHED_IMAGE_RELEASE_RETIREMENT_PLAN_SCHEMA_VERSION,
    }));
    expect(plan.target).toEqual(expect.objectContaining({
      image: expect.objectContaining({
        digest: ROOT_DIGEST,
        package: 'cloudbyday90/classifarr',
        unresolvedReferences: [{
          parentDigest: ROOT_DIGEST,
          reference: MISSING_CHILD_DIGEST,
          statusId: 'ghcr_manifest_404',
        }],
      }),
      release: expect.objectContaining({
        isImmutable: true,
        targetCommitish: '8db2adec',
      }),
      tag: TAG,
    }));
    expect(calls).toEqual([expect.objectContaining({
      method: 'GET',
      pathname: `/repos/cloudbyday90/Classifarr/releases/tags/${TAG}`,
    })]);
    expect(JSON.stringify(plan)).not.toContain('test-github-token');
  });

  test('rejects a complete graph before it makes a release request', async () => {
    const { calls, fetchImpl } = createGithubReleaseFetchMock();

    await expect(createPublishedImageReleaseRetirementPlan({
      fetchImpl,
      githubToken: 'test-github-token',
      inventory: buildInventory({ complete: true }),
      tag: TAG,
    })).rejects.toMatchObject({
      statusId: PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS.INVENTORY_GRAPH_COMPLETE,
    });

    expect(calls).toEqual([]);
  });

  test('fails closed when the release cannot be read', async () => {
    const { fetchImpl } = createGithubReleaseFetchMock({ status: 404 });

    await expect(getGithubReleaseByTag({
      fetchImpl,
      githubToken: 'test-github-token',
      tag: TAG,
    })).rejects.toMatchObject({
      statusId: PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS.RELEASE_NOT_FOUND,
    });
  });

  test('accepts npm configuration forwarding and only a tag under the fixed local root', () => {
    const cwd = process.cwd();
    const options = parsePublishedImageReleaseRetirementPlanCliArgs([], {
      cwd,
      environment: {
        GH_TOKEN: 'test-github-token',
        npm_config_tag: TAG,
      },
    });

    expect(options).toEqual(expect.objectContaining({
      outputPath: resolvePublishedImageReleaseRetirementPlanOutputPath({ cwd, tag: TAG }),
      tag: TAG,
    }));
    expect(() => parsePublishedImageReleaseRetirementPlanCliArgs(['--output', 'C:\\temp\\plan.json'], {
      cwd,
      environment: { GH_TOKEN: 'test-github-token' },
    })).toThrow(PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS.INVALID_INPUT);
    expect(() => parsePublishedImageReleaseRetirementPlanCliArgs(['--tag', TAG], {
      cwd,
      environment: {},
    })).toThrow(PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS.MISSING_GITHUB_TOKEN);
    expect(() => parsePublishedImageReleaseRetirementPlanCliArgs(['--tag', TAG], {
      cwd,
      environment: {
        GH_TOKEN: 'test-github-token',
        npm_config_tag: 'v0.48.0c-beta',
      },
    })).toThrow(PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS.INVALID_INPUT);
  });

  test('writes plan evidence only beneath the local temporary assessment root', () => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'classifarr-retirement-plan-'));
    const outputPath = resolvePublishedImageReleaseRetirementPlanOutputPath({
      cwd: fixtureRoot,
      tag: TAG,
    });

    try {
      writePublishedImageReleaseRetirementPlan({
        cwd: fixtureRoot,
        outputPath,
        plan: { schemaVersion: PUBLISHED_IMAGE_RELEASE_RETIREMENT_PLAN_SCHEMA_VERSION },
      });

      expect(JSON.parse(fs.readFileSync(outputPath, 'utf8'))).toEqual({
        schemaVersion: PUBLISHED_IMAGE_RELEASE_RETIREMENT_PLAN_SCHEMA_VERSION,
      });
      expect(() => writePublishedImageReleaseRetirementPlan({
        cwd: fixtureRoot,
        outputPath: path.join(os.tmpdir(), 'outside-plan.json'),
        plan: {},
      })).toThrow(PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS.INVALID_INPUT);
    } finally {
      fs.rmSync(fixtureRoot, { force: true, recursive: true });
    }
  });
});
