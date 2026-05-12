/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

function addNamedImports(content, helperPath, importNames) {
  const namesToAdd = importNames.filter((name) => content.includes(name));
  if (namesToAdd.length === 0) {
    return content;
  }

  const existingImportRe = /import\s*\{([^}]+)\}\s*from\s*(['"`][^'"`]*mockFactory\.mjs['"`])/;
  const existingMatch = content.match(existingImportRe);

  if (existingMatch) {
    const imports = existingMatch[1]
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const missingNames = namesToAdd.filter((name) => !imports.includes(name));

    if (missingNames.length === 0) {
      return content;
    }

    const newImports = [...imports, ...missingNames].join(', ');
    return content.replace(existingMatch[0], `import { ${newImports} } from ${existingMatch[2]}`);
  }

  const importLines = [...content.matchAll(/^import\s+.+?(?:from\s+['"`][^'"`]+['"`])?\s*;?\s*$/gm)];
  if (importLines.length === 0) {
    return `import { ${namesToAdd.join(', ')} } from '${helperPath}';\n${content}`;
  }

  const lastImport = importLines[importLines.length - 1];
  const insertPos = lastImport.index + lastImport[0].length;
  return (
    content.slice(0, insertPos) +
    `\nimport { ${namesToAdd.join(', ')} } from '${helperPath}';` +
    content.slice(insertPos)
  );
}

function findMatchingBrace(source, openBraceIndex) {
  let depth = 0;

  for (let index = openBraceIndex; index < source.length; index += 1) {
    if (source[index] === '{') {
      depth += 1;
      continue;
    }

    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function extractBraceValue(source, startPattern) {
  const match = startPattern.exec(source);
  if (!match) {
    return null;
  }

  const openBraceIndex = match.index + match[0].lastIndexOf('{');
  const closeBraceIndex = findMatchingBrace(source, openBraceIndex);
  if (closeBraceIndex === -1) {
    return null;
  }

  return source.slice(openBraceIndex, closeBraceIndex + 1);
}

function resolveAuthReplacement(factorySource) {
  const isPassThrough = /authenticateToken:\s*\([^)]*\)\s*=>\s*next\(\)/.test(factorySource);
  const userObject = extractBraceValue(factorySource, /req\.user\s*=\s*\{/g);
  if (!isPassThrough && !userObject) {
    return null;
  }

  if (userObject) {
    return `createAdminAuthMock(${userObject})`;
  }

  return 'createPassThroughAuthMock()';
}

function removeVariableDeclarationIfUnused(content, declarationStart, declarationEnd, variableName, callStart, callEnd, replacement) {
  const withReplacement = content.slice(0, callStart) + replacement + content.slice(callEnd);
  const remainingContent = withReplacement.slice(0, declarationStart) + withReplacement.slice(declarationEnd);

  if (new RegExp(`\\b${variableName}\\b`).test(remainingContent)) {
    return withReplacement;
  }

  return withReplacement.slice(0, declarationStart) + withReplacement.slice(declarationEnd);
}

function replaceNamedModuleAuthPattern(content) {
  const variableDeclarationRe = /(?:const|let|var)\s+(\w+)\s*=\s*\{/g;
  let match;
  let result = content;

  while ((match = variableDeclarationRe.exec(result)) !== null) {
    const variableName = match[1];
    const declarationStart = match.index;
    const openBraceIndex = result.indexOf('{', declarationStart);
    const closeBraceIndex = findMatchingBrace(result, openBraceIndex);
    if (closeBraceIndex === -1) {
      continue;
    }

    let declarationEnd = closeBraceIndex + 1;
    while (declarationEnd < result.length && /[;\s]/.test(result[declarationEnd])) {
      declarationEnd += 1;
    }

    const declarationSource = result.slice(declarationStart, declarationEnd);
    if (!declarationSource.includes('authenticateToken:')) {
      continue;
    }

    const mockCallRe = new RegExp(
      `((?:await\\s+)?)jest\\.unstable_mockModule\\(\\s*(['"\`][^'"\`]*middleware/auth\\.mjs['"\`])\\s*,\\s*\\(\\)\\s*=>\\s*createNamedMockModule\\(\\s*['"\`]router['"\`]\\s*,\\s*${variableName}\\s*\\)\\s*\\)\\s*;?`,
      'g',
    );
    const mockCallMatch = mockCallRe.exec(result);
    if (!mockCallMatch) {
      continue;
    }

    const helperCall = resolveAuthReplacement(declarationSource);
    if (!helperCall) {
      continue;
    }

    const awaitPrefix = mockCallMatch[1] || '';
    const modulePath = mockCallMatch[2];
    const replacement = `${awaitPrefix}jest.unstable_mockModule(${modulePath}, () => ${helperCall});`;
    const callStart = mockCallMatch.index;
    const callEnd = callStart + mockCallMatch[0].length;

    result = removeVariableDeclarationIfUnused(
      result,
      declarationStart,
      declarationEnd,
      variableName,
      callStart,
      callEnd,
      replacement,
    ).replace(/\n{3,}/g, '\n\n');
    variableDeclarationRe.lastIndex = 0;
  }

  return result;
}

function replaceInlineAuthPattern(content, pattern, replacementResolver) {
  return content.replace(pattern, (fullMatch, awaitPrefix = '', modulePath, factorySource) => {
    const helperCall = replacementResolver(factorySource);
    if (!helperCall) {
      return fullMatch;
    }

    return `${awaitPrefix}jest.unstable_mockModule(${modulePath}, () => ${helperCall});`;
  });
}

function removeUnusedSimpleAuthDeclarations(content) {
  const variableDeclarationRe = /(?:const|let|var)\s+(\w+)\s*=\s*\{/g;
  let match;
  let result = content;

  while ((match = variableDeclarationRe.exec(result)) !== null) {
    const variableName = match[1];
    const declarationStart = match.index;
    const openBraceIndex = result.indexOf('{', declarationStart);
    const closeBraceIndex = findMatchingBrace(result, openBraceIndex);
    if (closeBraceIndex === -1) {
      continue;
    }

    let declarationEnd = closeBraceIndex + 1;
    while (declarationEnd < result.length && /[;\s]/.test(result[declarationEnd])) {
      declarationEnd += 1;
    }

    const declarationSource = result.slice(declarationStart, declarationEnd);
    if (!declarationSource.includes('authenticateToken:') || !resolveAuthReplacement(declarationSource)) {
      continue;
    }

    const withoutDeclaration = result.slice(0, declarationStart) + result.slice(declarationEnd);
    if (new RegExp(`\\b${variableName}\\b`).test(withoutDeclaration)) {
      continue;
    }

    result = withoutDeclaration.replace(/\n{3,}/g, '\n\n');
    variableDeclarationRe.lastIndex = 0;
  }

  return result;
}

export function isAuthMockMigrationCandidate(content) {
  return /middleware\/auth\.mjs|authenticateToken:\s*\([^)]*\)\s*=>/.test(content);
}

export function migrateAuthMockContent(content, helperPath) {
  let result = replaceNamedModuleAuthPattern(content);

  result = replaceInlineAuthPattern(
    result,
    /((?:await\s+)?)jest\.unstable_mockModule\(\s*(['"`][^'"`]*middleware\/auth\.mjs['"`])\s*,\s*\(\)\s*=>\s*\(\s*(\{[\s\S]*?authenticateToken:[\s\S]*?\})\s*\)\s*\)\s*;?/g,
    resolveAuthReplacement,
  );

  result = removeUnusedSimpleAuthDeclarations(result);
  result = addNamedImports(result, helperPath, ['createAdminAuthMock', 'createPassThroughAuthMock']);
  return {
    content: result,
    changed: result !== content,
  };
}

const loggerJestFnFactoryRe = /createLogger:\s*jest\.fn\(\(\)\s*=>\s*\(?\{[^}]*info:\s*jest\.fn\(\)[^}]*warn:\s*jest\.fn\(\)[^}]*error:\s*jest\.fn\(\)[^}]*debug:\s*jest\.fn\(\)[^}]*\}\)?\)/;
const loggerBareArrowFactoryRe = /createLogger:\s*\(\)\s*=>\s*\(?\{[^}]*info:\s*jest\.fn\(\)[^}]*warn:\s*jest\.fn\(\)[^}]*error:\s*jest\.fn\(\)[^}]*debug:\s*jest\.fn\(\)[^}]*\}/;
const loggerExternalRefsRe = /(?:info|warn|error|debug):\s*(?!jest\.)(\w+)\.(\w+)/;

export function hasJestFnLoggerFactory(source) {
  return loggerJestFnFactoryRe.test(source);
}

export function hasBareArrowLoggerFactory(source) {
  return loggerBareArrowFactoryRe.test(source);
}

export function hasExternalLoggerReferences(source) {
  return loggerExternalRefsRe.test(source);
}

export function hasMigratableLoggerFactory(source) {
  return (hasJestFnLoggerFactory(source) || hasBareArrowLoggerFactory(source)) && !hasExternalLoggerReferences(source);
}

function replaceInlineLoggerBlock(content) {
  let result = '';
  let index = 0;

  while (index < content.length) {
    const searchStr = 'jest.unstable_mockModule(';
    const callStart = content.indexOf(searchStr, index);
    if (callStart === -1) {
      result += content.slice(index);
      break;
    }

    const afterCall = content.slice(callStart + searchStr.length).trimStart();
    const quoteMatch = afterCall.match(/^(['"`])([^'"`]+)\1/);
    if (!quoteMatch || !quoteMatch[2].includes('logger.mjs')) {
      result += content.slice(index, callStart + 1);
      index = callStart + 1;
      continue;
    }

    let depth = 0;
    let endIndex = callStart + searchStr.length - 1;
    while (endIndex < content.length && content[endIndex] !== '(') endIndex += 1;
    depth = 1;
    endIndex += 1;
    while (endIndex < content.length && depth > 0) {
      if (content[endIndex] === '(') depth += 1;
      else if (content[endIndex] === ')') depth -= 1;
      endIndex += 1;
    }

    const fullCall = content.slice(callStart, endIndex);
    if (!hasJestFnLoggerFactory(fullCall)) {
      result += content.slice(index, callStart + 1);
      index = callStart + 1;
      continue;
    }

    const pathMatch = fullCall.match(/jest\.unstable_mockModule\(\s*(['"`][^'"`]*logger\.mjs['"`])/);
    if (!pathMatch) {
      result += content.slice(index, callStart + 1);
      index = callStart + 1;
      continue;
    }

    result += content.slice(index, callStart) + `jest.unstable_mockModule(${pathMatch[1]}, () => createLoggerModuleMock().module)`;
    index = endIndex;
    if (content[index] === ';') {
      result += ';';
      index += 1;
    }
  }

  return result;
}

function replaceBareFnLoggerBlock(content) {
  let result = '';
  let index = 0;

  while (index < content.length) {
    const searchStr = 'jest.unstable_mockModule(';
    const callStart = content.indexOf(searchStr, index);
    if (callStart === -1) {
      result += content.slice(index);
      break;
    }

    const afterCall = content.slice(callStart + searchStr.length).trimStart();
    const quoteMatch = afterCall.match(/^(['"`])([^'"`]+)\1/);
    if (!quoteMatch || !quoteMatch[2].includes('logger.mjs')) {
      result += content.slice(index, callStart + 1);
      index = callStart + 1;
      continue;
    }

    let depth = 0;
    let endIndex = callStart + searchStr.length - 1;
    while (endIndex < content.length && content[endIndex] !== '(') endIndex += 1;
    depth = 1;
    endIndex += 1;
    while (endIndex < content.length && depth > 0) {
      if (content[endIndex] === '(') depth += 1;
      else if (content[endIndex] === ')') depth -= 1;
      endIndex += 1;
    }

    const fullCall = content.slice(callStart, endIndex);
    if (!hasBareArrowLoggerFactory(fullCall) || hasExternalLoggerReferences(fullCall)) {
      result += content.slice(index, callStart + 1);
      index = callStart + 1;
      continue;
    }

    const pathMatch = fullCall.match(/jest\.unstable_mockModule\(\s*(['"`][^'"`]*logger\.mjs['"`])/);
    if (!pathMatch) {
      result += content.slice(index, callStart + 1);
      index = callStart + 1;
      continue;
    }

    result += content.slice(index, callStart) + `jest.unstable_mockModule(${pathMatch[1]}, () => createLoggerModuleMock().module)`;
    index = endIndex;
    if (content[index] === ';') {
      result += ';';
      index += 1;
    }
  }

  return result;
}

function replaceCreateMockModuleLoggerPattern(content) {
  const mockModuleCall = /jest\.unstable_mockModule\(\s*(['"`][^'"`]*logger\.mjs['"`])\s*,\s*\(\)\s*=>\s*createMockModule\(\s*(\w+)\s*\)\s*\)/g;
  let match;
  let result = content;

  while ((match = mockModuleCall.exec(result)) !== null) {
    const [fullMatch, modulePath, varName] = match;
    const varDeclPattern = new RegExp(`(?:const|let|var)\\s+${varName}\\s*=\\s*\\{`, 'g');
    const varDeclMatch = varDeclPattern.exec(result);
    if (!varDeclMatch) {
      continue;
    }

    const declarationStart = varDeclMatch.index;
    const openBraceIndex = result.indexOf('{', declarationStart);
    const closeBraceIndex = findMatchingBrace(result, openBraceIndex);
    if (closeBraceIndex === -1) {
      continue;
    }

    let declarationEnd = closeBraceIndex + 1;
    while (declarationEnd < result.length && /[;\s]/.test(result[declarationEnd])) {
      declarationEnd += 1;
    }

    const declarationSource = result.slice(declarationStart, declarationEnd);
    if (!hasMigratableLoggerFactory(declarationSource)) {
      continue;
    }

    result = result.replace(fullMatch, `jest.unstable_mockModule(${modulePath}, () => createLoggerModuleMock().module)`);
    result = (result.slice(0, declarationStart) + result.slice(declarationEnd)).replace(/\n{3,}/g, '\n\n');
    mockModuleCall.lastIndex = 0;
  }

  return result;
}

export function isLoggerMockMigrationCandidate(content) {
  return /unstable_mockModule\s*\(\s*['"`][^'"`]*logger\.mjs['"`]/.test(content) && hasMigratableLoggerFactory(content);
}

export function migrateLoggerMockContent(content, helperPath) {
  let result = replaceInlineLoggerBlock(content);
  result = replaceBareFnLoggerBlock(result);
  result = replaceCreateMockModuleLoggerPattern(result);
  result = addNamedImports(result, helperPath, ['createLoggerModuleMock']);

  return {
    content: result,
    changed: result !== content,
  };
}
