$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $repoRoot 'apps/api'
if (-not (Test-Path $backendPath)) {
  Write-Error "API directory not found at $backendPath"
  exit 1
}
Set-Location $backendPath
if (Test-Path '.venv/Scripts/python.exe') {
  & ./.venv/Scripts/python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
  & python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
} else {
  Write-Error 'Python was not found. Install Python and create apps/api/.venv or ensure python is on PATH.'
  exit 1
}
