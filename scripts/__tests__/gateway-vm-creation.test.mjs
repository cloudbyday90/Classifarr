/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createStudyVm, planVmCreation, VM_CREATION_TIMEOUT_MS, VM_CREATION_MAX_BYTES, VM_CREATION_BOOTSTRAP } from '../lib/gatewayVmCreation.mjs';
import { vmCreationQuery } from '../lib/gatewayVmCreationQuery.mjs';
import { PRIVATE_DIRECTORY_QUERY } from '../lib/gatewayVmDirectoryQuery.mjs';
import { runVmCreationCli } from '../create-gateway-study-vm.mjs';
import { registryCommand } from '../lib/registryCommand.mjs';

const parents = { vmParent: 'C:\\Fixture VMs', diskParent: 'D:\\Fixture Disks' };
const vmId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const secret = 'PRIVATE-RAW-OUTPUT';
const args = mode => [mode, '--vm-parent', parents.vmParent, '--disk-parent', parents.diskParent];
const success = () => ({ ok: true, stderr: '', stdout: JSON.stringify({ status: 'created_off', stage: 'verify', mutationAttempted: true, vmId }) });
const options = command => ({ platform: 'win32', systemRoot: 'C:\\Windows',
  env: { DOCKER_HOST: secret, docker_context: secret, GITHUB_TOKEN: secret, psmodulepath: secret,
    COMPUTERNAME: secret, computername: secret, TEMP: 'C:\\Temp' }, command });

test('pure plan preserves Windows backslashes, derives dedicated children and freezes the agreed profile', async () => {
  const plan = planVmCreation(parents);
  assert.equal(plan.vmDirectory, 'C:\\Fixture VMs\\Classifarr-Study');
  assert.equal(plan.diskFile, 'D:\\Fixture Disks\\Classifarr-Study\\Classifarr-Study.vhdx');
  assert.equal(plan.cpus, 4); assert.equal(plan.memoryBytes, 8 * 1024 ** 3); assert.equal(plan.diskBytes, 64 * 1024 ** 3);
  assert.equal(plan.generation, 2); assert.ok(Object.isFrozen(plan));
  const result = await runVmCreationCli(args('--plan'), { create: () => assert.fail('plan must not execute') });
  assert.equal(result.status, 'planned'); assert.equal(result.studyReady, false); assert.equal(result.handoffAuthenticated, false);
});

test('noncanonical, reserved, device, wildcard, injected and overlapping targets are rejected before any command', async () => {
  const bad = ['', 'C:\\', 'relative', 'C:relative', 'C:/vms', '\\\\host\\share', '\\\\?\\C:\\vms',
    'C:\\vms\\..\\other', 'C:\\vms\\.', 'C:\\vms\\', 'C:\\vms:stream', 'C:\\vms*', 'C:\\vms[1]',
    'C:\\vm\n', 'C:\\vm\r\n', 'C:\\vm\0', 'C:\\vm.', 'C:\\vm ', 'C:\\CON', 'C:\\nul.txt',
    'C:\\COM1', "C:\\vm';exit;#", 'C:\\a\\'.repeat(40), 'C:\\' + 'x\\'.repeat(29) + 'deep', null, 42];
  for (const path of bad) {
    for (const target of [{ ...parents, vmParent: path }, { ...parents, diskParent: path }]) {
      await assert.rejects(createStudyVm(target, options(() => assert.fail('invalid target reached command'))), /gateway_vm_creation_arguments_invalid/);
    }
  }
  for (const diskParent of [parents.vmParent, parents.vmParent.toLowerCase(), `${parents.vmParent}\\nested`, 'C:\\Fixture VMs\\nested\\..']) {
    assert.throws(() => planVmCreation({ ...parents, diskParent }), /gateway_vm_creation_arguments_invalid/);
  }
  assert.throws(() => planVmCreation({ vmParent: 'C:\\top\\nested', diskParent: 'C:\\top' }), /gateway_vm_creation_arguments_invalid/);
  for (const values of [[], ['--create'], [...args('--create'), '--force'], args('--apply'),
    ['--create', '--disk-parent', parents.diskParent, '--vm-parent', parents.vmParent]]) {
    await assert.rejects(runVmCreationCli(values, { create: () => assert.fail('invalid CLI reached command') }), /gateway_vm_creation_arguments_invalid/);
  }
});

