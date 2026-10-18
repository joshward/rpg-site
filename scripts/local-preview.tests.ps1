# Standalone Windows regression checks; no 1Password, Neon or database access.
$ErrorActionPreference = 'Stop'
$launcher = Join-Path $PSScriptRoot 'local-preview.ps1'
$repo = Split-Path $PSScriptRoot -Parent

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

$config = Get-Content -LiteralPath (Join-Path $repo '.emdash.json') -Raw | ConvertFrom-Json
Assert-True ($config.scripts.run -match '-ConfirmApproval' -and $config.scripts.run -notmatch '-Approved\b') 'Emdash Run must require interactive approval.'
Assert-True ($config.scripts.teardown -match '-Stop\b') 'Emdash teardown must use the targeted stop command.'
Assert-True (@($config.preservePatterns).Count -eq 0) 'Shared config must not request copies of local env files.'
Assert-True (-not $config.scripts.setup) 'Shared config must not automatically run setup commands.'
Write-Output 'Local preview approval and Emdash config checks passed (no secrets or DB access).'
