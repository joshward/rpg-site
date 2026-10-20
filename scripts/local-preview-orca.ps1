# Create a visible testing terminal in the current local Windows Orca workspace.
# Invoke only after a human requests/approves this preview session. That request
# authorizes the launcher; 1Password still handles its own approval separately.
# -CheckOnly prints a marker and never starts the app.
param([switch]$CheckOnly)

$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'This preview helper requires a local Windows Orca host.' }
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$cli = if ($env:ORCA_CLI_COMMAND) { $env:ORCA_CLI_COMMAND } elseif ($env:ORCA_DEV_REPO_ROOT) { 'orca-dev' } else { 'orca' }
if (-not (Get-Command $cli -ErrorAction SilentlyContinue)) { throw "Orca CLI is not available: $cli" }

function Invoke-OrcaJson([string[]]$Arguments) {
  $raw = & $cli @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Orca command failed: $($Arguments[0..1] -join ' '). Do not switch CLI executables or retry blindly." }
  try { $reply = $raw | ConvertFrom-Json } catch { throw 'Orca returned invalid JSON. Inspect its status before retrying.' }
  if ($reply.ok -ne $true) { throw "Orca rejected the command: $($reply.error.code) $($reply.error.message)" }
  return $reply
}

$status = Invoke-OrcaJson -Arguments @('status', '--json')
if ($status.result.target.kind -ne 'local' -or $status.result.runtime.state -ne 'ready' -or -not $status.result.runtime.reachable) {
  throw 'Orca is not a reachable local runtime. Do not launch a detached fallback.'
}
$current = Invoke-OrcaJson -Arguments @('worktree', 'current', '--json')
$workspace = $current.result.worktree
if (-not $workspace.id -or $workspace.hostId -ne 'local' -or -not $workspace.path -or
    [IO.Path]::GetFullPath($workspace.path) -ne [IO.Path]::GetFullPath($repo)) {
  throw 'The current Orca workspace does not match this local preview checkout.'
}
if (-not $CheckOnly) {
  if (Test-Path -LiteralPath (Join-Path $repo '.local-preview.json')) { throw 'A preview record already exists. Inspect/stop that session before launching another.' }
  if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 3000 is already in use. Do not start a second preview.' }
}

$title = if ($CheckOnly) { 'Local preview check' } else { 'Local preview' }
# Create the shell first; never submit a secrets-loading command until Orca has
# positively confirmed a visible surface in the exact current workspace.
$created = Invoke-OrcaJson -Arguments @('terminal', 'create', '--worktree', "id:$($workspace.id)", '--shell', 'powershell.exe', '--title', $title, '--json')
$terminal = $created.result.terminal
if (-not $terminal.handle -or $terminal.worktreeId -ne $workspace.id -or $terminal.executionHostId -ne 'local' -or $terminal.surface -ne 'visible') {
  throw "Orca did not confirm a visible terminal in this workspace. Nothing was submitted. Inspect terminal $($terminal.handle); do not create duplicates."
}
$command = if ($CheckOnly) { 'Write-Output ORCA_LOCAL_PREVIEW_TERMINAL_OK' } else {
  'powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/local-preview.ps1 -Approved'
}
try {
  $null = Invoke-OrcaJson -Arguments @('terminal', 'read', '--terminal', $terminal.handle, '--screen', '--limit', '20', '--json')
  $sent = Invoke-OrcaJson -Arguments @('terminal', 'send', '--terminal', $terminal.handle, '--text', $command, '--enter', '--json')
  if ($sent.result.send.accepted -ne $true) { throw 'Orca did not confirm input acceptance.' }
} catch {
  throw "Preview submission is unverified for terminal $($terminal.handle). Read that exact terminal before retrying; do not launch another. $($_.Exception.Message)"
}

# Input acceptance is not readiness. The agent must read this handle and check HTTP.
@{ terminal = $terminal.handle; worktreeId = $workspace.id; cli = $cli; visible = $true; commandAccepted = $true; ready = $false; checkOnly = [bool]$CheckOnly } | ConvertTo-Json -Compress
