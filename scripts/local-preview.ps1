# Run from a Windows Pane terminal, after the human approves loading 1Password secrets.
# Stop from another terminal with -Stop; Ctrl-C can strand Windows batch wrappers.
param(
  [switch]$Approved,
  [switch]$Resolved,
  [switch]$Stop,
  [string]$EnvFile
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$stateFile = Join-Path $repo '.local-preview.json'

function Get-PreviewProcess {
  if (-not (Test-Path -LiteralPath $stateFile)) { return $null }
  $state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
  if ($state.repo -ne $repo -or -not $state.pid -or -not $state.startedAtTicks) {
    throw 'Invalid local preview state; refusing to stop any process.'
  }
  try { $process = [System.Diagnostics.Process]::GetProcessById([int]$state.pid) }
  catch [System.ArgumentException] { return $null } # Exited; the state file is stale.
  if ($process.StartTime.ToUniversalTime().Ticks -ne [long]$state.startedAtTicks) { return $null }
  return $process
}

if ($Stop) {
  $process = Get-PreviewProcess
  if ($process) {
    & taskkill.exe /PID $process.Id /T /F | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not stop the preview process tree.' }
    Write-Output 'Stopped local preview process tree.'
  } else {
    Write-Output 'No running preview recorded for this worktree.'
  }
  Remove-Item -LiteralPath $stateFile -ErrorAction SilentlyContinue
  return
}

$commonGitDir = (& git -C $repo rev-parse --path-format=absolute --git-common-dir)
if ($LASTEXITCODE -ne 0 -or -not $commonGitDir) { throw 'Could not locate the base repository.' }
$baseRepo = Split-Path $commonGitDir.Trim() -Parent
$contextFile = Join-Path $baseRepo '.neon'
if (-not (Test-Path -LiteralPath $contextFile)) {
  throw 'Missing local Neon context. Set context for the development project in the base repository first.'
}
$context = Get-Content -LiteralPath $contextFile -Raw | ConvertFrom-Json
$projectId = $context.projectId
if (-not $projectId) { throw 'Local Neon context has no project ID.' }

if (-not $EnvFile) { $EnvFile = Join-Path $baseRepo '.env.local' }
if (-not (Test-Path -LiteralPath $EnvFile -PathType Leaf)) {
  throw 'Missing local 1Password reference file (.env.local).'
}
$EnvFile = (Resolve-Path -LiteralPath $EnvFile).Path
foreach ($command in @('op', 'neonctl', 'volta')) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) { throw "Missing required CLI: $command" }
}
if (-not $Approved) { throw 'Ask the human to approve 1Password access, then rerun with -Approved.' }
if (-not $Resolved -and (Get-PreviewProcess)) {
  throw 'A preview is already running for this worktree. Use -Stop first.'
}
if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
  throw 'Port 3000 is already in use. Stop the previous preview before starting another.'
}

# 1Password resolves the ignored file only inside this child process. Never log
# DATABASE_URL or the connection strings returned by neonctl.
if (-not $Resolved) {
  $current = [System.Diagnostics.Process]::GetCurrentProcess()
  @{ pid = $PID; startedAtTicks = $current.StartTime.ToUniversalTime().Ticks; repo = $repo } |
    ConvertTo-Json -Compress | Set-Content -LiteralPath $stateFile
  try {
    & op run "--env-file=$EnvFile" -- powershell.exe -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath -Approved -Resolved -EnvFile $EnvFile
    exit $LASTEXITCODE
  } finally {
    Remove-Item -LiteralPath $stateFile -ErrorAction SilentlyContinue
  }
}

if (-not $env:DATABASE_URL) { throw '1Password did not resolve DATABASE_URL.' }
# The local branch ID comes from Neon, not from checked-in configuration.
$branch = & neonctl branches get local --project-id $projectId --output json --no-color 2>$null | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or -not $branch) { throw 'Could not verify the Neon local branch.' }
if ($branch.branch) { $branch = $branch.branch }
if ($branch.name -ne 'local' -or -not $branch.id -or -not $branch.parent_id -or
    $branch.default -ne $false -or $branch.protected -ne $false -or
    $branch.project_id -ne $projectId) {
  throw 'Neon local branch is missing, default, protected, or has no parent.'
}

$direct = & neonctl connection-string $branch.id --project-id $projectId --database-name neondb --no-color 2>$null
if ($LASTEXITCODE -ne 0 -or -not $direct) { throw 'Could not verify the direct local endpoint.' }
$pooled = & neonctl connection-string $branch.id --project-id $projectId --database-name neondb --pooled --no-color 2>$null
if ($LASTEXITCODE -ne 0 -or -not $pooled) { throw 'Could not verify the pooled local endpoint.' }
try {
  $target = [uri]$env:DATABASE_URL
  $hosts = @(([uri]$direct.Trim()).Host, ([uri]$pooled.Trim()).Host)
  $isLocal = $target.Scheme -in @('postgres', 'postgresql') -and
    $target.Host -in $hosts -and $target.AbsolutePath.Trim('/') -eq 'neondb'
} catch {
  throw 'DATABASE_URL is not a valid Neon local database URL.'
}
if (-not $isLocal) { throw 'DATABASE_URL does not target the Neon local neondb database.' }
Write-Output 'Verified: Neon local child branch and resolved development database.'

$env:SITE_URL = 'http://localhost:3000'
$env:CONSENT_FEATURE_ENABLED = 'true' # Local-only; never enable the production gate.
$pins = Get-Content -LiteralPath (Join-Path $repo 'package.json') -Raw | ConvertFrom-Json
if (-not $pins.volta.node -or -not $pins.volta.npm) { throw 'Missing Volta versions in package.json.' }
Set-Location $repo
& volta run --node $pins.volta.node --npm $pins.volta.npm npm run db:migrate
if ($LASTEXITCODE -ne 0) { throw 'Local migration failed; dev server was not started.' }
Write-Output 'Starting local preview at http://localhost:3000 (use -Stop from another terminal to stop).'
& volta run --node $pins.volta.node --npm $pins.volta.npm npm run dev
exit $LASTEXITCODE
