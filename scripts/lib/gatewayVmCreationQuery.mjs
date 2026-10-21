/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export const VM_CREATION_REASONS = Object.freeze(['administrator_required', 'path_depth', 'path_review_required',
  'owner_review_required', 'acl_limit', 'acl_review_required', 'inventory_limit', 'vm_exists',
  'vm_identity_or_state_changed', 'directory_not_protected', 'capacity_required', 'storage_capacity_required',
  'directory_exists', 'disk_exists', 'created_identity_missing', 'configuration_mismatch', 'disk_mismatch',
  'vm_sid_unavailable', 'not_found', 'access_denied', 'query_failed', 'unsupported', 'invalid_argument', 'target_exists']);

/** Fixed commands; paths/profile travel as base64 JSON data, never executable source. */
export function vmCreationQuery(plan) {
  const data = Buffer.from(JSON.stringify(plan), 'utf8').toString('base64');
  return `$creationData='${data}';\n` + String.raw`& {
  Set-StrictMode -Version Latest;
  $ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue';
  $stage='preflight'; $changed=$false; $createdSid=$null;
  function Assert-Administrator {
    $identity=[Security.Principal.WindowsIdentity]::GetCurrent();
    $principal=[Security.Principal.WindowsPrincipal]::new($identity);
    if (!$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'administrator_required' }
  }
  function Assert-PathTree([string]$path) {
    $current=$path; $depth=0;
    while ($current) {
      $depth++; if ($depth -gt 32) { throw 'path_depth' };
      $item=Get-Item -LiteralPath $current -ErrorAction Stop;
      if (!$item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
        ![string]::Equals($item.FullName,$current,[StringComparison]::OrdinalIgnoreCase)) { throw 'path_review_required' };
      $acl=Get-Acl -LiteralPath $current -ErrorAction Stop;
      if ($trusted -notcontains $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value) { throw 'owner_review_required' };
      $rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]));
      if ($rules.Count -gt 256) { throw 'acl_limit' };
      $mask=[Security.AccessControl.FileSystemRights]::Delete -bor [Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles -bor
        [Security.AccessControl.FileSystemRights]::ChangePermissions -bor [Security.AccessControl.FileSystemRights]::TakeOwnership;
      if ($depth -eq 1) { $mask=$mask -bor [Security.AccessControl.FileSystemRights]::Write };
      $writers=$trusted;
      if ($depth -eq 1 -and $createdSid -and (@($c.vmDirectory,$c.diskDirectory) -contains $current)) {
        $writers=$writers + @($createdSid);
      };
      foreach ($rule in $rules) {
        if ($rule.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow -and
          !($rule.PropagationFlags -band [Security.AccessControl.PropagationFlags]::InheritOnly) -and
          ($rule.FileSystemRights -band $mask) -and $writers -notcontains $rule.IdentityReference.Value) { throw 'acl_review_required' }
      };
      $current=[IO.Path]::GetDirectoryName($current);
    }
  }
  function Assert-NameAbsent {
    $vms=@(Get-VM -ErrorAction Stop | Select-Object -First 257);
    if ($vms.Count -gt 256) { throw 'inventory_limit' };
    foreach ($existing in $vms) {
      if ([string]::Equals($existing.Name,$c.name,[StringComparison]::OrdinalIgnoreCase)) { throw 'vm_exists' }
    }
  }
  function Resolve-CreatedVmSid([guid]$id) {
    try { $sid=[Security.Principal.NTAccount]::new('NT VIRTUAL MACHINE',[string]$id).Translate([Security.Principal.SecurityIdentifier]).Value }
    catch { throw 'vm_sid_unavailable' };
    if ($sid -notmatch '^S-1-5-83-0-(?:[0-9]+-){3}[0-9]+$') { throw 'vm_sid_unavailable' };
    return $sid;
  }
  function Assert-Off {
    $observed=Get-VM -Id $createdId -ErrorAction Stop;
    if ($observed.Id -ne $createdId -or [string]$observed.State -ne 'Off' -or
      ![string]::Equals($observed.Name,$c.name,[StringComparison]::OrdinalIgnoreCase) -or
      (!$observed.Path.StartsWith($c.vmDirectory + '\',[StringComparison]::OrdinalIgnoreCase) -and
      ![string]::Equals($observed.Path,$c.vmDirectory,[StringComparison]::OrdinalIgnoreCase))) { throw 'vm_identity_or_state_changed' };
    return $observed;
  }
  function New-PrivateDirectory([string]$path) {
    New-Item -Path $path -ItemType Directory -ErrorAction Stop | Out-Null;
    $security=[Security.AccessControl.DirectorySecurity]::new();
    $security.SetOwner([Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'));
    $security.SetAccessRuleProtection($true,$false);
    foreach ($sid in @('S-1-5-18','S-1-5-32-544')) {
      $rule=[Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),
        [Security.AccessControl.FileSystemRights]::FullControl,
        ([Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit),
        [Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow);
      $security.AddAccessRule($rule);
    };
    Set-Acl -LiteralPath $path -AclObject $security -ErrorAction Stop;
    Assert-PathTree $path;
    if (!(Get-Acl -LiteralPath $path -ErrorAction Stop).AreAccessRulesProtected) { throw 'directory_not_protected' }
  }
  try {
    Assert-Administrator;
    Import-Module Hyper-V -ErrorAction Stop;
    Import-Module Storage -ErrorAction Stop;
    $c=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($creationData)) | ConvertFrom-Json;
    $installer=[Security.Principal.NTAccount]::new('NT SERVICE','TrustedInstaller').Translate([Security.Principal.SecurityIdentifier]).Value;
    $trusted=@('S-1-5-18','S-1-5-32-544','S-1-5-32-578',$installer);
    $stage='permissions'; Assert-PathTree $c.vmParent; Assert-PathTree $c.diskParent;
    $stage='capacity';
    $os=Get-CimInstance Win32_OperatingSystem -ErrorAction Stop;
    $cpu=Get-CimInstance Win32_ComputerSystem -ErrorAction Stop;
    if ($null -eq $os.FreePhysicalMemory -or [double]$os.FreePhysicalMemory -lt 16MB -or
      $null -eq $cpu.NumberOfLogicalProcessors -or [int]$cpu.NumberOfLogicalProcessors -lt 4) { throw 'capacity_required' };
    foreach ($parent in @($c.vmParent,$c.diskParent)) {
      $volumes=@(Get-Volume -FilePath $parent -ErrorAction Stop);
      if ($volumes.Count -ne 1 -or $null -eq $volumes[0].SizeRemaining -or
        [double]$volumes[0].SizeRemaining -lt 96GB -or [string]$volumes[0].DriveType -ne 'Fixed' -or
        @('NTFS','ReFS') -notcontains [string]$volumes[0].FileSystemType) { throw 'storage_capacity_required' }
    };
    $stage='collisions'; Assert-NameAbsent;
    if ((Test-Path -LiteralPath $c.vmDirectory -ErrorAction Stop) -or
      (Test-Path -LiteralPath $c.diskDirectory -ErrorAction Stop)) { throw 'directory_exists' };
    $stage='directories'; $changed=$true;
    New-PrivateDirectory $c.vmDirectory; New-PrivateDirectory $c.diskDirectory;
    $stage='disk'; Assert-NameAbsent; Assert-PathTree $c.diskDirectory;
    if (Test-Path -LiteralPath $c.diskFile -ErrorAction Stop) { throw 'disk_exists' };
    New-VHD -Path $c.diskFile -Fixed -SizeBytes $c.diskBytes -ErrorAction Stop | Out-Null;
    $stage='vm'; Assert-NameAbsent; Assert-PathTree $c.vmDirectory;
    $vm=New-VM -Name $c.name -Generation $c.generation -MemoryStartupBytes $c.memoryBytes -Path $c.vmDirectory -VHDPath $c.diskFile -ErrorAction Stop;
    if ($vm.Id -isnot [guid] -or $vm.Id -eq [guid]::Empty) { throw 'created_identity_missing' };
    $createdId=$vm.Id;
    $stage='settings'; $vm=Assert-Off;
    $createdSid=Resolve-CreatedVmSid $createdId;
    Set-VM -VM $vm -AutomaticStartAction Nothing -AutomaticStopAction ShutDown -AutomaticCheckpointsEnabled $false -CheckpointType Disabled -ErrorAction Stop;
    $vm=Assert-Off; Set-VMProcessor -VM $vm -Count $c.cpus -ErrorAction Stop;
    $vm=Assert-Off; Set-VMMemory -VM $vm -DynamicMemoryEnabled $false -StartupBytes $c.memoryBytes -ErrorAction Stop;
    $vm=Assert-Off; Set-VMFirmware -VM $vm -EnableSecureBoot On -SecureBootTemplate MicrosoftUEFICertificateAuthority -ErrorAction Stop;
    $vm=Assert-Off; Enable-VMIntegrationService -VM $vm -Name 'Shutdown' -ErrorAction Stop;
    $stage='verify'; $vm=Assert-Off;
    $processor=Get-VMProcessor -VM $vm -ErrorAction Stop;
    $memory=Get-VMMemory -VM $vm -ErrorAction Stop;
    $firmware=Get-VMFirmware -VM $vm -ErrorAction Stop;
    $disks=@(Get-VMHardDiskDrive -VM $vm -ErrorAction Stop);
    $adapters=@(Get-VMNetworkAdapter -VM $vm -ErrorAction Stop);
    $shutdown=@(Get-VMIntegrationService -VM $vm -Name 'Shutdown' -ErrorAction Stop);
    if ([int]$vm.Generation -ne $c.generation -or [int]$processor.Count -ne $c.cpus -or
      [long]$memory.Startup -ne $c.memoryBytes -or $memory.DynamicMemoryEnabled -isnot [bool] -or $memory.DynamicMemoryEnabled -or
      [string]$vm.AutomaticStartAction -ne 'Nothing' -or [string]$vm.AutomaticStopAction -ne 'ShutDown' -or
      $vm.AutomaticCheckpointsEnabled -isnot [bool] -or $vm.AutomaticCheckpointsEnabled -or [string]$vm.CheckpointType -ne 'Disabled' -or
      @(Get-VMSnapshot -VM $vm -ErrorAction Stop).Count -ne 0 -or $disks.Count -ne 1 -or
      ![string]::Equals($disks[0].Path,$c.diskFile,[StringComparison]::OrdinalIgnoreCase) -or
      $adapters.Count -ne 1 -or [string]$adapters[0].SwitchId -ne [string][guid]::Empty -or
      [string]$firmware.SecureBoot -ne 'On' -or [string]$firmware.SecureBootTemplate -ne 'MicrosoftUEFICertificateAuthority' -or
      $shutdown.Count -ne 1 -or $shutdown[0].Enabled -isnot [bool] -or !$shutdown[0].Enabled) { throw 'configuration_mismatch' };
    $disk=Get-VHD -Path $c.diskFile -ErrorAction Stop;
    if ([long]$disk.Size -ne $c.diskBytes -or [string]$disk.VhdType -ne 'Fixed' -or
      [string]$disk.VhdFormat -ne 'VHDX' -or $disk.ParentPath) { throw 'disk_mismatch' };
    Assert-PathTree $c.vmDirectory; Assert-PathTree $c.diskDirectory;
    $vm=Assert-Off;
    @{status='created_off';stage='verify';mutationAttempted=$true;vmId=[string]$createdId} | ConvertTo-Json -Compress;
  } catch {
    $reason='query_failed';
    switch ([string]$_.CategoryInfo.Category) {
      'ObjectNotFound' { $reason='not_found' }
      'PermissionDenied' { $reason='access_denied' }
      'SecurityError' { $reason='access_denied' }
      'ResourceExists' { $reason='target_exists' }
      'InvalidArgument' { $reason='invalid_argument' }
      'NotImplemented' { $reason='unsupported' }
    };
    $known='__CREATION_REASONS__' | ConvertFrom-Json;
    if ($known -ccontains [string]$_.Exception.Message) { $reason=[string]$_.Exception.Message };
    @{status=$(if($changed){'review_required'}else{'blocked'});stage=$stage;reasonCode=$reason;mutationAttempted=$changed} | ConvertTo-Json -Compress
  }
}`.replace('__CREATION_REASONS__', JSON.stringify(VM_CREATION_REASONS));
}
