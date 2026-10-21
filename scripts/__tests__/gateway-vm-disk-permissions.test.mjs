/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, symlink, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { VM_DISK_PERMISSION_QUERY } from '../lib/gatewayVmDiskPermissionQuery.mjs';
import { PRIVATE_DIRECTORY_QUERY } from '../lib/gatewayVmDirectoryQuery.mjs';
import { planVmCreation, VM_CREATION_BOOTSTRAP } from '../lib/gatewayVmCreation.mjs';
import { vmCreationQuery } from '../lib/gatewayVmCreationQuery.mjs';
import { registryCommand } from '../lib/registryCommand.mjs';

const query = vmCreationQuery(planVmCreation({ vmParent: 'C:\\Fixture VMs', diskParent: 'D:\\Fixture Disks' }));
const pathGuard = query.slice(query.indexOf('  function Assert-PathTree('), query.indexOf('  function Assert-NameAbsent'));
const invoke = async input => {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (/^(?:systemroot|windir|systemdrive|temp|tmp|userprofile|localappdata|appdata|programfiles|programfiles\(x86\)|programw6432|comspec|pathext|path|allusersprofile|programdata)$/i.test(key)) env[key] = value;
  }
  env.PSModulePath = join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'Modules');
  const result = await registryCommand(join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(VM_CREATION_BOOTSTRAP, 'utf16le').toString('base64')],
    { input: `Set-StrictMode -Version Latest;$ErrorActionPreference='Stop';${input}`, env, timeoutMs: 10000, maxBytes: 65536 });
  assert.equal(result.ok, true, result.stderr); assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
};

test('disk permission boundary is shared, read-only, bounded and checked before accepting any template', () => {
  assert.equal(query.split(VM_DISK_PERMISSION_QUERY).length, 2);
  assert.ok(pathGuard.indexOf('directory_not_protected') < pathGuard.indexOf('Assert-PrivateDiskContents'));
  assert.ok(pathGuard.indexOf('Assert-PrivateDiskContents') < pathGuard.indexOf('Test-DiskCreatorOwnerTemplate'));
  assert.match(VM_DISK_PERMISSION_QUERY, /Get-ChildItem -LiteralPath \$c\.diskDirectory -Force -ErrorAction Stop \| Select-Object -First 2/);
  assert.doesNotMatch(VM_DISK_PERMISSION_QUERY, /Set-Acl|Remove-|New-|Start-|Stop-|Add-Type|-Recurse|Invoke-Expression/);
  assert.match(VM_DISK_PERMISSION_QUERY, /\$null -eq \$descriptor\.DiscretionaryAcl/);
  assert.match(query, /New-VHD[^\n]+\n    \$diskExpected=\$true;/);
  assert.match(query, /Resolve-CreatedVmSid \$createdId;\n    Assert-PathTree \$c\.vmDirectory; Assert-PathTree \$c\.diskDirectory;\n    Set-VM/);
});

test('real Windows rule objects require every exact field and owned disk context', { skip: process.platform !== 'win32' }, async () => {
  const values = await invoke(`${VM_DISK_PERMISSION_QUERY}
    $c=@{diskDirectory='C:\\owned';vmDirectory='C:\\vm'};$diskExpected=$true;
    $results=@(foreach($case in @(
      @{ace='(A;OICIIO;GA;;;CO)';path=$c.diskDirectory;depth=1;owned=$true;expected=$true},
      @{ace='(A;OICIIO;GA;;;CO)';path=$c.vmDirectory;depth=1;owned=$true;expected=$false},
      @{ace='(A;OICIIO;GA;;;CO)';path=$c.diskDirectory;depth=2;owned=$true;expected=$false},
      @{ace='(A;OICIIO;GA;;;CO)';path=$c.diskDirectory;depth=1;owned=$false;expected=$false},
      @{ace='(A;OICIIO;GA;;;WD)';expected=$false},
      @{ace='(A;OICIIO;GA;;;CG)';expected=$false},
      @{ace='(A;OICIIO;FA;;;CO)';expected=$false},
      @{ace='(A;OICIIO;0x10000001;;;CO)';expected=$false},
      @{ace='(A;OIIO;GA;;;CO)';expected=$false},
      @{ace='(A;CIIO;GA;;;CO)';expected=$false},
      @{ace='(A;OICI;GA;;;CO)';expected=$false},
      @{ace='(A;OICINPIO;GA;;;CO)';expected=$false},
      @{ace='(A;OICIIOID;GA;;;CO)';expected=$false},
      @{ace='(D;OICIIO;GA;;;CO)';expected=$false}
    )){
      $acl=[Security.AccessControl.DirectorySecurity]::new();$acl.SetSecurityDescriptorSddlForm('O:SYD:P'+$case.ace);
      $rule=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))[0];
      $path=$c.diskDirectory;$depth=1;$owned=$true;
      if($case.ContainsKey('path')){$path=$case.path;$depth=$case.depth;$owned=$case.owned};
      $actual=Test-DiskCreatorOwnerTemplate $rule $path $depth $owned;
      @{matched=($actual -is [bool] -and $actual -eq $case.expected)}
    });
    $diskExpected=$false;$acl.SetSecurityDescriptorSddlForm('O:SYD:P(A;OICIIO;GA;;;CO)');
    $rule=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))[0];
    $results+=@{matched=!(Test-DiskCreatorOwnerTemplate $rule $c.diskDirectory 1 $true)};
    ConvertTo-Json -InputObject $results -Compress`);
  assert.equal(values.length, 15); assert.ok(values.every(v => v.matched));
});

