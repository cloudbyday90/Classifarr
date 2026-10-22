/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve, win32 } from 'node:path';
import { registryCommand } from '../../lib/registryCommand.mjs';
import { PRIVATE_DIRECTORY_QUERY } from '../../lib/gatewayVmDirectoryQuery.mjs';
import { CREATION_JOURNAL_WRITER_QUERY } from '../../lib/creationJournalWriterSource.mjs';

/** Test only. No caller path, provider, existing receipt, settings or elevated launcher. */
export async function qualifyJournal(body, { source = CREATION_JOURNAL_WRITER_QUERY, frames = [], interruptOutput = false } = {}) {
  const systemRoot = process.env.SystemRoot;
  if (process.platform !== 'win32' || !/^[A-Za-z]:\\[A-Za-z0-9 ._()\\-]+$/.test(systemRoot)) throw new Error('journal_fixture_platform');
  const directory = resolve(import.meta.dirname, '../../../.tmp', `file-journal-test-${randomBytes(16).toString('hex')}`);
  if (!/^[A-Za-z]:\\[A-Za-z0-9 ._()\\-]+$/.test(directory)) throw new Error('journal_fixture_path');
  const input = String.raw`
Set-StrictMode -Version Latest;$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';
${PRIVATE_DIRECTORY_QUERY}
${source}
$writer=$null;$pin=$null;$owned=$false;$closeAttempted=$false;$cleanup=$false;$result=$null;$failureLine=$null;
$root='${directory}';$path=[IO.Path]::Combine($root,'journal.bin');
try {
  Initialize-PrivateDirectoryNative;Initialize-CreationJournal;
  [Classifarr.FileJournal.Identity]::PathGuard($root);
  $security=[Security.AccessControl.DirectorySecurity]::new();
  $owner=[Security.Principal.WindowsIdentity]::GetCurrent().User;
  $security.SetOwner($owner);$security.SetAccessRuleProtection($true,$false);
  $security.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($owner,'FullControl','Allow'));
  New-ExclusiveDirectory $root $security;$owned=$true;
  $pin=[Classifarr.FileJournal.Identity]::PinDirectory($root);
  $rootIdentity=[Classifarr.FileJournal.Identity]::Of($pin,$root,$true);
  $frames=@(${frames.map(frame => `,([Convert]::FromBase64String('${frame.toString('base64')}'))`).join(';')});
  ${body}
} catch {$failureLine=[int]$_.InvocationInfo.ScriptLineNumber}
finally {
  try {
    if(!$owned -and ![IO.Directory]::Exists($root)){$cleanup=$true};
    if($null -ne $writer -and !$closeAttempted){$closeAttempted=$true;$writer.Dispose()};
    if($owned -and $null -ne $pin -and [Classifarr.FileJournal.Identity]::Of($pin,$root,$true) -eq $rootIdentity){
      [Classifarr.FileJournal.Identity]::Private([IO.Directory]::GetAccessControl($root));
      $entries=[Collections.Generic.List[string]]::new();
      foreach($entry in [IO.Directory]::EnumerateFileSystemEntries($root)){$entries.Add($entry);if($entries.Count -gt 1){break}};
      if($entries.Count -gt 1 -or ($entries.Count -eq 1 -and $entries[0] -ne $path)){throw 'fixture_retained'};
      if($entries.Count -eq 1){
        if($null -eq $writer -or !$writer.MatchesFile()){throw 'fixture_retained'};
        [IO.File]::Delete($path);
      };
      $pin.Dispose();$pin=$null;[IO.Directory]::Delete($root,$false);
      $cleanup=![IO.Directory]::Exists($root);
    }
  } catch { $cleanup=$false }
  finally {if($null -ne $pin){$pin.Dispose()}}
}
${interruptOutput ? "[Console]::Out.Write('{')" : '@{major=$PSVersionTable.PSVersion.Major;result=$result;failureLine=$failureLine;cleanupComplete=$cleanup}|ConvertTo-Json -Depth 5 -Compress'};
if($null -ne $failureLine -or !$cleanup){exit 1}
`;
  const bootstrap = String.raw`[Console]::InputEncoding=[Text.UTF8Encoding]::new($false);[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);& ([scriptblock]::Create([Console]::In.ReadToEnd()))`;
  const capture = await registryCommand(win32.join(systemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(bootstrap, 'utf16le').toString('base64')],
    { input, env: { systemroot: systemRoot, windir: systemRoot,
      psmodulepath: win32.join(systemRoot, 'System32/WindowsPowerShell/v1.0/Modules') }, timeoutMs: 20000, maxBytes: 65536 });
  let data;
  try { data = JSON.parse(capture.stdout.trim().replace(/^\uFEFF/, '')); } catch {}
  // Qualified loss of the output envelope AFTER normal finally cleanup, not a mid-write crash.
  if (interruptOutput && capture.ok && capture.stdout === '{' && capture.stderr === '' && !existsSync(directory)) {
    return { status: 'capture_failed', cleanupObserved: true, acknowledgementAvailable: false };
  }
  if (!capture.ok || capture.stderr !== '' || data?.major !== 5 || data?.cleanupComplete !== true || data?.failureLine !== null) {
    // Never leak captured errors, private paths or fabricated records through test failure messages.
    throw new Error(`journal_fixture_failed:line_${Number.isSafeInteger(data?.failureLine) ? data.failureLine : 'unknown'}:cleanup_${data?.cleanupComplete === true}`);
  }
  return data.result;
}