test('creator uses one bounded shell-free primitive, built-in modules and data-only path transport', async () => {
  let calls = 0;
  const result = await createStudyVm(parents, options(async (file, argv, settings) => {
    calls++; assert.match(file, /powershell\.exe$/);
    assert.deepEqual(argv.slice(0, 4), ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand']);
    assert.equal(Buffer.from(argv[4], 'base64').toString('utf16le'), VM_CREATION_BOOTSTRAP);
    assert.ok(argv.join(' ').length < 1000);
    const script = settings.input;
    assert.equal(script, vmCreationQuery(planVmCreation(parents)));
    assert.ok(!script.includes(parents.vmParent));
    const encoded = script.match(/^\$creationData='([a-z0-9+/=]+)';/i)[1];
    assert.deepEqual(JSON.parse(Buffer.from(encoded, 'base64').toString()), planVmCreation(parents));
    assert.equal(settings.timeoutMs, VM_CREATION_TIMEOUT_MS); assert.equal(settings.timeoutMs, 900000);
    assert.equal(settings.maxBytes, VM_CREATION_MAX_BYTES);
    assert.equal(settings.env.DOCKER_HOST, undefined); assert.equal(settings.env.docker_context, undefined);
    assert.equal(settings.env.GITHUB_TOKEN, undefined); assert.equal(settings.env.psmodulepath, undefined);
    assert.equal(settings.env.COMPUTERNAME, undefined); assert.equal(settings.env.computername, undefined);
    assert.equal(settings.env.TEMP, 'C:\\Temp');
    assert.match(settings.env.PSModulePath, /WindowsPowerShell[\\/]v1\.0[\\/]Modules$/);
    return success();
  }));
  assert.equal(calls, 1); assert.equal(result.status, 'created_off'); assert.equal(result.vmId, vmId);
  assert.equal(result.automaticRetry, false); assert.equal(result.studyReady, false); assert.equal(result.handoffAuthenticated, false);
  for (const systemRoot of ['', 'C:/Windows', 'C:\\Windows\n', 'relative', '\\\\remote\\Windows', null]) {
    assert.equal((await createStudyVm(parents, { ...options(() => assert.fail()), systemRoot })).status, 'blocked');
  }
  assert.equal((await createStudyVm(parents, { ...options(() => assert.fail()), platform: 'linux' })).status, 'blocked');
});

test('exact blocked and partial statuses are retained; malformed/private/failed output always requires review without retry', async () => {
  for (const stage of ['preflight', 'permissions', 'capacity', 'collisions', 'directories', 'disk', 'vm', 'settings', 'verify']) {
    const partial = ['directories', 'disk', 'vm', 'settings', 'verify'].includes(stage);
    const status = partial ? 'review_required' : 'blocked';
    const result = await createStudyVm(parents, options(async () => ({ ok: true, stderr: '',
      stdout: JSON.stringify({ status, stage, mutationAttempted: partial, reasonCode: 'query_failed' }) })));
    assert.equal(result.status, status); assert.equal(result.stage, stage); assert.equal(result.mutationAttempted, partial);
  }
  const invalid = [null, {}, { ...success(), ok: false }, { ...success(), stderr: secret },
    { ...success(), timedOut: true }, { ...success(), outputLimited: true }, { ...success(), cancelled: true },
    { ...success(), stdout: secret }, { ...success(), stdout: 'x'.repeat(VM_CREATION_MAX_BYTES) },
    ...[null, [], { status: 'created_off', stage: 'verify', mutationAttempted: 'true', vmId },
      { status: 'created_off', stage: 'verify', mutationAttempted: true, vmId: '*' },
      { status: 'created_off', stage: 'verify', mutationAttempted: true, vmId, private: secret },
      { status: 'blocked', stage: 'verify', mutationAttempted: false },
      { status: 'blocked', stage: 'permissions', mutationAttempted: false, reasonCode: secret },
      { status: 'review_required', stage: secret, mutationAttempted: true },
      { status: 'created_off', stage: 'vm', mutationAttempted: true, vmId }].map(v => ({ ok: true, stderr: '', stdout: JSON.stringify(v) }))];
  for (const captured of invalid) {
    let calls = 0;
    const result = await createStudyVm(parents, options(async () => { calls++; return captured; }));
    assert.equal(calls, 1); assert.equal(result.status, 'review_required'); assert.equal(result.mutationAttempted, true);
    assert.ok(!JSON.stringify(result).includes(secret)); assert.equal(result.vmId, undefined);
  }
  assert.equal((await createStudyVm(parents, options(() => { throw Error(secret); }))).status, 'review_required');
  const valid = success(); valid.stdout = '\uFEFF' + valid.stdout;
  assert.equal((await createStudyVm(parents, options(async () => valid))).status, 'created_off');
});

test('pre-cancellation does not launch; cancellation after launch is uncertain even with a success-shaped response', async () => {
  const controller = new AbortController(); controller.abort();
  assert.equal((await createStudyVm(parents, { ...options(() => assert.fail()), signal: controller.signal })).mutationAttempted, false);
  const during = new AbortController();
  const result = await createStudyVm(parents, { ...options(async () => { during.abort(); return success(); }), signal: during.signal });
  assert.equal(result.status, 'review_required'); assert.equal(result.mutationAttempted, true);
});

test('real command timeout and output overflow retain uncertainty and never retry', async () => {
  for (const script of ['setTimeout(()=>{},10000)', 'process.stdout.write("x".repeat(10000));setTimeout(()=>{},10000)']) {
    let calls = 0;
    const result = await createStudyVm(parents, options(async (_file, _argv, settings) => {
      calls++;
      return registryCommand(process.execPath, ['-e', script], { ...settings, input: undefined, timeoutMs: 100, maxBytes: 1024 });
    }));
    assert.equal(calls, 1); assert.equal(result.status, 'review_required'); assert.equal(result.mutationAttempted, true);
  }
});

test('fixed script has no remote targets, retry, overwrite, deletion, power or networking mutation', () => {
  const query = vmCreationQuery(planVmCreation(parents));
  assert.match(query, /Assert-Administrator;/); assert.match(query, /Get-VM -Id \$createdId/);
  assert.match(query, /New-VHD -Path \$c\.diskFile -Fixed -SizeBytes/);
  assert.match(query, /Set-VM -VM \$vm -AutomaticStartAction Nothing -AutomaticStopAction ShutDown/);
  assert.match(query, /AreAccessRulesProtected/); assert.match(query, /InheritOnly/);
  assert.match(query, /-DynamicMemoryEnabled \$false/);
  const allowedMetadataRead = 'Get-Item -LiteralPath $current -Force -ErrorAction Stop';
  assert.equal(query.split(allowedMetadataRead).length, 2);
  assert.doesNotMatch(query.replace(allowedMetadataRead, ''), /-Force\b/);
  assert.doesNotMatch(query, /\b(?:Start|Stop|Save|Remove|Restart|Suspend|Resume|Import|Connect|Disconnect)-VM|New-VMSwitch|Set-VMHost|ComputerName|Credential|RunAs|Start-Process|Invoke-Expression|-Overwrite\b|-AsJob\b|NewVHDSizeBytes/);
  assert.doesNotMatch(query, /ErrorAction\s+SilentlyContinue|Start-Sleep/);
  assert.doesNotMatch(query, /\bNew-Item\b|\bSet-Acl\b/);
  const nativeIdentity = '$env:COMPUTERNAME=[Environment]::MachineName;';
  assert.equal(VM_CREATION_BOOTSTRAP.split(nativeIdentity).length, 2);
  assert.match(VM_CREATION_BOOTSTRAP, /^\$global:ErrorActionPreference='Stop';/);
  assert.ok(VM_CREATION_BOOTSTRAP.indexOf("$global:ErrorActionPreference='Stop'") < VM_CREATION_BOOTSTRAP.indexOf(nativeIdentity));
  assert.ok(VM_CREATION_BOOTSTRAP.indexOf(nativeIdentity) < VM_CREATION_BOOTSTRAP.indexOf('[Console]::In.ReadToEnd()'));
});

test('CLI rejects invalid invocation without commands or raw exception output', () => {
  const file = fileURLToPath(new URL('../create-gateway-study-vm.mjs', import.meta.url));
  for (const argv of [[], ['--create'], [...args('--plan'), '--force']]) {
    const r = spawnSync(process.execPath, [file, ...argv], { encoding: 'utf8', timeout: 5000, windowsHide: true });
    assert.equal(r.status, 1); assert.equal(r.stderr, ''); assert.equal(JSON.parse(r.stdout).status, 'invalid');
  }
});

const mocks = String.raw`
$script:events=[Collections.Generic.List[string]]::new(); $script:dirs=@{}; $script:security=@{}; $script:created=$null;
function Import-Module { [CmdletBinding()] param([string]$Name) }
function Get-Item { [CmdletBinding()] param([string]$LiteralPath,[switch]$Force)
  $attributes=[IO.FileAttributes]::Directory;
  if($scenario -eq 'hidden' -or $scenario -eq 'hidden_reparse'){
    $attributes=$attributes -bor [IO.FileAttributes]::Hidden;
    if(!$Force){throw 'not_found'};
  };
  if($scenario -eq 'hidden_missing'){throw 'not_found'};
  if($scenario -eq 'metadata_denied'){throw 'access_denied'};
  if($scenario -eq 'reparse' -and $LiteralPath -eq 'C:\Fixture VMs'){$attributes=$attributes -bor [IO.FileAttributes]::ReparsePoint};
  if($scenario -eq 'hidden_reparse' -and $LiteralPath -eq 'C:\Fixture VMs'){$attributes=$attributes -bor [IO.FileAttributes]::ReparsePoint};
  [pscustomobject]@{PSIsContainer=$true;Attributes=$attributes;FullName=$LiteralPath}
}
function Get-Acl { [CmdletBinding()] param([string]$LiteralPath)
  if($script:security.ContainsKey($LiteralPath)){return $script:security[$LiteralPath]};
  $acl=[Security.AccessControl.DirectorySecurity]::new(); $acl.SetOwner([Security.Principal.SecurityIdentifier]::new('S-1-5-18'));
  if($scenario -eq 'owner'){$acl.SetOwner([Security.Principal.SecurityIdentifier]::new('S-1-1-0'))};
  if($scenario -eq 'acl'){$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new('Everyone','FullControl','Allow'))};
  if($scenario.StartsWith('parent_') -and @('C:\Fixture VMs','D:\Fixture Disks') -contains $LiteralPath){
    $sid='S-1-5-83-0';$rights=1179791;$inheritance=[Security.AccessControl.InheritanceFlags]::None;
    if($scenario -eq 'parent_wrong_sid'){$sid='S-1-5-32-545'};
    if($scenario -eq 'parent_write_attributes'){$rights=$rights -bor 256};
    if($scenario -eq 'parent_write_ea'){$rights=$rights -bor 16};
    if($scenario -eq 'parent_delete_child'){$rights=$rights -bor 64};
    if($scenario -eq 'parent_delete'){$rights=$rights -bor 65536};
    if($scenario -eq 'parent_permissions'){$rights=$rights -bor 262144};
    if($scenario -eq 'parent_ownership'){$rights=$rights -bor 524288};
    if($scenario -eq 'parent_inheriting'){$inheritance=[Security.AccessControl.InheritanceFlags]::ContainerInherit};
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),$rights,
      $inheritance,[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow));
    if($scenario -eq 'parent_inherited'){$acl.SetSecurityDescriptorSddlForm('O:SYD:(A;ID;0x12008f;;;S-1-5-83-0)')};
    if($scenario -eq 'parent_propagating'){$acl.SetSecurityDescriptorSddlForm('O:SYD:(A;CINP;0x12008f;;;S-1-5-83-0)')};
    if($scenario -eq 'parent_extra_hostile'){$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new('Everyone','Write','Allow'))};
  };
  return $acl
}
function Get-CimInstance { [CmdletBinding()] param([string]$ClassName)
  if($scenario -eq 'capacity'){return [pscustomobject]@{FreePhysicalMemory=1;NumberOfLogicalProcessors=16}};
  [pscustomobject]@{FreePhysicalMemory=27MB;NumberOfLogicalProcessors=16}
}
function Get-Volume { [CmdletBinding()] param([string]$FilePath)
  [pscustomobject]@{SizeRemaining=$(if($scenario -eq 'volume'){1}else{700GB});DriveType='Fixed';FileSystemType='NTFS'}
}
function Get-VM { [CmdletBinding()] param([guid]$Id)
  if($PSBoundParameters.ContainsKey('Id')){
    if($scenario -eq 'identity'){$script:created.Id=[guid]'11111111-2222-3333-4444-555555555555'};
    if($scenario -eq 'running'){$script:created.State='Running'};
    return $script:created
  };
  if($scenario -eq 'collision'){[pscustomobject]@{Name='Classifarr-Study'}};
  if($scenario -eq 'inventory'){1..257 | ForEach-Object{[pscustomobject]@{Name='unrelated'}}}
}
function Test-Path { [CmdletBinding()] param([string]$LiteralPath)
  return ($scenario -eq 'directory_collision' -or $script:dirs.ContainsKey($LiteralPath))
}
function New-VHD { [CmdletBinding()] param([string]$Path,[switch]$Fixed,[long]$SizeBytes)
  $script:events.Add('disk'); if($scenario -eq 'disk_failure'){throw 'PRIVATE-RAW-OUTPUT'};
  if(!$Fixed -or $SizeBytes -ne 64GB){throw 'wrong_disk'}
}
function New-VM { [CmdletBinding()] param([string]$Name,[int]$Generation,[long]$MemoryStartupBytes,[string]$Path,[string]$VHDPath)
  $script:events.Add('vm'); if($scenario -eq 'vm_failure'){throw 'PRIVATE-RAW-OUTPUT'};
  $script:created=[pscustomobject]@{Id=[guid]'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';Name=$Name;Generation=$Generation;Path=$Path;State='Off';
    AutomaticStartAction='StartIfRunning';AutomaticStopAction='Save';AutomaticCheckpointsEnabled=$true;CheckpointType='Production'};
  if(@('own_vm_acl','foreign_vm_acl') -contains $scenario){
    $sid=$(if($scenario -eq 'own_vm_acl'){'S-1-5-83-0-1-2-3-4'}else{'S-1-5-83-0-5-6-7-8'});
    $rule=[Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),'FullControl','Allow');
    $script:security[$Path].AddAccessRule($rule);
  };
  if($scenario.StartsWith('child_group')){
    $rights=$(if($scenario -eq 'child_group_read'){'Read'}else{'Write'});
    $propagation=$(if($scenario -eq 'child_group_inherit_only'){[Security.AccessControl.PropagationFlags]::InheritOnly}else{[Security.AccessControl.PropagationFlags]::None});
    $rule=[Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new('S-1-5-83-0'),$rights,
      [Security.AccessControl.InheritanceFlags]::ContainerInherit,$propagation,[Security.AccessControl.AccessControlType]::Allow);
    $script:security[$Path].AddAccessRule($rule);
  };
  if($scenario -eq 'child_unprotected'){$script:security[$Path].SetAccessRuleProtection($false,$true)};
  return $script:created
}
function Set-VM { [CmdletBinding()] param($VM,[string]$AutomaticStartAction,[string]$AutomaticStopAction,[bool]$AutomaticCheckpointsEnabled,[string]$CheckpointType)
  $script:events.Add('settings'); if($scenario -eq 'settings_failure'){throw 'PRIVATE-RAW-OUTPUT'};
  $VM.AutomaticStartAction=$AutomaticStartAction;$VM.AutomaticStopAction=$AutomaticStopAction;
  $VM.AutomaticCheckpointsEnabled=$AutomaticCheckpointsEnabled;$VM.CheckpointType=$CheckpointType
}
function Set-VMProcessor { [CmdletBinding()] param($VM,[int]$Count) $script:events.Add('cpu') }
function Set-VMMemory { [CmdletBinding()] param($VM,[bool]$DynamicMemoryEnabled,[long]$StartupBytes) $script:events.Add('memory') }
function Set-VMFirmware { [CmdletBinding()] param($VM,[string]$EnableSecureBoot,[string]$SecureBootTemplate) $script:events.Add('firmware') }
function Enable-VMIntegrationService { [CmdletBinding()] param($VM,[string]$Name) $script:events.Add('shutdown_service') }
function Get-VMProcessor { [CmdletBinding()] param($VM) [pscustomobject]@{Count=$(if($scenario -eq 'verify'){8}else{4})} }
function Get-VMMemory { [CmdletBinding()] param($VM) [pscustomobject]@{Startup=8GB;DynamicMemoryEnabled=$false} }
function Get-VMFirmware { [CmdletBinding()] param($VM) [pscustomobject]@{SecureBoot='On';SecureBootTemplate='MicrosoftUEFICertificateAuthority'} }
function Get-VMHardDiskDrive { [CmdletBinding()] param($VM) [pscustomobject]@{Path='D:\Fixture Disks\Classifarr-Study\Classifarr-Study.vhdx'} }
function Get-VMNetworkAdapter { [CmdletBinding()] param($VM) [pscustomobject]@{SwitchId=$(if($scenario -eq 'network'){[guid]::NewGuid()}else{[guid]::Empty})} }
function Get-VMIntegrationService { [CmdletBinding()] param($VM,[string]$Name)
  if($scenario -eq 'missing'){return [pscustomobject]@{Other=$true}};
  [pscustomobject]@{Enabled=$true}
}
function Get-VMSnapshot { [CmdletBinding()] param($VM) }
function Get-VHD { [CmdletBinding()] param([string]$Path) [pscustomobject]@{Size=64GB;VhdType='Fixed';VhdFormat='VHDX';ParentPath=$null} }
`;

// Replace the entire native boundary in synthetic tests, not just individual
// cmdlets: these tests cannot call CreateDirectoryW even when run as admin.
const nativeMocks = String.raw`
  function Initialize-PrivateDirectoryNative { if($scenario -eq 'native_unavailable'){throw 'unsupported'} }
  function New-ExclusiveDirectory([string]$path,[Security.AccessControl.DirectorySecurity]$security) {
    if(!$security.AreAccessRulesProtected -or $security.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne 'S-1-5-32-544'){throw 'wrong_security'};
    $rules=@($security.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]));
    if($rules.Count -ne 2){throw 'wrong_rules'};
    foreach($rule in $rules){if(@('S-1-5-18','S-1-5-32-544') -notcontains $rule.IdentityReference.Value -or
      [string]$rule.FileSystemRights -ne 'FullControl' -or [int]$rule.InheritanceFlags -ne 3 -or [int]$rule.PropagationFlags -ne 0){throw 'wrong_rule'}};
    $script:events.Add('directory_private');
    if($scenario -eq 'directory_failure'){throw 'PRIVATE-RAW-OUTPUT'};
    if($scenario -eq 'directory_race' -and $script:dirs.Count -eq 1){throw 'directory_exists'};
    if($script:dirs.ContainsKey($path)){throw 'directory_exists'};
    $script:dirs[$path]=$true; $script:security[$path]=$security;
  }
`;

test('real Windows module imports keep progress out of the production creator capture', { skip: process.platform !== 'win32' }, async t => {
  let captured;
  const probe = String.raw`$ProgressPreference='SilentlyContinue';$ErrorActionPreference='Stop';
    $missing=@('Hyper-V','Storage' | Where-Object { !(Get-Module -ListAvailable -Name $_ -ErrorAction Stop) });
    if($missing.Count -gt 0){@{probe='missing_modules'} | ConvertTo-Json -Compress}
    else {
      Import-Module Hyper-V -ErrorAction Stop;
      Import-Module Storage -ErrorAction Stop;
      @{status='blocked';stage='preflight';reasonCode='query_failed';mutationAttempted=$false} | ConvertTo-Json -Compress;
    }`;
  const result = await createStudyVm(parents, {
    command: async (file, argv, settings) => {
      // Entire input is replaced with a read-only module probe. No creation
      // query, resource inspection, admin requirement or write reaches the child.
      captured = await registryCommand(file, argv, { ...settings, input: probe, timeoutMs: 10000 });
      return captured;
    },
  });
  assert.equal(captured.ok, true);
  const observed = JSON.parse(captured.stdout.trim().replace(/^\uFEFF/, ''));
  if (observed.probe === 'missing_modules') { t.skip('Hyper-V/Storage modules are not installed'); return; }
  assert.equal(captured.stderr.length, 0, 'module first-use progress must not contaminate stderr');
  assert.equal(result.status, 'blocked'); assert.equal(result.mutationAttempted, false);
  assert.equal(result.reasonCode, 'query_failed');
});

test('native Windows warning/error streams still refuse a success-shaped capture', { skip: process.platform !== 'win32' }, async () => {
  for (const diagnostic of ["Write-Warning 'synthetic diagnostic';", "Write-Error 'synthetic diagnostic' -ErrorAction Continue;"]) {
    let captured;
    const probe = diagnostic + `@{status='created_off';stage='verify';mutationAttempted=$true;vmId='${vmId}'} | ConvertTo-Json -Compress;`;
    const result = await createStudyVm(parents, {
      command: async (file, argv, settings) => {
        captured = await registryCommand(file, argv, { ...settings, input: probe, timeoutMs: 10000 });
        return captured;
      },
    });
    assert.equal(result.status, 'review_required'); assert.equal(result.mutationAttempted, true);
    assert.ok(!JSON.stringify(result).includes('synthetic diagnostic'));
    assert.ok(captured.stderr.length > 0 || !captured.stdout.trim().startsWith('{'));
  }
});

test('native creator bootstrap derives only the local hostname without trusting caller identity', { skip: process.platform !== 'win32' }, async () => {
  const callerEnvironment = { ...process.env, COMPUTERNAME: 'not-the-local-host.invalid' };
  const originalHostname = process.env.COMPUTERNAME;
  let captured;
  let calls = 0;
  const probe = String.raw`Set-StrictMode -Version Latest;
    @{present=![string]::IsNullOrEmpty($env:COMPUTERNAME);
      native=[string]::Equals($env:COMPUTERNAME,[Environment]::MachineName,[StringComparison]::OrdinalIgnoreCase);
      privateAbsent=($null -eq $env:GITHUB_TOKEN);dockerAbsent=($null -eq $env:DOCKER_HOST)} | ConvertTo-Json -Compress`;
  const result = await createStudyVm(parents, {
    env: { ...callerEnvironment, GITHUB_TOKEN: secret, DOCKER_HOST: secret },
    command: async (file, argv, settings) => {
      calls++;
      assert.equal(settings.env.COMPUTERNAME, undefined);
      // Replace the entire input. This real child only reads its own environment;
      // no Hyper-V cmdlet, infrastructure query or creation code can run.
      captured = await registryCommand(file, argv, { ...settings, input: probe, timeoutMs: 10000 });
      return { ok: true, stderr: '', stdout: JSON.stringify({ status: 'blocked', stage: 'preflight', reasonCode: 'query_failed', mutationAttempted: false }) };
    },
  });
  assert.equal(calls, 1); assert.equal(result.status, 'blocked'); assert.equal(result.mutationAttempted, false);
  assert.equal(captured.ok, true); assert.equal(captured.stderr, '');
  assert.deepEqual(JSON.parse(captured.stdout), { present: true, native: true, privateAbsent: true, dockerAbsent: true });
  assert.equal(callerEnvironment.COMPUTERNAME, 'not-the-local-host.invalid');
  assert.equal(process.env.COMPUTERNAME, originalHostname);

  // Simulate native identity acquisition failing before the fixed input reader.
  // The synthetic failure must prevent even a read-only marker from executing.
  const failingBootstrap = VM_CREATION_BOOTSTRAP.replace('[Environment]::MachineName', "$(throw 'synthetic identity unavailable')");
  const failed = await registryCommand(join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(failingBootstrap, 'utf16le').toString('base64')],
    { input: "'input_must_not_execute'", timeoutMs: 10000 });
  assert.equal(failed.ok, false);
  assert.doesNotMatch(failed.stdout, /input_must_not_execute/);
});

