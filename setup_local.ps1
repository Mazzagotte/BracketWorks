# BracketWorks Local Setup (Local PostgreSQL)
# Run this once before first launch.

$ProjectRoot  = $PSScriptRoot
$BackendPath  = Join-Path $ProjectRoot "backend"
$FrontendPath = Join-Path $ProjectRoot "frontend"
$BackendPython = Join-Path $BackendPath ".venv\Scripts\python.exe"
$EnvFile = Join-Path $ProjectRoot ".env"

if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) {
            return
        }

        $parts = $line -split "=", 2
        if ($parts.Count -eq 2) {
            [System.Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
        }
    }
}

Write-Host ""
Write-Host "  BracketWorks - Local PostgreSQL Setup" -ForegroundColor Cyan
Write-Host ""

if (Test-Path $BackendPython) {
    $PythonCmd = $BackendPython
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $PythonCmd = "python"
} else {
    Write-Host "[ERROR] Python not found. Install Python 3.12+ or create backend/.venv first." -ForegroundColor Red
    exit 1
}

$null = & $PythonCmd -m pip --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Bootstrapping pip in the selected Python environment..." -ForegroundColor Yellow
    & $PythonCmd -m ensurepip --upgrade
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to bootstrap pip." -ForegroundColor Red
        exit 1
    }
}

$dbUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "bracketworks" }
$dbPassword = if ($env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD } else { "bracketworks" }
$dbName = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "bracketworks" }
$dbHost = if ($env:POSTGRES_HOST) { $env:POSTGRES_HOST } else { "localhost" }
$dbPort = if ($env:POSTGRES_PORT) { $env:POSTGRES_PORT } else { "5432" }
$databaseUrl = if ($env:DATABASE_URL) {
    $env:DATABASE_URL
} else {
    "postgresql://{0}:{1}@{2}:{3}/{4}" -f $dbUser, $dbPassword, $dbHost, $dbPort, $dbName
}

# ── 1. Check Python ────────────────────────────────────────────────────────────
$pyVer = & $PythonCmd --version 2>&1
Write-Host "[OK] $pyVer" -ForegroundColor Green

# ── 2. Check Node ──────────────────────────────────────────────────────────────
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js not found. Install Node 20+ from https://nodejs.org" -ForegroundColor Red
    exit 1
}
$nodeVer = node --version 2>&1
Write-Host "[OK] Node $nodeVer" -ForegroundColor Green

# ── 3. Install Python dependencies ────────────────────────────────────────────
Write-Host ""
Write-Host "Installing Python dependencies..." -ForegroundColor Yellow
Set-Location $BackendPath
& $PythonCmd -m pip install -r requirements.txt --quiet
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] pip install failed." -ForegroundColor Red; exit 1
}
Write-Host "[OK] Python dependencies installed" -ForegroundColor Green

# ── 4. Run Alembic migrations against local PostgreSQL ───────────────────────
Write-Host ""
Write-Host "Running migrations against PostgreSQL..." -ForegroundColor Yellow
$env:DATABASE_URL = $databaseUrl
& $PythonCmd -m alembic upgrade head
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Alembic migrations failed." -ForegroundColor Red; exit 1
}
Write-Host "[OK] Database ready at $databaseUrl" -ForegroundColor Green

# ── 5. Install Node dependencies ───────────────────────────────────────────────
Write-Host ""
Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location $FrontendPath
npm install --silent
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] npm install failed." -ForegroundColor Red; exit 1
}
Write-Host "[OK] Frontend dependencies installed" -ForegroundColor Green

Set-Location $ProjectRoot

Write-Host ""
Write-Host "  Setup complete! Run .\start_local.ps1 to launch BracketWorks against PostgreSQL." -ForegroundColor Cyan
Write-Host ""
