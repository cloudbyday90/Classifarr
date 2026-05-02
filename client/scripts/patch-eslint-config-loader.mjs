import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function patchEslintConfigLoader() {
  const targetPath = resolve(__dirname, '../node_modules/eslint/lib/config/config-loader.js')

  if (!existsSync(targetPath)) {
    console.log('Skipping eslint config-loader patch: package not installed')
    return
  }

  const source = readFileSync(targetPath, 'utf8')
  const eol = source.includes('\r\n') ? '\r\n' : '\n'

  if (source.includes('async function findFlatConfigFile(startDirectory) {')) {
    console.log('eslint config-loader patch already applied')
    return
  }

  const requireNeedle = 'const findUp = require("find-up");'
  const requireMatches = source.split(requireNeedle).length - 1
  if (requireMatches !== 1) {
    throw new Error(`Expected 1 find-up require in eslint config-loader, found ${requireMatches}`)
  }

  const helperNeedle = 'const importedConfigFileModificationTime = new Map();'
  const helperReplacement = [
    'const importedConfigFileModificationTime = new Map();',
    '',
    'async function fileExists(filePath) {',
    '\ttry {',
    '\t\tawait fs.access(filePath);',
    '\t\treturn true;',
    '\t} catch {',
    '\t\treturn false;',
    '\t}',
    '}',
    '',
    'async function findFlatConfigFile(startDirectory) {',
    '\tlet directory = path.resolve(startDirectory);',
    '\tconst { root } = path.parse(directory);',
    '',
    '\twhile (true) {',
    '\t\tfor (const filename of FLAT_CONFIG_FILENAMES) {',
    '\t\t\tconst candidatePath = path.join(directory, filename);',
    '',
    '\t\t\tif (await fileExists(candidatePath)) {',
    '\t\t\t\treturn candidatePath;',
    '\t\t\t}',
    '\t\t}',
    '',
    '\t\tif (directory === root) {',
    '\t\t\treturn undefined;',
    '\t\t}',
    '',
    '\t\tdirectory = path.dirname(directory);',
    '\t}',
    '}'
  ].join(eol)
  const helperMatches = source.split(helperNeedle).length - 1
  if (helperMatches !== 1) {
    throw new Error(`Expected 1 config-loader helper insertion point, found ${helperMatches}`)
  }

  const callNeedle = [
    'configFilePath = await findUp(FLAT_CONFIG_FILENAMES, {',
    '\t\t\t\tcwd: fromDirectory,',
    '\t\t\t});'
  ].join(eol)
  const callReplacement = 'configFilePath = await findFlatConfigFile(fromDirectory);'
  const callMatches = source.split(callNeedle).length - 1
  if (callMatches !== 1) {
    throw new Error(`Expected 1 find-up call in eslint config-loader, found ${callMatches}`)
  }

  let patched = source.replace(requireNeedle, '')
  patched = patched.replace(helperNeedle, helperReplacement)
  patched = patched.replace(callNeedle, callReplacement)

  writeFileSync(targetPath, patched)
  console.log('Applied eslint config-loader native config lookup patch')
}

function patchEslintEscapeStringRegexp() {
  const targetPaths = [
    resolve(__dirname, '../node_modules/eslint/lib/linter/apply-disable-directives.js'),
    resolve(__dirname, '../node_modules/eslint/lib/rules/no-warning-comments.js'),
    resolve(__dirname, '../node_modules/eslint/lib/rules/utils/ast-utils.js'),
    resolve(__dirname, '../node_modules/eslint/lib/rules/spaced-comment.js')
  ]

  const requireNeedle = 'const escapeRegExp = require("escape-string-regexp");'
  const replacement = 'const escapeRegExp = RegExp.escape;'
  let patchedFileCount = 0

  for (const targetPath of targetPaths) {
    if (!existsSync(targetPath)) {
      console.log(`Skipping eslint escape-string-regexp patch for missing file: ${targetPath}`)
      continue
    }

    const source = readFileSync(targetPath, 'utf8')

    if (source.includes(replacement)) {
      continue
    }

    const requireMatches = source.split(requireNeedle).length - 1
    if (requireMatches !== 1) {
      throw new Error(`Expected 1 escape-string-regexp require in ${targetPath}, found ${requireMatches}`)
    }

    writeFileSync(targetPath, source.replace(requireNeedle, replacement))
    patchedFileCount += 1
  }

  if (patchedFileCount === 0) {
    console.log('eslint escape-string-regexp patch already applied')
    return
  }

  console.log(`Applied eslint native RegExp.escape patch to ${patchedFileCount} file(s)`) 
}

patchEslintConfigLoader()
patchEslintEscapeStringRegexp()