test('real Windows filesystem qualifies the production disk guard without changing existing permissions', { skip: process.platform !== 'win32' }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'classifarr-disk-permissions-'));
  try {
    const junctionDirectory = join(directory, 'junction-owner');
    const junctionTarget = join(directory, 'junction-target');
    await mkdir(junctionDirectory); await mkdir(junctionTarget);
    await symlink(junctionTarget, join(junctionDirectory, 'synthetic.vhdx'), 'junction');
    const data = Buffer.from(JSON.stringify({ path: join(directory, 'owned'), junctionDirectory })).toString('base64');
    // Only the ancestor traversal is excluded: this fixture qualifies the owned
    // root/file using actual metadata and ACLs, not the host's ancestor policy.
    const advance = '$current=[IO.Path]::GetDirectoryName($current);';
    assert.equal(pathGuard.split(advance).length, 2);
    const rootGuard = pathGuard.replace(advance, '$current=$null;');
    const result = await invoke(`${PRIVATE_DIRECTORY_QUERY}${VM_DISK_PERMISSION_QUERY}${rootGuard}
      Initialize-PrivateDirectoryNative;
      $fixture=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${data}'))|ConvertFrom-Json;$path=$fixture.path;
      $c=@{diskDirectory=$path;diskFile=(Join-Path $path 'synthetic.vhdx');vmDirectory=(Join-Path $path 'not-target')};
      $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User;$trusted=@($sid.Value);$createdSid=$null;$diskExpected=$false;
      $acl=[Security.AccessControl.DirectorySecurity]::new();
      $acl.SetSecurityDescriptorSddlForm(('O:{0}D:P(A;;FA;;;{0})(A;OICIIO;GA;;;CO)' -f $sid.Value));
      New-ExclusiveDirectory $path $acl;
      $reason=$null;try{Assert-PathTree $path}catch{$reason=[string]$_.Exception.Message};
      if($reason -ne 'acl_review_required'){throw 'empty_template_accepted'};
      [IO.File]::WriteAllText($c.diskFile,'synthetic, not a real VHD');$diskExpected=$true;
      $parentBefore=(Get-Acl -LiteralPath $path).Sddl;$fileBefore=(Get-Acl -LiteralPath $c.diskFile).Sddl;
      Assert-PathTree $path;
      if((Get-Acl -LiteralPath $path).Sddl -cne $parentBefore -or (Get-Acl -LiteralPath $c.diskFile).Sddl -cne $fileBefore){throw 'guard_changed_acl'};
      $extra=Join-Path $path 'hidden-extra';[IO.File]::WriteAllText($extra,'synthetic');
      [IO.File]::SetAttributes($extra,[IO.FileAttributes]::Hidden);
      $reason=$null;try{Assert-PathTree $path}catch{$reason=[string]$_.Exception.Message};
      if($reason -ne 'disk_contents_review_required'){throw 'hidden_extra_not_refused'};
      [IO.File]::Delete($extra);
      $fileAcl=Get-Acl -LiteralPath $c.diskFile;
      $fileAcl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new('S-1-1-0'),'Read','Allow'));
      Set-Acl -LiteralPath $c.diskFile -AclObject $fileAcl;
      $reason=$null;try{Assert-PathTree $path}catch{$reason=[string]$_.Exception.Message};
      if($reason -ne 'acl_review_required'){throw 'untrusted_file_read_not_refused'};
      $fileAcl.SetSecurityDescriptorSddlForm($fileBefore);Set-Acl -LiteralPath $c.diskFile -AclObject $fileAcl;
      # An ordinary new fixture directory is unprotected. No elevated privilege
      # or alteration of the protected parent's inheritance is needed to test it.
      $unprotected=Join-Path ([IO.Path]::GetDirectoryName($path)) 'unprotected';
      [IO.Directory]::CreateDirectory($unprotected)|Out-Null;$c.diskDirectory=$unprotected;
      $reason=$null;try{Assert-PathTree $unprotected}catch{$reason=[string]$_.Exception.Message};
      if($reason -ne 'directory_not_protected'){throw 'unprotected_not_refused'};
      $c.diskDirectory=$fixture.junctionDirectory;$c.diskFile=Join-Path $c.diskDirectory 'synthetic.vhdx';
      $reason=$null;try{Assert-PrivateDiskContents}catch{$reason=[string]$_.Exception.Message};
      if($reason -ne 'path_review_required'){throw 'junction_not_refused'};
      @{acceptedExactTemplate=$true;emptyRefused=$true;permissionsUnchanged=$true;hiddenExtraRefused=$true;untrustedReadRefused=$true;unprotectedRefused=$true;junctionRefused=$true}|ConvertTo-Json -Compress`);
    assert.deepEqual(result, { acceptedExactTemplate: true, emptyRefused: true, permissionsUnchanged: true,
      hiddenExtraRefused: true, untrustedReadRefused: true, unprotectedRefused: true, junctionRefused: true });
    await access(junctionTarget);
  } finally {
    await rm(directory, { recursive: true, force: true });
    await assert.rejects(access(directory), { code: 'ENOENT' });
  }
});

