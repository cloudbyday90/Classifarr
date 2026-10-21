# Restricted Hyper-V child local identity

Technical correction to the approved one-shot creator, researched 21 October
2026. No new provisioner, persistent setting, permission policy or VM operation.

## Evidence and contract

The production environment filter intentionally excludes private variables and
caller-controlled module paths. It also omitted `COMPUTERNAME`. With that exact
restricted environment, the installed Hyper-V `Get-VM` fails with an inner
`ArgumentNullException`, even in the administrator's session. In matched fresh
children, setting only the process-local variable to `Environment.MachineName`
makes the administrator inventory succeed. Built-in module paths, command,
identity, time/output limits and read-only query stay unchanged. No service or
permissions repair is indicated by this result.

Derive `COMPUTERNAME` inside the fixed bootstrap from the OS, before input is read
or Hyper-V modules execute. Do not forward its parent value, accept a remote-host
argument or log the real name. Set stop-on-error first: failure to obtain identity
must prevent input execution. Keep the existing token, ACL, reparse, capacity,
bounded inventory, collision, exclusive-directory and off-state guards intact.
No user/machine environment registry, host service, shared folder or network is
modified. The bootstrap remains bounded by the existing one-shot capture.

## Alternatives and recommendation

| Option | Advantage | Weakness |
| --- | --- | --- |
| Restore the full parent environment | Easy compatibility | Reintroduces secrets and caller-controlled process configuration |
| Forward parent `COMPUTERNAME` only | Small allowlist change | Trusts a mutable caller value as Hyper-V's implicit target |
| Derive local identity inside the child | Local OS identity; preserves filtering | Windows-specific dependency must be regression-tested |
| Add explicit localhost parameters everywhere | Clear call-site target | Broad cmdlet-by-cmdlet change; must cover future calls and object-bound parameter sets |

Choose the derived child identity with a restricted environment and built-in
module lookup. Do not weaken inventory failure into an empty successful result.
Re-run the complete read-only preflight before a later manual write attempt;
an observation is not an atomic reservation or permission to retry an uncertain
operation. No new database/table or UUID is involved.

## Verification

Add a failing real Windows PowerShell bootstrap regression first. Replace the
entire creator input with a harmless environment read: no VM cmdlet or filesystem
write can execute. Require a nonempty native local identity despite a poisoned
caller value, absent private variables, unchanged parent state and fixed bootstrap
ordering. Inject a synthetic native-identity failure and verify even a harmless
input marker cannot run. Keep actual native directory tests and synthetic VM
sequencing tests separate from administrator observations and Linux image checks.

## Official sources

Located and opened through the search MCP on 21 October 2026:

- [Environment.MachineName](https://learn.microsoft.com/en-us/dotnet/api/system.environment.machinename?view=net-10.0):
  provides the local computer's NetBIOS name; inability to obtain it is an error.
- [PowerShell environment scopes](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_environment_variables):
  session environment assignments affect the process, not persistent user/machine
  settings. Production execution is separately tested on Windows PowerShell 5.1.
- [Get-VM](https://learn.microsoft.com/en-us/powershell/module/hyper-v/get-vm?view=windowsserver2022-ps&wt.mc_id=ps-gethelp):
  its implicit target is local. The specific environment dependency is observed
  behavior of the installed module, not a documented cross-version guarantee.
