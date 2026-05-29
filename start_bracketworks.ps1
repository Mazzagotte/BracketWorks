# BracketWorks Development Launcher

$ProjectRoot  = $PSScriptRoot
$BackendPath  = Join-Path $ProjectRoot "backend"
$FrontendPath = Join-Path $ProjectRoot "frontend"
$BackendPython = Join-Path $BackendPath ".venv\Scripts\python.exe"
$Port         = 3000
$BackendUrl   = "http://localhost:8000"
$EnvFile      = Join-Path $ProjectRoot ".env"

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

$dbUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "bracketworks" }
$dbPassword = if ($env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD } else { "bracketworks" }
$dbName = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "bracketworks" }
$dbHost = if ($env:POSTGRES_HOST) { $env:POSTGRES_HOST } else { "localhost" }
$dbPort = if ($env:POSTGRES_PORT) { $env:POSTGRES_PORT } else { "5432" }
$DatabaseUrl = if ($env:DATABASE_URL) {
    $env:DATABASE_URL
} else {
    "postgresql://{0}:{1}@{2}:{3}/{4}" -f $dbUser, $dbPassword, $dbHost, $dbPort, $dbName
}

$BackendMode = if ($env:BRACKETWORKS_BACKEND_MODE) {
    $env:BRACKETWORKS_BACKEND_MODE.ToLowerInvariant()
} elseif ($DatabaseUrl -match "@db(?::|/)") {
    "docker"
} else {
    "local"
}

$DockerBuildMode = if ($env:BRACKETWORKS_DOCKER_BUILD) {
    $env:BRACKETWORKS_DOCKER_BUILD.ToLowerInvariant()
} else {
    "never"
}

$WaitForFrontend = if ($env:BRACKETWORKS_WAIT_FOR_FRONTEND) {
    $env:BRACKETWORKS_WAIT_FOR_FRONTEND -match "^(1|true|yes)$"
} else {
    $true
}

$WaitForBackend = if ($env:BRACKETWORKS_WAIT_FOR_BACKEND) {
    $env:BRACKETWORKS_WAIT_FOR_BACKEND -match "^(1|true|yes)$"
} else {
    $true
}

$BackendWaitRetries = if ($env:BRACKETWORKS_BACKEND_WAIT_RETRIES) {
    [int]$env:BRACKETWORKS_BACKEND_WAIT_RETRIES
} else {
    40
}

$BackendWaitDelayMs = if ($env:BRACKETWORKS_BACKEND_WAIT_DELAY_MS) {
    [int]$env:BRACKETWORKS_BACKEND_WAIT_DELAY_MS
} else {
    500
}

$FrontendWaitRetries = if ($env:BRACKETWORKS_FRONTEND_WAIT_RETRIES) {
    [int]$env:BRACKETWORKS_FRONTEND_WAIT_RETRIES
} else {
    60
}

$FrontendWaitDelayMs = if ($env:BRACKETWORKS_FRONTEND_WAIT_DELAY_MS) {
    [int]$env:BRACKETWORKS_FRONTEND_WAIT_DELAY_MS
} else {
    500
}

$BackendHealthUrl = "$BackendUrl/health"
$FrontendHealthUrl = "http://localhost:$Port/login"
$RepoNodePath = Join-Path $ProjectRoot ".tools\node-v22.22.3-win-x64"

# Ensure Node.js is in PATH
if (Test-Path (Join-Path $RepoNodePath "node.exe")) {
    $env:PATH = "$RepoNodePath;$env:PATH"
} elseif (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    $env:PATH = "C:\Program Files\nodejs;$env:PATH"
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "npm not found. Install Node.js with npm support." -ForegroundColor Red
    exit 1
}

if ($BackendMode -eq "docker" -and -not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker backend mode is selected but Docker is not available." -ForegroundColor Red
    Write-Host "Install or start Docker Desktop, or set BRACKETWORKS_BACKEND_MODE=local in .env." -ForegroundColor Yellow
    exit 1
}

if ($BackendMode -eq "local") {
    if (Test-Path $BackendPython) {
        $PythonCmd = $BackendPython
    } elseif (Get-Command python -ErrorAction SilentlyContinue) {
        $PythonCmd = "python"
    } else {
        Write-Host "Python not found. Install Python 3.12+ or create backend/.venv first." -ForegroundColor Red
        exit 1
    }

    # Avoid multiple local uvicorn instances fighting for port 8000.
    $existingUvicorn = Get-CimInstance Win32_Process |
        Where-Object { $_.CommandLine -match "uvicorn\s+app\.main:app" }
    if ($existingUvicorn) {
        Write-Host "Stopping existing local backend process(es)..." -ForegroundColor Yellow
        $existingUvicorn | ForEach-Object {
            try {
                Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop
            } catch {
                Write-Host "Could not stop process $($_.ProcessId): $($_.Exception.Message)" -ForegroundColor DarkYellow
            }
        }
    }
}

