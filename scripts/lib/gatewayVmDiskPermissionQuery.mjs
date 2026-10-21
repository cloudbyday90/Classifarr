/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

// Fixed, read-only functions. Only a protected owned disk directory may use the
// reviewed template; callers must validate its owner/protection before matching.
// Never add CREATOR OWNER to the general trusted-principal list.
export const VM_DISK_PERMISSION_QUERY = String.raw`
  function Test-DiskCreatorOwnerTemplate([Security.AccessControl.FileSystemAccessRule]$rule,[string]$path,[int]$depth,[bool]$owned) {
    return ($owned -and $depth -eq 1 -and $diskExpected -is [bool] -and $diskExpected -and
      [string]::Equals($path,$c.diskDirectory,[StringComparison]::OrdinalIgnoreCase) -and
      $rule.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow -and
      $rule.IdentityReference.Value -eq 'S-1-3-0' -and [long]$rule.FileSystemRights -eq 268435456 -and
      !$rule.IsInherited -and [int]$rule.InheritanceFlags -eq 3 -and [int]$rule.PropagationFlags -eq 2);
  }
  function Assert-PrivateDiskContents {
    if ($diskExpected -isnot [bool]) { throw 'disk_contents_review_required' };
    $children=@(Get-ChildItem -LiteralPath $c.diskDirectory -Force -ErrorAction Stop | Select-Object -First 2);
    if ($children.Count -ne $(if($diskExpected){1}else{0})) { throw 'disk_contents_review_required' };
    if (!$diskExpected) { return };
    $file=$children[0];
    if ($file.PSIsContainer -isnot [bool] -or $file.PSIsContainer -or
      ($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
      ![string]::Equals($file.FullName,$c.diskFile,[StringComparison]::OrdinalIgnoreCase)) { throw 'path_review_required' };
    $fileAcl=Get-Acl -LiteralPath $c.diskFile -ErrorAction Stop;
    if ($trusted -notcontains $fileAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value) { throw 'owner_review_required' };
    # An empty list of rules is not proof of restriction: a null DACL allows
    # everyone. Inspect the real descriptor, not a formatted ACL/rule count.
    $descriptor=[Security.AccessControl.RawSecurityDescriptor]::new($fileAcl.GetSecurityDescriptorBinaryForm(),0);
    if ($null -eq $descriptor.DiscretionaryAcl) { throw 'acl_review_required' };
    $fileRules=@($fileAcl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]));
    if ($fileRules.Count -gt 256) { throw 'acl_limit' };
    $fileWriters=@($trusted);
    if ($createdSid) { $fileWriters=$fileWriters + @($createdSid) };
    foreach ($fileRule in $fileRules) {
      if ($fileRule.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow -and
        $fileRule.FileSystemRights -and $fileWriters -notcontains $fileRule.IdentityReference.Value) { throw 'acl_review_required' };
    };
  }
`;
