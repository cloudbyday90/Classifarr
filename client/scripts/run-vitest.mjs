import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const vitestPath = resolve(__dirname, '../node_modules/vitest/vitest.mjs')
const args = process.argv.slice(2)

const nodeOptions = (process.env.NODE_OPTIONS || '')
  .split(' ')
  .filter(Boolean)

// Only add --no-experimental-webstorage on Node.js v24+
const nodeMajorVersion = Number(process.versions.node.split('.')[0])
if (nodeMajorVersion >= 24 && !nodeOptions.includes('--no-experimental-webstorage')) {
  nodeOptions.push('--no-experimental-webstorage')
}

process.env.NODE_OPTIONS = nodeOptions.join(' ')

const child = spawn(process.execPath, [vitestPath, ...args], {
  stdio: 'inherit',
  env: process.env,
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