test('Windows parses the emitted PowerShell and exercises refusal/partial/success entirely with mocked cmdlets', { skip: process.platform !== 'win32' }, async () => {
  const query = vmCreationQuery(planVmCreation(parents));
  const executable = join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const invoke = script => registryCommand(executable,
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(VM_CREATION_BOOTSTRAP, 'utf16le').toString('base64')], { input: script, timeoutMs: 10000 });
  const encoded = Buffer.from(query, 'utf16le').toString('base64');
  const parsed = await invoke(`$tokens=$null;$errors=$null;[Management.Automation.Language.Parser]::ParseInput([Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encoded}')),[ref]$tokens,[ref]$errors)|Out-Null;if($errors.Count -eq 0){'syntax_ok'}else{'syntax_invalid'}`);
  assert.equal(parsed.ok, true); assert.equal(parsed.stdout.trim(), 'syntax_ok');
  // Exercise the real token check too, with every infrastructure cmdlet still
  // mocked so this cannot provision anything even on an administrator test host.
  assert.equal(query.split(PRIVATE_DIRECTORY_QUERY).length, 2);
  const syntheticQuery = query.replace(PRIVATE_DIRECTORY_QUERY, () => nativeMocks);
  const tokenQuery = syntheticQuery.replace('$createdSid=Resolve-CreatedVmSid $createdId;', "$createdSid='S-1-5-83-0-1-2-3-4';");
  const guarded = await invoke(`$scenario='success';${mocks}\n$observed=& { ${tokenQuery} };
    $principal=[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent());
    @{isAdmin=$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator);result=($observed|ConvertFrom-Json);events=@($script:events)} | ConvertTo-Json -Compress -Depth 5`);
  assert.equal(guarded.ok, true); assert.equal(guarded.stderr, '');
  const guardResult = JSON.parse(guarded.stdout);
  assert.equal(guardResult.result.status, guardResult.isAdmin ? 'created_off' : 'blocked');
  if (!guardResult.isAdmin) {
    assert.equal(guardResult.result.reasonCode, 'administrator_required');
    assert.deepEqual(guardResult.events, []);
  }
  // Only token/SID resolution need real host identities. Exclude those calls in
  // this synthetic test; all ACL policy and mutation sequencing runs unchanged.
  assert.equal(query.split('    Assert-Administrator;').length, 2);
  const runnable = syntheticQuery.replace('    Assert-Administrator;', '    # Token check excluded from the synthetic test only.')
    .replace('$createdSid=Resolve-CreatedVmSid $createdId;', "$createdSid='S-1-5-83-0-1-2-3-4';");
  for (const scenario of ['reparse','owner','acl','capacity','volume','collision','inventory','directory_collision',
    'directory_failure','directory_race','disk_failure','vm_failure','settings_failure','identity','running','verify','network','missing','own_vm_acl','foreign_vm_acl','success',
    'parent_create','parent_wrong_sid','parent_write_attributes','parent_write_ea','parent_delete_child','parent_delete','parent_permissions','parent_ownership',
    'parent_inherited','parent_inheriting','parent_propagating','parent_extra_hostile','native_unavailable','child_group_write','child_group_read','child_group_inherit_only','child_unprotected',
    'hidden','hidden_reparse','hidden_missing','metadata_denied']) {
    const script = `$scenario='${scenario}';\n${mocks}\n$observed=& { ${runnable} };@{result=($observed | ConvertFrom-Json);events=@($script:events)} | ConvertTo-Json -Compress -Depth 5`;
    const captured = await invoke(script);
    assert.equal(captured.ok, true, scenario); assert.equal(captured.stderr, '', scenario);
    assert.ok(!captured.stdout.includes(secret));
    const value = JSON.parse(captured.stdout);
    if (['reparse','owner','acl','capacity','volume','collision','inventory','directory_collision','native_unavailable','hidden_reparse','hidden_missing','metadata_denied'].includes(scenario)
      || (scenario.startsWith('parent_') && scenario !== 'parent_create')) {
      assert.equal(value.result.status, 'blocked', scenario); assert.equal(value.result.mutationAttempted, false);
      assert.deepEqual(value.events, [], scenario);
      if (scenario.startsWith('parent_')) assert.equal(value.result.reasonCode, 'acl_review_required', scenario);
      if (scenario === 'hidden_missing') assert.equal(value.result.reasonCode, 'not_found');
      if (scenario === 'metadata_denied') assert.equal(value.result.reasonCode, 'access_denied');
    } else if (['success','own_vm_acl','parent_create','hidden'].includes(scenario)) {
      assert.equal(value.result.status, 'created_off', JSON.stringify(value)); assert.equal(value.result.vmId, vmId);
      assert.deepEqual(value.events, ['directory_private','directory_private','disk','vm','settings','cpu','memory','firmware','shutdown_service']);
    } else {
      assert.equal(value.result.status, 'review_required', scenario); assert.equal(value.result.mutationAttempted, true);
      assert.ok(value.events.length > 0, scenario);
      if (['identity','running'].includes(scenario)) assert.ok(!value.events.includes('settings'));
      if (scenario.startsWith('child_group')) assert.equal(value.result.reasonCode, 'acl_review_required', scenario);
      if (scenario === 'child_unprotected') assert.equal(value.result.reasonCode, 'directory_not_protected');
      if (scenario === 'directory_race') { assert.equal(value.result.reasonCode, 'directory_exists'); assert.ok(!value.events.includes('disk')); }
    }
  }
});
