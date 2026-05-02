import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function patchJestChangedFiles() {
  const targetPath = resolve(__dirname, '../node_modules/jest-changed-files/build/index.js')

  if (!existsSync(targetPath)) {
    console.log('Skipping jest-changed-files patch: package not installed')
    return
  }

  const source = readFileSync(targetPath, 'utf8')
  const eol = source.includes('\r\n') ? '\r\n' : '\n'

  if (source.includes('const data = mod.execa ?? mod.default ?? mod;')) {
    console.log('jest-changed-files patch already applied')
    return
  }

  const helperNeedle = [
    'function _execa() {',
    '  const data = _interopRequireDefault(require("execa"));',
    '  _execa = function () {',
    '    return data;',
    '  };',
    '  return data;',
    '}'
  ].join(eol)

  const helperReplacement = [
    'async function _execa() {',
    '  const mod = await import("execa");',
    '  const data = mod.execa ?? mod.default ?? mod;',
    '  _execa = async function () {',
    '    return data;',
    '  };',
    '  return data;',
    '}'
  ].join(eol)

  const alreadyPatchedHelperNeedle = [
    'async function _execa() {',
    '  const mod = await import("execa");',
    '  const data = mod.default ?? mod;',
    '  _execa = async function () {',
    '    return data;',
    '  };',
    '  return data;',
    '}'
  ].join(eol)

  const helperMatches = source.split(helperNeedle).length - 1
  const alreadyPatchedHelperMatches = source.split(alreadyPatchedHelperNeedle).length - 1
  if (helperMatches !== 3 && alreadyPatchedHelperMatches !== 3) {
    throw new Error(`Expected 3 execa helper matches in jest-changed-files, found original=${helperMatches}, patched=${alreadyPatchedHelperMatches}`)
  }

  let patched = source
  if (helperMatches === 3) {
    patched = patched.split(helperNeedle).join(helperReplacement)
  }
  if (alreadyPatchedHelperMatches === 3) {
    patched = patched.split(alreadyPatchedHelperNeedle).join(helperReplacement)
  }

  const awaitedCallNeedle = 'await (0, _execa().default)('
  const awaitedCallReplacement = 'await (await _execa())('
  const awaitedCallMatches = patched.split(awaitedCallNeedle).length - 1
  const awaitedCallAlreadyPatchedMatches = patched.split(awaitedCallReplacement).length - 1
  if (awaitedCallMatches !== 5 && awaitedCallAlreadyPatchedMatches !== 5) {
    throw new Error(`Expected 5 awaited execa call matches in jest-changed-files, found original=${awaitedCallMatches}, patched=${awaitedCallAlreadyPatchedMatches}`)
  }
  if (awaitedCallMatches === 5) {
    patched = patched.split(awaitedCallNeedle).join(awaitedCallReplacement)
  }

  const subprocessNeedle = 'const subprocess = (0, _execa().default)('
  const subprocessReplacement = 'const subprocess = (await _execa())('
  const subprocessMatches = patched.split(subprocessNeedle).length - 1
  const subprocessAlreadyPatchedMatches = patched.split(subprocessReplacement).length - 1
  if (subprocessMatches !== 1 && subprocessAlreadyPatchedMatches !== 1) {
    throw new Error(`Expected 1 subprocess execa call match in jest-changed-files, found original=${subprocessMatches}, patched=${subprocessAlreadyPatchedMatches}`)
  }
  if (subprocessMatches === 1) {
    patched = patched.split(subprocessNeedle).join(subprocessReplacement)
  }

  writeFileSync(targetPath, patched)
  console.log('Applied jest-changed-files execa ESM compatibility patch')
}

function patchArchiverZipPlugin() {
  const targetPath = resolve(__dirname, '../node_modules/archiver/lib/plugins/zip.js')

  if (!existsSync(targetPath)) {
    console.log('Skipping archiver zip patch: package not installed')
    return
  }

  const source = readFileSync(targetPath, 'utf8')

  if (source.includes("var engine = engineModule.default || engineModule.ZipStream || engineModule;")) {
    console.log('archiver zip patch already applied')
    return
  }

  const needle = "var engine = require('zip-stream');"
  const replacement = [
    "var engineModule = require('zip-stream');",
    "var engine = engineModule.default || engineModule.ZipStream || engineModule;"
  ].join(source.includes('\r\n') ? '\r\n' : '\n')

  const matches = source.split(needle).length - 1
  if (matches !== 1) {
    throw new Error(`Expected 1 archiver zip engine require match, found ${matches}`)
  }

  writeFileSync(targetPath, source.replace(needle, replacement))
  console.log('Applied archiver zip-stream ESM compatibility patch')
}

patchJestChangedFiles()
patchArchiverZipPlugin()
