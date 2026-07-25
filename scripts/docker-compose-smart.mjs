#!/usr/bin/env node
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

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { resolve } from 'node:path';

import {
  LOCAL_DOCKER_BUILD_PROVENANCE_STATUS_IDS,
  resolveVerifiedLocalDockerBuildProvenance,
} from './lib/localDockerBuildProvenance.mjs';

const VALID_BUILDS = new Set(['multi', 'generic', 'avx', 'avx2']);
const COMPOSE_COMMANDS = new Set([
  'attach',
  'build',
  'config',
  'cp',
  'create',
  'down',
  'events',
  'exec',
  'images',
  'kill',
  'logs',
  'ls',
  'pause',
  'port',
  'ps',
  'pull',
  'push',
  'restart',
  'rm',
  'run',
  'start',
  'stop',
  'top',
  'unpause',
  'up',
  'version',
  'wait',
  'watch'
]);

function hasWord(text, word) {
  return new RegExp(`\\b${word}\\b`, 'i').test(text);
}

function detectFromFeatureText(text, source) {
  return {
    hasAvx: hasWord(text, 'avx'),
    hasAvx2: hasWord(text, 'avx2'),
    source
  };
}

function tryExecFile(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
  } catch (_error) {
    return null;
  }
}

function detectLinuxCpu() {
  try {
    const cpuInfo = fs.readFileSync('/proc/cpuinfo', 'utf8');
    return detectFromFeatureText(cpuInfo, 'linux:/proc/cpuinfo');
  } catch (_error) {
    return null;
  }
}

function detectMacCpu() {
  const featureText = tryExecFile('sysctl', ['-n', 'machdep.cpu.features', 'machdep.cpu.leaf7_features']);
  if (!featureText) {
    return null;
  }

  return detectFromFeatureText(featureText, 'darwin:sysctl');
}

function detectWindowsCpu() {
  const powershellCommands = ['pwsh', 'powershell'];
  const psScript = [
    '$result = [pscustomobject]@{',
    '  avx = [bool]([System.Runtime.Intrinsics.X86.Avx]::IsSupported);',
    '  avx2 = [bool]([System.Runtime.Intrinsics.X86.Avx2]::IsSupported)',
    '};',
    '$result | ConvertTo-Json -Compress'
  ].join(' ');

  for (const command of powershellCommands) {
    const output = tryExecFile(command, ['-NoProfile', '-Command', psScript]);
    if (!output) {
      continue;
    }

    try {
      const parsed = JSON.parse(output);
      return {
        hasAvx: Boolean(parsed.avx),
        hasAvx2: Boolean(parsed.avx2),
        source: `windows:${command}`
      };
    } catch (_error) {
      continue;
    }
  }

  return null;
}

function detectCpuCapabilities() {
  switch (process.platform) {
    case 'linux':
      return detectLinuxCpu() || { hasAvx: null, hasAvx2: null, source: 'unknown' };
    case 'darwin':
      return detectMacCpu() || { hasAvx: null, hasAvx2: null, source: 'unknown' };
    case 'win32':
      return detectWindowsCpu() || { hasAvx: null, hasAvx2: null, source: 'unknown' };
    default:
      return { hasAvx: null, hasAvx2: null, source: `unsupported:${process.platform}` };
  }
}

function resolveBuildOverride() {
  const explicit = process.env.PGVECTOR_BUILD || process.env.CLASSIFARR_PGVECTOR_BUILD;
  if (!explicit) {
    return null;
  }

  if (!VALID_BUILDS.has(explicit)) {
    console.error(
      `Invalid PGVECTOR_BUILD override "${explicit}". Expected one of: ${[...VALID_BUILDS].join(', ')}`
    );
    process.exit(1);
  }

  return explicit;
}

function resolvePgvectorBuild(cpu, override) {
  if (override) {
    return {
      build: override,
      reason: 'env override'
    };
  }

  if (cpu.hasAvx2 === true) {
    return {
      build: 'avx2',
      reason: `detected AVX2 support via ${cpu.source}`
    };
  }

  if (cpu.hasAvx === true) {
    return {
      build: 'avx',
      reason: `detected AVX support via ${cpu.source}`
    };
  }

  if (cpu.hasAvx === false && cpu.hasAvx2 === false) {
    return {
      build: 'generic',
      reason: `no AVX support detected via ${cpu.source}`
    };
  }

  return {
    build: 'multi',
    reason: `CPU capability unavailable via ${cpu.source}`
  };
}

