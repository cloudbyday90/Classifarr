param(
  [string]$ImageTag = "classifarr:issue-285-local",
  [string]$ContainerName = "classifarr-issue-285",
  [string]$DataDir = ".tmp\\issue-285\\classifarr-data",

  # Optional: path to a SQL dump to restore into the embedded Postgres DB before exporting.
  # Expected to be plain SQL compatible with `psql -f`.
  [string]$DbDumpPath = "",

  # Export args (match SOP defaults).
  [int]$SinceDays = 548,
  [int]$MinConfidence = 50,
  [string]$ExcludeMethod = "source_library",
  [int]$BatchSize = 1000,

  # Pair builder args.
  [int]$Seed = 285,
  [int]$NegativesPerExample = 4,
  [int]$HardNegativesPerExample = 2,
  [double]$MaxLibraryShare = 0.4,

  [switch]$KeepRunning
)

$ErrorActionPreference = "Stop"

function Resolve-AbsPath([string]$p) {
  return (Resolve-Path $p).Path
}

function Run-Checked([string]$Label, [scriptblock]$Cmd) {
  & $Cmd
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE"
  }
}

function Wait-ForHealth([int]$TimeoutSeconds = 180) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $resp = Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 "http://localhost:21324/health"
      if ($resp.StatusCode -eq 200) { return }
    } catch {
      Start-Sleep -Seconds 2
      continue
    }
    Start-Sleep -Seconds 2
  }
  throw "Timed out waiting for http://localhost:21324/health"
}

$RepoRoot = Resolve-AbsPath "."
$TmpDir = Join-Path $RepoRoot ".tmp"
$ExecDir = Join-Path $RepoRoot "execution"
$DataAbs = Join-Path $RepoRoot $DataDir

New-Item -ItemType Directory -Force -Path $TmpDir | Out-Null
New-Item -ItemType Directory -Force -Path $DataAbs | Out-Null

Write-Host "Building image: $ImageTag"
Run-Checked "docker build" { docker build -t $ImageTag $RepoRoot | Out-Null }

Write-Host "Starting container: $ContainerName"
try { docker rm -f $ContainerName | Out-Null } catch {}

# Mounts:
# - /app/.tmp : outputs for Issue 285 artifacts
# - /app/execution : Issue 285 execution scripts (read-only)
# - /app/data : embedded Postgres data dir (persisted under .tmp/issue-285/classifarr-data by default)
docker run -d `
  --name $ContainerName `
  -p 21324:21324 `
  -e TZ=America/New_York `
  -e POSTGRES_HOST=localhost `
  -e POSTGRES_PORT=5432 `
  -e POSTGRES_DB=classifarr `
  -e POSTGRES_USER=classifarr `
  -e "POSTGRES_PASSWORD=" `
  -v "${TmpDir}:/app/.tmp" `
  -v "${ExecDir}:/app/execution:ro" `
  -v "${DataAbs}:/app/data" `
  $ImageTag | Out-Null

Write-Host "Waiting for Classifarr to become healthy (embedded Postgres ready)..."
Wait-ForHealth

if ($DbDumpPath) {
  $dumpAbs = Resolve-AbsPath $DbDumpPath
  if (!(Test-Path $dumpAbs)) { throw "DbDumpPath not found: $dumpAbs" }

  Write-Host "Restoring DB dump into embedded Postgres: $dumpAbs"
  docker cp $dumpAbs "${ContainerName}:/tmp/issue_285_dump.sql"

  # Use local socket; auth is trust inside container.
  Run-Checked "psql restore" { docker exec $ContainerName sh -lc "psql -U classifarr -d classifarr -f /tmp/issue_285_dump.sql" | Out-Null }
}

Write-Host "Running Phase 2 export -> pairs -> eligibility inside container..."

$exportCmd = @(
  "node", "/app/execution/export_issue_285_dataset.mjs",
  "--outDir", "/app/.tmp/issue-285/dataset",
  "--sinceDays", "$SinceDays",
  "--minConfidence", "$MinConfidence",
  "--excludeMethod", "$ExcludeMethod",
  "--batchSize", "$BatchSize"
)
Run-Checked "export dataset" { docker exec $ContainerName @exportCmd }

$pairsCmd = @(
  "node", "/app/execution/build_issue_285_pairs.mjs",
  "--dataset", "/app/.tmp/issue-285/dataset/dataset.jsonl",
  "--libraries", "/app/.tmp/issue-285/dataset/libraries.json",
  "--outDir", "/app/.tmp/issue-285/pairs",
  "--seed", "$Seed",
  "--negativesPerExample", "$NegativesPerExample",
  "--hardNegativesPerExample", "$HardNegativesPerExample",
  "--maxLibraryShare", "$MaxLibraryShare"
)
Run-Checked "build pairs" { docker exec $ContainerName @pairsCmd }

$eligCmd = @(
  "node", "/app/execution/check_issue_285_eligibility.mjs",
  "--dataset", "/app/.tmp/issue-285/dataset/dataset.jsonl",
  "--datasetMeta", "/app/.tmp/issue-285/dataset/meta.json",
  "--pairsDir", "/app/.tmp/issue-285/pairs",
  "--outDir", "/app/.tmp/issue-285/eligibility"
)
Run-Checked "eligibility gate" { docker exec $ContainerName @eligCmd }

Write-Host "Phase 2 artifacts written under: $TmpDir\\issue-285\\"

if (-not $KeepRunning) {
  Write-Host "Stopping and removing container..."
  docker rm -f $ContainerName | Out-Null
} else {
  Write-Host "Leaving container running: $ContainerName"
}
