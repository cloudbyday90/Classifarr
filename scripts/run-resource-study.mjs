/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { runResourceStudyCompose } from './lib/resourceStudyCompose.mjs';

try {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--smoke')) throw new Error('resource_study_arguments_invalid');
  await runResourceStudyCompose({ smoke: args[0] === '--smoke' });
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