test('production disk checks reject missing, null, hostile and excessive observations with bounded inventory', { skip: process.platform !== 'win32' }, async () => {
  const values = await invoke(`${VM_DISK_PERMISSION_QUERY}
    $c=@{diskDirectory='C:\\owned';diskFile='C:\\owned\\synthetic.vhdx'};$diskExpected=$true;
    $trusted=@('S-1-5-18');$createdSid='S-1-5-83-1-1-2-3-4';
    function Get-ChildItem{[CmdletBinding()]param([string]$LiteralPath,[switch]$Force)
      if(!$Force -or $LiteralPath -cne $c.diskDirectory){throw 'bad_inventory'};
      if($case -eq 'read_failure'){throw 'access_denied'};
      if($case -eq 'absent'){return};
      $script:enumerated++;
      [pscustomobject]@{FullName=$(if($case -eq 'wrong_path'){'C:\\unexpected'}else{$c.diskFile});
        PSIsContainer=($case -eq 'directory');Attributes=$(if($case -eq 'reparse'){[IO.FileAttributes]::ReparsePoint}else{[IO.FileAttributes]::Archive})};
      if($case -eq 'many'){foreach($n in 1..1000){$script:enumerated++;[pscustomobject]@{FullName='unexpected'}}}
    }
    function Get-Acl{[CmdletBinding()]param([string]$LiteralPath)
      if($case -eq 'acl_read_failure'){throw 'access_denied'};
      $acl=[Security.AccessControl.FileSecurity]::new();
      $owner=$(if($case -eq 'owner'){'S-1-1-0'}else{'S-1-5-18'});
      $grant=$(if($case -eq 'foreign_vm'){'S-1-5-83-1-5-6-7-8'}elseif($case -eq 'group'){'S-1-5-83-0'}
        elseif($case -eq 'own_vm'){$createdSid}elseif($case -eq 'creator_owner'){'S-1-3-0'}else{'S-1-5-18'});
      $acl.SetSecurityDescriptorSddlForm(('O:{0}D:(A;;FA;;;{1})' -f $owner,$grant));
      if($case -eq 'null_acl'){$acl.SetSecurityDescriptorSddlForm('O:SYD:NO_ACCESS_CONTROL')};
      if($case -eq 'many_rules'){
        $sddl='O:SYD:';foreach($n in 1..257){$sddl+='(A;;FR;;;S-1-5-21-1-2-3-'+$n+')'};$acl.SetSecurityDescriptorSddlForm($sddl)
      };
      return $acl
    }
    $results=@(foreach($case in @('success','own_vm','absent','wrong_path','directory','reparse','owner','foreign_vm','group','creator_owner',
      'null_acl','many_rules','many','read_failure','acl_read_failure')){
      $script:enumerated=0;$reason=$null;try{Assert-PrivateDiskContents}catch{$reason=[string]$_.Exception.Message};
      @{case=$case;reason=$reason;enumerated=$script:enumerated}
    });ConvertTo-Json -InputObject $results -Compress`);
  const reasons = { success: null, own_vm: null, absent: 'disk_contents_review_required', wrong_path: 'path_review_required',
    directory: 'path_review_required', reparse: 'path_review_required', owner: 'owner_review_required',
    foreign_vm: 'acl_review_required', group: 'acl_review_required', creator_owner: 'acl_review_required',
    null_acl: 'acl_review_required', many_rules: 'acl_limit', many: 'disk_contents_review_required',
    read_failure: 'access_denied', acl_read_failure: 'access_denied' };
  assert.equal(values.length, Object.keys(reasons).length);
  values.forEach(v => { assert.equal(v.reason, reasons[v.case], v.case); assert.ok(v.enumerated <= 2, v.case); });
});

