# VECTOR master verification — all website pre-upload checks (one command).
#
# If PowerShell blocks .ps1 (execution policy), use either:
#   .\master-verify.bat
#   scripts\master-verify.bat
#   node scripts/master-verify.mjs
#
# Or enable scripts once: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot
node (Join-Path $PSScriptRoot "master-verify.mjs")
exit $LASTEXITCODE
