/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

// Fixed local validation only. No SID construction, ACL grant or network action.
export const VM_IDENTITY_QUERY = String.raw`
  function Resolve-CreatedVmSid([guid]$id) {
    if ($id -eq [guid]::Empty) { throw 'vm_sid_unavailable' };
    try { $sid=[Security.Principal.NTAccount]::new('NT VIRTUAL MACHINE',[string]$id).Translate([Security.Principal.SecurityIdentifier]).Value }
    catch { throw 'vm_sid_unavailable' };
    if ($sid -notmatch '^S-1-5-83-1-(?:[0-9]+-){3}[0-9]+$') { throw 'vm_sid_unavailable' };
    return $sid;
  }
  function Test-DisconnectedVmAdapter([object[]]$adapters) {
    if ($null -eq $adapters -or $adapters.Count -ne 1 -or $null -eq $adapters[0]) { return $false };
    $adapter=$adapters[0];
    if ($adapter.Connected -isnot [bool] -or $adapter.Connected -or
      ($null -ne $adapter.SwitchName -and $adapter.SwitchName -isnot [string]) -or
      ![string]::IsNullOrEmpty($adapter.SwitchName)) { return $false };
    return ($null -eq $adapter.SwitchId -or
      ($adapter.SwitchId -is [guid] -and $adapter.SwitchId -eq [guid]::Empty));
  }
`;