test('full production root guard rejects wrong templates, untrusted roots and descriptor drift during inventory', { skip: process.platform !== 'win32' }, async () => {
  const rootGuard = pathGuard.replace('$current=[IO.Path]::GetDirectoryName($current);', '$current=$null;');
  const values = await invoke(`${VM_DISK_PERMISSION_QUERY}${rootGuard}
    $c=@{diskDirectory='C:\\owned';diskFile='C:\\owned\\synthetic.vhdx';vmDirectory='C:\\vm'};
    $diskExpected=$true;$trusted=@('S-1-5-18');$createdSid=$null;
    function Get-Item{[CmdletBinding()]param([string]$LiteralPath,[switch]$Force)
      [pscustomobject]@{PSIsContainer=$true;FullName=$LiteralPath;Attributes=[IO.FileAttributes]::Directory}
    }
    function Get-Acl{[CmdletBinding()]param([string]$LiteralPath)
      if($LiteralPath -eq $c.diskFile){return $fileAcl};return $rootAcl
    }
    function Get-ChildItem{[CmdletBinding()]param([string]$LiteralPath,[switch]$Force)
      if($case -eq 'drift'){$rootAcl.SetSecurityDescriptorSddlForm('O:SYD:P(A;;FA;;;SY)(A;OICIIO;FA;;;CO)')};
      [pscustomobject]@{PSIsContainer=$false;FullName=$c.diskFile;Attributes=[IO.FileAttributes]::Archive}
    }
    $results=@(foreach($case in @('success','no_template','wrong_target','owner','unprotected','extra_grant','wrong_mask','wrong_flags','drift')){
      $rootAcl=[Security.AccessControl.DirectorySecurity]::new();
      $rootAcl.SetSecurityDescriptorSddlForm('O:SYD:P(A;;FA;;;SY)(A;OICIIO;GA;;;CO)');
      $fileAcl=[Security.AccessControl.FileSecurity]::new();$fileAcl.SetSecurityDescriptorSddlForm('O:SYD:(A;;FA;;;SY)');
      if($case -eq 'no_template'){$rootAcl.SetSecurityDescriptorSddlForm('O:SYD:P(A;;FA;;;SY)')};
      if($case -eq 'owner'){$rootAcl.SetOwner([Security.Principal.SecurityIdentifier]::new('S-1-1-0'))};
      if($case -eq 'unprotected'){$rootAcl.SetAccessRuleProtection($false,$true)};
      if($case -eq 'extra_grant'){$rootAcl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new('Everyone','Read','Allow'))};
      if($case -eq 'wrong_mask'){$rootAcl.SetSecurityDescriptorSddlForm('O:SYD:P(A;;FA;;;SY)(A;OICIIO;FA;;;CO)')};
      if($case -eq 'wrong_flags'){$rootAcl.SetSecurityDescriptorSddlForm('O:SYD:P(A;;FA;;;SY)(A;CIIO;GA;;;CO)')};
      $target=$(if($case -eq 'wrong_target'){$c.vmDirectory}else{$c.diskDirectory});
      $reason=$null;try{Assert-PathTree $target}catch{$reason=[string]$_.Exception.Message};
      @{case=$case;reason=$reason}
    });ConvertTo-Json -InputObject $results -Compress`);
  const reasons = { success: null, no_template: null, wrong_target: 'acl_review_required', owner: 'owner_review_required',
    unprotected: 'directory_not_protected', extra_grant: 'acl_review_required', wrong_mask: 'acl_review_required',
    wrong_flags: 'acl_review_required', drift: 'acl_review_required' };
  assert.equal(values.length, Object.keys(reasons).length);
  values.forEach(v => assert.equal(v.reason, reasons[v.case], v.case));
});
