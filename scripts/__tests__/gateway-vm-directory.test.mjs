/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, symlink, rm, access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PRIVATE_DIRECTORY_QUERY } from '../lib/gatewayVmDirectoryQuery.mjs';
import { VM_CREATION_BOOTSTRAP, planVmCreation } from '../lib/gatewayVmCreation.mjs';
import { vmCreationQuery } from '../lib/gatewayVmCreationQuery.mjs';
import { registryCommand } from '../lib/registryCommand.mjs';

test('native boundary is fixed, exclusive, protected and does not repair existing ACLs', () => {
  assert.match(PRIVATE_DIRECTORY_QUERY, /CreateDirectoryW\(path, ref attributes\)/);
  assert.match(PRIVATE_DIRECTORY_QUERY, /SetLastError = true/);
  assert.match(PRIVATE_DIRECTORY_QUERY, /DllImportSearchPath.System32/);
  assert.match(PRIVATE_DIRECTORY_QUERY, /finally \{ pinned.Free\(\); \}/);
  assert.match(PRIVATE_DIRECTORY_QUERY, /return error == 0 \? -1 : error;/);
  assert.match(PRIVATE_DIRECTORY_QUERY, /!\$security.AreAccessRulesProtected/);
  assert.match(PRIVATE_DIRECTORY_QUERY, /183 \{ throw 'directory_exists' \}/);
  assert.doesNotMatch(PRIVATE_DIRECTORY_QUERY, /Set-Acl|New-Item|Directory\.CreateDirectory|Remove-|Start-|Stop-|Invoke-Expression|LoadLibrary/);
});

async function invoke(input) {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (/^(?:systemroot|windir|systemdrive|temp|tmp|userprofile|localappdata|appdata|programfiles|programfiles\(x86\)|programw6432|comspec|pathext|path|allusersprofile|programdata)$/i.test(key)) env[key] = value;
  }
  env.PSModulePath = join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'Modules');
  const captured = await registryCommand(join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(VM_CREATION_BOOTSTRAP, 'utf16le').toString('base64')],
    { input, env, timeoutMs: 10000, maxBytes: 65536 });
  assert.equal(captured.ok, true, 'bounded native fixture failed');
  assert.equal(captured.stderr, '', 'native fixture emitted an unexpected stream');
  return JSON.parse(captured.stdout);
}

function fixturePrefix(path) {
  const data = Buffer.from(JSON.stringify({ path })).toString('base64');
  return String.raw`Set-StrictMode -Version Latest; $ErrorActionPreference='Stop';
` + PRIVATE_DIRECTORY_QUERY + `
Initialize-PrivateDirectoryNative;
$fixture=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${data}')) | ConvertFrom-Json;
$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User;
$security=[Security.AccessControl.DirectorySecurity]::new();
$security.SetOwner($sid);$security.SetAccessRuleProtection($true,$false);
$security.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl',
  ([Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit),
  [Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow));
`;
}

test('production metadata read observes an actual hidden Windows directory without changing it', { skip: process.platform !== 'win32' }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'classifarr-vm-hidden-'));
  try {
    const hidden = join(directory, 'hidden-parent');
    await mkdir(hidden);
    const source = vmCreationQuery(planVmCreation({ vmParent: 'C:\\Fixture VMs', diskParent: 'D:\\Fixture Disks' }));
    const metadataRead = source.match(/\$item=(Get-Item -LiteralPath \$current(?: -Force)? -ErrorAction Stop);/);
    assert.ok(metadataRead, 'production metadata read must remain explicit and literal');
    const data = Buffer.from(JSON.stringify({ path: hidden })).toString('base64');
    const result = await invoke(`$ErrorActionPreference='Stop';
      $current=([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${data}'))|ConvertFrom-Json).path;
      [IO.File]::SetAttributes($current,[IO.FileAttributes]::Directory -bor [IO.FileAttributes]::Hidden);
      $before=(Get-Acl -LiteralPath $current).Sddl;
      $ordinaryMissing=$false;try{Get-Item -LiteralPath $current -ErrorAction Stop|Out-Null}catch{
        if([string]$_.CategoryInfo.Category -ne 'ObjectNotFound'){throw};$ordinaryMissing=$true};
      ${metadataRead[0]}
      @{ordinaryMissing=$ordinaryMissing;directory=$item.PSIsContainer;hidden=[bool]($item.Attributes -band [IO.FileAttributes]::Hidden);
        aclUnchanged=((Get-Acl -LiteralPath $current).Sddl -ceq $before)}|ConvertTo-Json -Compress`);
    assert.deepEqual(result, { ordinaryMissing: true, directory: true, hidden: true, aclUnchanged: true });
  } finally {
    await rm(directory, { recursive: true, force: true });
    await assert.rejects(access(directory), { code: 'ENOENT' });
  }
});

