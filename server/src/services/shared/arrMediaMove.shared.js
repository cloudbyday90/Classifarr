function buildTargetPath(rootPath, currentPath) {
  const titleFolder = currentPath.split('/').pop() || currentPath.split('\\').pop();
  return rootPath.endsWith('/')
    ? `${rootPath}${titleFolder}`
    : `${rootPath}/${titleFolder}`;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

async function executeArrMediaMove({
  label,
  title,
  currentPath,
  rootPath,
  logger,
  dryRun = false,
  validateDestination,
  translatePath,
  moveFolder,
  updateRemotePath,
  validationErrorMessage,
}) {
  const newPath = buildTargetPath(rootPath, currentPath);
  const capitalizedLabel = capitalize(label);

  const validation = await validateDestination(newPath);
  if (!validation.isValid) {
    throw new Error(validation.error || validationErrorMessage);
  }

  logger.info(`Preparing ${label} move`, {
    title,
    from: currentPath,
    to: newPath,
    matchedRootFolder: validation.matchedRootFolder,
    dryRun,
  });

  const localCurrentPath = await translatePath(currentPath);
  const localNewPath = await translatePath(newPath);

  logger.info('Paths translated for file operations', {
    arrCurrentPath: currentPath,
    arrNewPath: newPath,
    localCurrentPath,
    localNewPath,
  });

  const moveResult = await moveFolder(localCurrentPath, localNewPath, {
    dryRun,
    skipVerification: false,
  });

  if (!moveResult.success) {
    throw new Error(moveResult.error || 'File move failed');
  }

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      message: 'Dry run: Move would succeed',
      details: {
        from: currentPath,
        to: newPath,
        estimatedSize: moveResult.estimatedSize,
        fileCount: moveResult.fileCount,
      },
      oldPath: currentPath,
      newPath,
    };
  }

  const updateResult = await updateRemotePath(newPath);

  logger.info(`${capitalizedLabel} move completed`, {
    title,
    from: currentPath,
    to: newPath,
    duration: moveResult.duration,
    fileCount: moveResult.fileCount,
  });

  return {
    success: true,
    message: `${capitalizedLabel} moved to ${rootPath}`,
    details: {
      from: currentPath,
      to: newPath,
      fileCount: moveResult.fileCount,
      duration: moveResult.duration,
    },
    data: updateResult,
    oldPath: currentPath,
    newPath,
  };
}

module.exports = {
  executeArrMediaMove,
};
module.exports.executeArrMediaMove = executeArrMediaMove;
module.exports.default = module.exports;
