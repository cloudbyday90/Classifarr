/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { access, chmod, mkdir, rename, rm } from 'node:fs/promises'
import { constants } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const VERSION = '0.25.0'
const RELEASE_BASE_URL = `https://github.com/supabase-community/postgres-language-server/releases/download/${VERSION}`

const ASSET_NAMES = {
  win32: {
    x64: 'postgres-language-server_x86_64-pc-windows-msvc.exe',
    arm64: 'postgres-language-server_aarch64-pc-windows-msvc.exe',
  },
  darwin: {
    x64: 'postgres-language-server_x86_64-apple-darwin',
    arm64: 'postgres-language-server_aarch64-apple-darwin',
  },
  linux: {
    x64: 'postgres-language-server_x86_64-unknown-linux-gnu',
    arm64: 'postgres-language-server_aarch64-unknown-linux-gnu',
  },
}

function resolveAssetName() {
  const platformAssets = ASSET_NAMES[process.platform]
  if (!platformAssets) {
    throw new Error(`Unsupported platform for Postgres language server: ${process.platform}`)
  }

  const assetName = platformAssets[process.arch]
  if (!assetName) {
    throw new Error(`Unsupported architecture for Postgres language server: ${process.platform}/${process.arch}`)
  }

  return assetName
}

function resolveBinaryPath() {
  const assetName = resolveAssetName()
  return resolve(import.meta.dirname, '..', '.tmp', 'tools', 'postgres-language-server', VERSION, assetName)
}

async function ensureBinary(binaryPath) {
  try {
    await access(binaryPath, constants.F_OK)
    return binaryPath
  } catch {
    // Download below.
  }

  await mkdir(dirname(binaryPath), { recursive: true })

  const assetName = resolveAssetName()
  const downloadUrl = `${RELEASE_BASE_URL}/${assetName}`
  const temporaryPath = `${binaryPath}.download`

  const response = await fetch(downloadUrl, {
    headers: {
      'User-Agent': 'Classifarr-opencode-postgres-lsp',
    },
  })

  if (!response.ok || !response.body) {
    throw new Error(`Failed to download Postgres language server from ${downloadUrl} (${response.status})`)
  }

  try {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporaryPath))
    await rename(temporaryPath, binaryPath)
    if (process.platform !== 'win32') {
      await chmod(binaryPath, 0o755)
    }
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {})
    throw error
  }

  return binaryPath
}

async function main() {
  const binaryPath = await ensureBinary(resolveBinaryPath())
  const child = spawn(binaryPath, process.argv.slice(2), {
    stdio: 'inherit',
    env: process.env,
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 1)
  })
}

main().catch((error) => {
  console.error(`[run-postgres-language-server] ${error.message}`)
  process.exit(1)
})
