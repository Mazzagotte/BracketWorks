$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $repoRoot 'apps/api'
if (-not (Test-Path $backendPath)) {
  Write-Error "API directory not found at $backendPath"
  exit 1
}

$port = if ($env:BACKEND_PORT) { $env:BACKEND_PORT } else { '8001' }
$databaseUrl = if ($env:DATABASE_URL) {
  $env:DATABASE_URL
} else {
  'postgresql://bracketworks:bracketworks@127.0.0.1:5432/bracketworks'
}

Set-Location $backendPath
if (Test-Path '.venv/Scripts/python.exe') {
  $env:DATABASE_URL = $databaseUrl
  Write-Host 'Running database migrations...' -ForegroundColor Yellow
  & ./.venv/Scripts/python.exe -m alembic upgrade head
  if ($LASTEXITCODE -ne 0) {
    Write-Error 'Database migration failed. Backend will not start.'
    exit $LASTEXITCODE
  }

  Write-Host "Starting backend on http://localhost:$port" -ForegroundColor Cyan
  & ./.venv/Scripts/python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port $port
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
  $env:DATABASE_URL = $databaseUrl
  Write-Host 'Running database migrations...' -ForegroundColor Yellow
  & python -m alembic upgrade head
  if ($LASTEXITCODE -ne 0) {
    Write-Error 'Database migration failed. Backend will not start.'
    exit $LASTEXITCODE
  }

  Write-Host "Starting backend on http://localhost:$port" -ForegroundColor Cyan
  & python -m uvicorn app.main:app --reload --host 0.0.0.0 --port $port
} else {
  Write-Error 'Python was not found. Install Python and create apps/api/.venv or ensure python is on PATH.'
  exit 1
}
