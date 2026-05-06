import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const jestPath = resolve(__dirname, '../node_modules/jest/bin/jest.js')
export const integrationConfigFilename = 'jest.integration.config.mjs'
export const integrationConfigPath = resolve(__dirname, `../${integrationConfigFilename}`)

export function usesIntegrationConfig(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '-c' || arg === '--config') {
      const next = argv[i + 1] || ''
      if (next.includes(integrationConfigFilename)) return true
      continue
    }
    if (arg.startsWith('--config=')) {
      return arg.includes(integrationConfigFilename)
    }
  }
  return false
}

function normalizeArgPath(value) {
  return String(value || '').replace(/\\/g, '/')
}

export function isIntegrationTestPath(value) {
  return /(^|\/)src\/__tests__\/integration\//.test(normalizeArgPath(value))
}

function looksLikeTestFile(value) {
  const normalized = normalizeArgPath(value)
  return normalized.endsWith('.test.js') || normalized.endsWith('.test.mjs')
}

function collectRunTestsByPathTargets(argv) {
  const targets = []

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]

    if (arg === '--runTestsByPath') {
      let nextIndex = i + 1
      while (nextIndex < argv.length && !argv[nextIndex].startsWith('-')) {
        targets.push(argv[nextIndex])
        nextIndex += 1
      }
      i = nextIndex - 1
      continue
    }

    if (arg.startsWith('--runTestsByPath=')) {
      const value = arg.slice('--runTestsByPath='.length)
      if (value) {
        targets.push(value)
      }
    }
  }

  return targets
}

function collectPositionalTestTargets(argv) {
  return argv.filter((arg) => !arg.startsWith('-') && looksLikeTestFile(arg))
}

export function collectExplicitTestTargets(argv) {
  const runTestsByPathTargets = collectRunTestsByPathTargets(argv)
  if (runTestsByPathTargets.length > 0) {
    return runTestsByPathTargets
  }

  return collectPositionalTestTargets(argv)
}

export function resolveJestArgs(argv) {
  if (usesIntegrationConfig(argv)) {
    return [...argv]
  }

  const explicitTargets = collectExplicitTestTargets(argv)
  if (explicitTargets.length === 0) {
    return [...argv]
  }

  const integrationTargets = explicitTargets.filter(isIntegrationTestPath)
  if (integrationTargets.length === 0) {
    return [...argv]
  }

  if (integrationTargets.length !== explicitTargets.length) {
    throw new Error(
      `Cannot mix integration and non-integration test paths in one run. Split the command or rerun the integration files with -c ${integrationConfigFilename}.`
    )
  }

  return ['-c', integrationConfigPath, ...argv]
}

function isDirectExecution() {
  return Boolean(process.argv[1]) && resolve(process.argv[1]) === __filename
}

let args = []

if (isDirectExecution()) {
  try {
    args = resolveJestArgs(process.argv.slice(2))
  } catch (error) {
    console.error(`[run-jest] ${error.message}`)
    process.exit(1)
  }
}

const nodeOptions = (process.env.NODE_OPTIONS || '')
  .split(' ')
  .filter(Boolean)

const sanitizedOptions = []
for (let i = 0; i < nodeOptions.length; i += 1) {
  const option = nodeOptions[i]
  if (option === '--localstorage-file') {
    i += 1
    continue
  }
  if (option.startsWith('--localstorage-file=')) {
    continue
  }
  if (option === '--no-experimental-webstorage' || option.startsWith('--no-experimental-webstorage=')) {
    continue
  }
  sanitizedOptions.push(option)
}

// Only add --no-experimental-webstorage on Node.js v24+
const nodeMajorVersion = Number(process.versions.node.split('.')[0])
if (nodeMajorVersion >= 24 && !sanitizedOptions.includes('--no-experimental-webstorage')) {
  sanitizedOptions.push('--no-experimental-webstorage')
}

if (!sanitizedOptions.includes('--experimental-vm-modules')) {
  sanitizedOptions.push('--experimental-vm-modules')
}

process.env.NODE_OPTIONS = sanitizedOptions.join(' ')

if (usesIntegrationConfig(args)) {
  if (!process.env.CLASSIFARR_INTEGRATION_RUN_ID) {
    process.env.CLASSIFARR_INTEGRATION_RUN_ID = randomUUID()
  }
  if (!process.env.CLASSIFARR_INTEGRATION_RUNTIME_FILE) {
    process.env.CLASSIFARR_INTEGRATION_RUNTIME_FILE = join(
      tmpdir(),
      `classifarr-integration-runtime-${process.env.CLASSIFARR_INTEGRATION_RUN_ID}.json`
    )
  }
}

if (isDirectExecution()) {
  const child = spawn(process.execPath, [jestPath, ...args], {
    stdio: 'inherit',
    env: process.env,
  })

  child.on('exit', (code) => {
    process.exit(code ?? 1)
  })
}