Write-Host ""
Write-Host "  BracketWorks" -ForegroundColor Cyan
Write-Host "  Frontend : http://localhost:$Port" -ForegroundColor Green
Write-Host "  Backend  : $BackendUrl" -ForegroundColor Yellow
Write-Host "  Database : $DatabaseUrl" -ForegroundColor Yellow
Write-Host "  Mode     : $BackendMode" -ForegroundColor Yellow
Write-Host ""

if ($BackendMode -eq "docker") {
    $dockerBuildArg = if ($DockerBuildMode -match "^(always|true|1)$") { " --build" } else { "" }
    $backendCmd = "Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned; " +
                  "cd '$ProjectRoot'; " +
                  "docker compose up -d$dockerBuildArg db redis backend; " +
                  "docker compose ps; " +
                  "Read-Host 'Press Enter to close'"
} else {
    $backendCmd = "Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned; " +
                  "`$env:DATABASE_URL='$DatabaseUrl'; " +
                  "`$env:ENVIRONMENT='development'; " +
                  "`$env:DEBUG='true'; " +
                  "`$env:SECRET_KEY='dev-secret-key-12345-not-for-production'; " +
                  "`$env:CORS_ORIGINS='http://localhost:3000,http://localhost:8000,http://127.0.0.1:3000'; " +
                  "cd '$BackendPath'; " +
                  "Write-Host 'Running database migrations...' -ForegroundColor Yellow; " +
                  "& '$PythonCmd' -m alembic upgrade heads; " +
                  "& '$PythonCmd' -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000; " +
                  "Read-Host 'Backend stopped. Press Enter to close'"
}
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd

# Start frontend in a new window
$frontendStartCmd = "npm.cmd run dev"
$frontendInstallCmd = "npm.cmd ci"

$cmd = "Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned; " +
    "`$env:PATH='$env:PATH'; " +
       "cd '$FrontendPath'; " +
       "`$env:NEXT_PUBLIC_BACKEND_URL='$BackendUrl'; " +
       "if (-not (Test-Path '.\\node_modules\\.bin\\next.cmd')) { " +
       "Write-Host 'Next.js binary missing. Installing frontend dependencies...' -ForegroundColor Yellow; " +
       "$frontendInstallCmd; " +
       "if (`$LASTEXITCODE -ne 0) { Write-Host 'Frontend dependency install failed.' -ForegroundColor Red; Read-Host 'Press Enter to close'; exit 1 } " +
       "}; " +
    "$frontendStartCmd; " +
       "Read-Host 'Press Enter to close'"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $cmd

if ($WaitForBackend) {
    Write-Host "Waiting for backend to be ready..." -ForegroundColor Yellow
    $backendReady = $false
    for ($i = 0; $i -lt $BackendWaitRetries; $i++) {
        Start-Sleep -Milliseconds $BackendWaitDelayMs
        try {
            $null = Invoke-WebRequest -Uri $BackendHealthUrl -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop
            $backendReady = $true
            break
        } catch {}
    }

    if ($backendReady) {
        Write-Host "Backend ready: $BackendHealthUrl" -ForegroundColor Green
    } else {
        Write-Host "Backend not ready yet. Continuing startup (it may still be booting)." -ForegroundColor Yellow
    }
}

if ($WaitForFrontend) {
    Write-Host "Waiting for frontend to be ready..." -ForegroundColor Yellow
    $frontendReady = $false
    for ($i = 0; $i -lt $FrontendWaitRetries; $i++) {
        Start-Sleep -Milliseconds $FrontendWaitDelayMs
        try {
            $null = Invoke-WebRequest -Uri $FrontendHealthUrl -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop
            $frontendReady = $true
            break
        } catch {}
    }

    if ($frontendReady) {
        Write-Host "Ready! Opening http://localhost:$Port" -ForegroundColor Green
    } else {
        Write-Host "Frontend is taking a while - opening browser anyway (it may still be compiling)." -ForegroundColor Yellow
    }
    Start-Process "http://localhost:$Port"
} else {
    Write-Host "Opening browser immediately (set BRACKETWORKS_WAIT_FOR_FRONTEND=true to wait for readiness)." -ForegroundColor Green
    Start-Process "http://localhost:$Port"
}
