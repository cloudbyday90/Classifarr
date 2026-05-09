import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const scriptDir = import.meta.dirname

const vitestPath = resolve(scriptDir, '../node_modules/vitest/vitest.mjs')
const args = process.argv.slice(2)

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

const child = spawn(process.execPath, [vitestPath, ...args], {
  stdio: 'inherit',
  env: process.env,
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
