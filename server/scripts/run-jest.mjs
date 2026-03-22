import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const jestPath = resolve(__dirname, '../node_modules/jest/bin/jest.js')
const args = process.argv.slice(2)

function usesIntegrationConfig(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '-c' || arg === '--config') {
      const next = argv[i + 1] || ''
      if (next.includes('jest.integration.config.js')) return true
      continue
    }
    if (arg.startsWith('--config=')) {
      return arg.includes('jest.integration.config.js')
    }
  }
  return false
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

const child = spawn(process.execPath, [jestPath, ...args], {
  stdio: 'inherit',
  env: process.env,
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
