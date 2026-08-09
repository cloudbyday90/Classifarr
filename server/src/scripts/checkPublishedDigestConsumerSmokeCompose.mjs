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
import { resolve } from 'node:path';

import { load } from 'js-yaml';

export const DEFAULT_COMPOSE_PATH = resolve(
  import.meta.dirname,
  '../../../docker-compose.release-smoke.yml'
);

const EXPECTED_IMAGE =
  '$' + '{CLASSIFARR_RELEASE_SMOKE_IMAGE:?A published image digest is required.}';
const EXPECTED_ENVIRONMENT = Object.freeze({
  FORCE_SECURE_COOKIES: 'false',
  NODE_OPTIONS: '--max-old-space-size=1536',
  PGID: '1000',
  PGVECTOR_RUNTIME_STAGING: 'auto',
  PUID: '1000',
  TASK_QUEUE_RETENTION_DAYS: '7',
  TZ: 'UTC',
});
const EXPECTED_TMPFS = Object.freeze([
  '/tmp',
  '/var/run/postgresql:rw,noexec,nosuid,nodev,uid=1000,gid=1000,mode=770',
]);
const EXPECTED_HEALTHCHECK = Object.freeze({
  interval: '30s',
  retries: 3,
  start_period: '120s',
  timeout: '10s',
});
const EXPECTED_HEALTHCHECK_TEST = Object.freeze([
  'CMD-SHELL',
  'curl -f http://localhost:21324/health || exit 1',
]);
const EXPECTED_RUNTIME_USER = '1000:1000';

function asRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function assertExactObject(value, expected, label) {
  const actual = asRecord(value, label);
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  if (actualKeys.join(',') !== expectedKeys.join(',')) {
    throw new Error(`${label} must contain only the expected settings.`);
  }
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (actual[key] !== expectedValue) {
      throw new Error(`${label}.${key} must equal ${JSON.stringify(expectedValue)}.`);
    }
  }
}

function assertExactArray(value, expected, label) {
  if (!Array.isArray(value) || value.length !== expected.length) {
    throw new Error(`${label} must contain only the expected entries.`);
  }
  for (let index = 0; index < expected.length; index += 1) {
    if (value[index] !== expected[index]) {
      throw new Error(`${label} must contain only the expected entries.`);
    }
  }
}

function assertAbsent(value, label) {
  if (value !== undefined) {
    throw new Error(`${label} must be absent from the isolated consumer smoke service.`);
  }
}

export function loadPublishedDigestConsumerSmokeCompose(composePath = DEFAULT_COMPOSE_PATH) {
  // Tests may provide an alternate fixture; the production command uses the fixed repository file.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return load(fs.readFileSync(composePath, 'utf8'));
}

export function validatePublishedDigestConsumerSmokeCompose(compose) {
  const root = asRecord(compose, 'compose');
  const rootKeys = Object.keys(root).sort();
  if (rootKeys.join(',') !== 'services,volumes') {
    throw new Error('compose must define only the services and volumes required for the smoke project.');
  }
  const services = asRecord(root.services, 'compose.services');
  if (Object.keys(services).length !== 1 || !services.classifarr) {
    throw new Error('compose.services must define only the classifarr consumer smoke service.');
  }

  const service = asRecord(services.classifarr, 'compose.services.classifarr');
  if (service.image !== EXPECTED_IMAGE || service.pull_policy !== 'always') {
    throw new Error('The consumer smoke service must pull only the required published digest input.');
  }
  if (service.restart !== 'no' || service.read_only !== true) {
    throw new Error('The consumer smoke service must be non-restarting and read-only.');
  }
  assertAbsent(service.build, 'compose.services.classifarr.build');
  assertAbsent(service.container_name, 'compose.services.classifarr.container_name');
  assertAbsent(service.networks, 'compose.services.classifarr.networks');
  assertAbsent(service.ports, 'compose.services.classifarr.ports');
  if (service.user !== EXPECTED_RUNTIME_USER) {
    throw new Error(
      `compose.services.classifarr.user must equal ${JSON.stringify(EXPECTED_RUNTIME_USER)}.`
    );
  }
  assertExactObject(service.environment, EXPECTED_ENVIRONMENT, 'compose.services.classifarr.environment');
  assertExactArray(
    service.volumes,
    ['classifarr_release_smoke_data:/app/data'],
    'compose.services.classifarr.volumes'
  );
  assertExactArray(service.tmpfs, EXPECTED_TMPFS, 'compose.services.classifarr.tmpfs');
  assertExactArray(service.cap_drop, ['ALL'], 'compose.services.classifarr.cap_drop');
  assertAbsent(service.cap_add, 'compose.services.classifarr.cap_add');
  assertExactArray(
    service.security_opt,
    ['no-new-privileges:true'],
    'compose.services.classifarr.security_opt'
  );
  const healthcheck = asRecord(service.healthcheck, 'compose.services.classifarr.healthcheck');
  const { test: healthcheckTest, ...healthcheckSettings } = healthcheck;
  assertExactObject(
    healthcheckSettings,
    EXPECTED_HEALTHCHECK,
    'compose.services.classifarr.healthcheck'
  );
  assertExactArray(
    healthcheckTest,
    EXPECTED_HEALTHCHECK_TEST,
    'compose.services.classifarr.healthcheck.test'
  );
  assertExactObject(
    service.labels,
    { 'io.classifarr.release-smoke': 'true' },
    'compose.services.classifarr.labels'
  );

  const volumes = asRecord(root.volumes, 'compose.volumes');
  if (Object.keys(volumes).length !== 1 || volumes.classifarr_release_smoke_data !== null) {
    throw new Error('compose.volumes must define only the project-scoped smoke data volume.');
  }

  return {
    imageInput: service.image,
    serviceName: 'classifarr',
    volumeName: 'classifarr_release_smoke_data',
  };
}

function main() {
  try {
    const result = validatePublishedDigestConsumerSmokeCompose(
      loadPublishedDigestConsumerSmokeCompose()
    );
    process.stdout.write(
      `Verified published digest consumer smoke Compose contract for ${result.serviceName}.\n`
    );
  } catch (error) {
    process.stderr.write(`Published digest consumer smoke Compose check failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  main();
}
