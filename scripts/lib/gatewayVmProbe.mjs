/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { assessHypervConfiguration, isVmGuid, vmPreparationResult } from './gatewayVmPreparation.mjs';

export const VM_PROBE_LIMIT = 64 * 1024;
export const VM_PROBE_TIMEOUT = 10000;

/** Capture privately. No raw stdout/stderr may reach a public result or exception. */
export function runVmProbe(file, args, { run = spawnSync, env = process.env, cwd } = {}) {
  try {
    const cleanEnv = { ...env, GIT_OPTIONAL_LOCKS: '0' };
    for (const name of Object.keys(cleanEnv)) if (/^DOCKER_/i.test(name)) delete cleanEnv[name];
    const result = run(file, args, { encoding: 'utf8', shell: false, windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'], timeout: VM_PROBE_TIMEOUT, killSignal: 'SIGKILL',
      maxBuffer: VM_PROBE_LIMIT, cwd, env: cleanEnv });
    if (result.error || result.status !== 0 || typeof result.stdout !== 'string'
      || Buffer.byteLength(result.stdout) >= VM_PROBE_LIMIT
      || Buffer.byteLength(String(result.stderr ?? '')) >= VM_PROBE_LIMIT) return null;
    return result.stdout;
  } catch { return null; }
}

export function captureHypervPreparation({ vmId, switchId, platform = process.platform,
  command = runVmProbe, systemRoot = process.env.SystemRoot } = {}) {
  if (!isVmGuid(vmId) || !isVmGuid(switchId)) throw new Error('gateway_vm_arguments_invalid');
  const unavailable = () => vmPreparationResult('host', [{ check: 'hyperv_observation', status: 'unavailable' }]);
  if (platform !== 'win32' || typeof systemRoot !== 'string' || !/^[a-z]:[\\/]/i.test(systemRoot)) return unavailable();
  // Only validated GUID literals enter this constant query. No names, paths or remote host arguments.
  const query = `Set-StrictMode -Version Latest;
$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue';
try {
  Import-Module Hyper-V -ErrorAction Stop;
  $vm = Get-VM -Id ([guid]'${vmId}');
  $cpu = Get-VMProcessor -VM $vm; $mem = Get-VMMemory -VM $vm;
  $disks = @(Get-VMHardDiskDrive -VM $vm | ForEach-Object {
    $disk = Get-VHD -Path $_.Path;
    @{size=[long]$disk.Size;type=[string]$disk.VhdType;format=[string]$disk.VhdFormat;parent=[bool]$disk.ParentPath}
  });
  $adapters = @(Get-VMNetworkAdapter -VM $vm | ForEach-Object { @{switchId=[string]$_.SwitchId} });
  $switch = Get-VMSwitch -Id ([guid]'${switchId}');
  $shutdown = @(Get-VMIntegrationService -VM $vm -Name 'Shutdown');
  if ($shutdown.Count -ne 1 -or $shutdown[0].Enabled -isnot [bool]) { throw 'shutdown_observation_unavailable' };
  @{vmId=[string]$vm.Id;generation=[int]$vm.Generation;cpus=[int]$cpu.Count;
    memoryBytes=[long]$mem.Startup;dynamicMemory=[bool]$mem.DynamicMemoryEnabled;
    disks=$disks;adapters=$adapters;switchId=[string]$switch.Id;switchType=[string]$switch.SwitchType;
    checkpoints=@(Get-VMSnapshot -VM $vm).Count;
    automaticStartAction=[string]$vm.AutomaticStartAction;automaticStopAction=[string]$vm.AutomaticStopAction;
    hostShutdownEnabled=$shutdown[0].Enabled} | ConvertTo-Json -Compress -Depth 4;
} catch { exit 2 }`;
  try {
    const raw = command(join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(query, 'utf16le').toString('base64')]);
    if (typeof raw !== 'string' || Buffer.byteLength(raw) >= VM_PROBE_LIMIT) return unavailable();
    return assessHypervConfiguration(JSON.parse(raw.trim().replace(/^\uFEFF/, '')), { vmId, switchId });
  } catch { return unavailable(); }
}
