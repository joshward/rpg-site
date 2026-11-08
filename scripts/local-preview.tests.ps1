# Standalone Windows regression checks; no 1Password, Neon or database access.
$ErrorActionPreference = 'Stop'
$launcher = Join-Path $PSScriptRoot 'local-preview.ps1'

function Assert-True($value, [string]$message) {
  if (-not $value) { throw $message }
}

$parseErrors = $null
[System.Management.Automation.Language.Parser]::ParseFile($launcher, [ref]$null, [ref]$parseErrors) | Out-Null
Assert-True (@($parseErrors).Count -eq 0) 'Launcher must parse in Windows PowerShell.'

# A decline must return before Git, op or any other preflight command.
& {
  function Read-Host { return 'no' }
  function git { throw 'Git must not run after a declined confirmation.' }
  function op { throw 'op must never run in this test.' }
  . $launcher -ConfirmApproval
}
& {
  function Read-Host { return '' }
  function git { throw 'Git must not run after an empty confirmation.' }
  function op { throw 'op must never run in this test.' }
  . $launcher -ConfirmApproval
}

# Running without either approval mode must fail before preflight.
& {
  function git { throw 'Git must not run before approval.' }
  function op { throw 'op must never run in this test.' }
  $blocked = $false
  try { . $launcher } catch { $blocked = $_.Exception.Message -like 'Ask the human to approve*' }
  Assert-True $blocked 'An unapproved launch must fail closed.'
}

# Yes reaches preflight, but fake Git stops it without inspecting local secrets.
& {
  function Read-Host { return 'yes' }
  function git { throw 'approved-preflight-reached' }
  function op { throw 'op must never run in this test.' }
  $reached = $false
  try { . $launcher -ConfirmApproval } catch { $reached = $_.Exception.Message -eq 'approved-preflight-reached' }
  Assert-True $reached 'An explicit yes must advance to preflight.'
}

# The runtime switch must preserve the verified-local ordering and fail closed.
$source = Get-Content -LiteralPath $launcher -Raw
Assert-True ($source.Contains("@('op', 'neonctl', 'mise')")) 'mise must be a required CLI.'
Assert-True (-not $source.Contains('volta')) 'The launcher must not require or fall back to Volta.'
$migrate = $source.IndexOf('& mise exec -- npm run db:migrate')
$dev = $source.IndexOf('& mise exec -- npm run dev')
$verified = $source.IndexOf("Write-Output 'Verified: Neon local child branch")
Assert-True ($verified -ge 0 -and $migrate -gt $verified -and $dev -gt $migrate) 'Migration and dev must use mise only after local database verification.'
Assert-True ($source.Contains("throw 'Local migration failed; dev server was not started.'")) 'A failed migration must still prevent dev startup.'
$repoRoot = Split-Path $PSScriptRoot -Parent
$toolConfig = Get-Content -LiteralPath (Join-Path $repoRoot 'mise.toml') -Raw
$package = Get-Content -LiteralPath (Join-Path $repoRoot 'package.json') -Raw | ConvertFrom-Json
Assert-True ($toolConfig -match '(?m)^node = "24\.21\.0"\r?$') 'mise must pin the supported Node version.'
$npmPin = [regex]::Match($toolConfig, '(?m)^npm = "(\d+\.\d+\.\d+)"\r?$')
Assert-True ($npmPin.Success -and $package.packageManager -eq "npm@$($npmPin.Groups[1].Value)") 'mise npm pin must agree with packageManager.'

& (Join-Path $PSScriptRoot 'local-preview-orca.tests.ps1')
Write-Output 'Local preview approval and Orca launch checks passed (no secrets or DB access).'