function findComposeCommandIndex(args) {
  return args.findIndex(argument => COMPOSE_COMMANDS.has(argument));
}

function injectBuildFlagForUp(args, commandIndex) {
  if (commandIndex === -1 || args[commandIndex] !== 'up') {
    return args;
  }

  const hasBuildFlag = args.includes('--build');
  const hasNoBuildFlag = args.includes('--no-build');
  if (hasBuildFlag || hasNoBuildFlag) {
    return args;
  }

  const nextArgs = [...args];
  nextArgs.splice(commandIndex + 1, 0, '--build');
  return nextArgs;
}

function commandBuildsImage(args, commandIndex) {
  if (commandIndex === -1) {
    return false;
  }

  const composeCommand = args[commandIndex];
  if (composeCommand === 'build') {
    return true;
  }

  return composeCommand === 'up' && !args.includes('--no-build');
}

function parseCliArgs(rawArgs) {
  const args = [...rawArgs];
  const dryRunIndex = args.indexOf('--dry-run');
  const dryRun = dryRunIndex !== -1;

  if (dryRun) {
    args.splice(dryRunIndex, 1);
  }

  const requireProvenanceIndex = args.indexOf('--require-provenance');
  const requireProvenance = requireProvenanceIndex !== -1;

  if (requireProvenance) {
    args.splice(requireProvenanceIndex, 1);
  }

  return { args, dryRun, requireProvenance };
}

function resolveBuildProvenance({ commandBuilds, requireProvenance }) {
  if (!commandBuilds) {
    if (requireProvenance) {
      throw new Error('--require-provenance requires a Compose build or up command.');
    }
    return null;
  }

  const provenance = resolveVerifiedLocalDockerBuildProvenance();
  if (
    requireProvenance &&
    provenance.statusId !== LOCAL_DOCKER_BUILD_PROVENANCE_STATUS_IDS.VERIFIED
  ) {
    throw new Error(`Cannot build a provenance-verified image: ${provenance.message}`);
  }

  return provenance;
}

function main() {
  const {
    args: rawComposeArgs,
    dryRun,
    requireProvenance,
  } = parseCliArgs(process.argv.slice(2));
  const composeArgs = rawComposeArgs.length > 0 ? rawComposeArgs : ['up', '-d'];
  const commandIndex = findComposeCommandIndex(composeArgs);
  const adjustedComposeArgs = injectBuildFlagForUp(composeArgs, commandIndex);

  const cpu = detectCpuCapabilities();
  const buildOverride = resolveBuildOverride();
  const resolution = resolvePgvectorBuild(cpu, buildOverride);
  let provenance;

  try {
    provenance = resolveBuildProvenance({
      commandBuilds: commandBuildsImage(adjustedComposeArgs, commandIndex),
      requireProvenance,
    });
  } catch (error) {
    console.error(`[smart-compose] ${error.message}`);
    process.exit(1);
  }

  console.log(
    `[smart-compose] CPU detection: avx=${cpu.hasAvx ?? 'unknown'} avx2=${cpu.hasAvx2 ?? 'unknown'} source=${cpu.source}`
  );
  console.log(`[smart-compose] Using PGVECTOR_BUILD=${resolution.build} (${resolution.reason})`);
  if (provenance?.revision) {
    console.log(`[smart-compose] Using VCS_REF=${provenance.revision} (clean checkout)`);
  } else if (provenance) {
    console.warn(
      `[smart-compose] VCS_REF=unknown: ${provenance.message} Maintenance evidence will refuse this image.`
    );
  }
  console.log(`[smart-compose] Running: docker compose ${adjustedComposeArgs.join(' ')}`);

  if (dryRun) {
    return;
  }

  const result = spawnSync('docker', ['compose', ...adjustedComposeArgs], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PGVECTOR_BUILD: resolution.build,
      ...(provenance ? { VCS_REF: provenance.revision || 'unknown' } : {}),
    }
  });

  if (result.error) {
    console.error(`[smart-compose] Failed to run docker compose: ${result.error.message}`);
    process.exit(1);
  }

  process.exit(result.status === null ? 1 : result.status);
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  main();
}