test('real Windows creation starts protected, excludes inherited grants and refuses existing targets without edits', { skip: process.platform !== 'win32' }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'classifarr-vm-directory-'));
  try {
    await writeFile(join(directory, 'existing-file'), 'fixture-sentinel');
    await mkdir(join(directory, 'existing-junction-target'));
    await symlink(join(directory, 'existing-junction-target'), join(directory, 'existing-junction'), 'junction');
    const result = await invoke(fixturePrefix(directory) + String.raw`
      # Only this new fixture's ACL changes. The production descriptor's owner
      # is Administrators; this non-elevated fixture deliberately uses its user.
      $parent=[Security.AccessControl.DirectorySecurity]::new();
      $parent.SetSecurityDescriptorBinaryForm($security.GetSecurityDescriptorBinaryForm());
      $parent.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new('S-1-1-0'),'FullControl',
        ([Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit),
        [Security.AccessControl.PropagationFlags]::InheritOnly,[Security.AccessControl.AccessControlType]::Allow));
      Set-Acl -LiteralPath $fixture.path -AclObject $parent -ErrorAction Stop;
      $parentBefore=(Get-Acl -LiteralPath $fixture.path).Sddl;
      $child=Join-Path $fixture.path 'new-child';
      New-ExclusiveDirectory $child $security;
      $observed=Get-Acl -LiteralPath $child;
      $rules=@($observed.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]));
      if(!$observed.AreAccessRulesProtected -or $observed.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value -or
        $rules.Count -ne 1 -or $rules[0].IdentityReference.Value -ne $sid.Value -or $rules[0].IsInherited -or
        [string]$rules[0].FileSystemRights -ne 'FullControl'){throw 'initial_security'};
      $childBefore=$observed.Sddl;
      $alternate=[Security.AccessControl.DirectorySecurity]::new();
      $alternate.SetSecurityDescriptorBinaryForm($security.GetSecurityDescriptorBinaryForm());
      $alternate.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new('S-1-5-18'),'Read','Allow'));
      $refused=0;
      $junction=Join-Path $fixture.path 'existing-junction';
      $junctionTarget=Join-Path $fixture.path 'existing-junction-target';
      $junctionBefore=(Get-Acl -LiteralPath $junctionTarget).Sddl;
      foreach($path in @($child,(Join-Path $fixture.path 'existing-file'),$junction)){
        $reason=$null;try{New-ExclusiveDirectory $path $alternate}catch{$reason=[string]$_.Exception.Message};
        if($reason -ne 'directory_exists'){throw 'collision_not_refused'};$refused++;
      };
      $missing=Join-Path $fixture.path 'missing-parent';
      $reason=$null;try{New-ExclusiveDirectory (Join-Path $missing 'child') $security}catch{$reason=[string]$_.Exception.Message};
      if($reason -ne 'not_found' -or (Test-Path -LiteralPath $missing)){throw 'missing_parent_created'};
      $unprotected=[Security.AccessControl.DirectorySecurity]::new();
      $unprotected.SetSecurityDescriptorBinaryForm($security.GetSecurityDescriptorBinaryForm());
      $unprotected.SetAccessRuleProtection($false,$true);
      $unprotectedPath=Join-Path $fixture.path 'unprotected-child';
      $reason=$null;try{New-ExclusiveDirectory $unprotectedPath $unprotected}catch{$reason=[string]$_.Exception.Message};
      if($reason -ne 'directory_not_protected' -or (Test-Path -LiteralPath $unprotectedPath)){throw 'unprotected_created'};
      if((Get-Acl -LiteralPath $child).Sddl -cne $childBefore -or
        (Get-Acl -LiteralPath $fixture.path).Sddl -cne $parentBefore -or
        (Get-Acl -LiteralPath $junctionTarget).Sddl -cne $junctionBefore -or
        !((Get-Item -LiteralPath $junction).Attributes -band [IO.FileAttributes]::ReparsePoint) -or
        [IO.File]::ReadAllText((Join-Path $fixture.path 'existing-file')) -cne 'fixture-sentinel'){throw 'existing_target_changed'};
      @{protectedInitially=$true;untrustedInheritedRules=0;collisionsRefused=$refused;
        missingParentCreated=$false;existingObjectsUnchanged=$true;unprotectedRefused=$true} | ConvertTo-Json -Compress
    `);
    assert.deepEqual(result, { protectedInitially: true, untrustedInheritedRules: 0, collisionsRefused: 3,
      missingParentCreated: false, existingObjectsUnchanged: true, unprotectedRefused: true });
  } finally {
    await rm(directory, { recursive: true, force: true });
    await assert.rejects(access(directory), { code: 'ENOENT' });
  }
});

test('concurrent native attempts create once and refuse the competing target', { skip: process.platform !== 'win32' }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'classifarr-vm-directory-race-'));
  try {
    const input = fixturePrefix(directory) + String.raw`
      $outcome='created';
      try{New-ExclusiveDirectory (Join-Path $fixture.path 'one-target') $security}
      catch{if([string]$_.Exception.Message -ne 'directory_exists'){throw};$outcome='refused'};
      @{outcome=$outcome} | ConvertTo-Json -Compress
    `;
    const values = await Promise.all([invoke(input), invoke(input)]);
    assert.deepEqual(values.map(x => x.outcome).sort(), ['created', 'refused']);
  } finally {
    await rm(directory, { recursive: true, force: true });
    await assert.rejects(access(directory), { code: 'ENOENT' });
  }
});
