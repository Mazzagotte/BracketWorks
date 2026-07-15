# BracketWorks Development Launcher
$ProjectRoot  = $PSScriptRoot
$BackendPath  = Join-Path $ProjectRoot "backend"
$FrontendPath = Join-Path $ProjectRoot "frontend"
$BackendPython = Join-Path $BackendPath ".venv\Scripts\python.exe"
$Port         = 3000
$BackendUrl   = "http://localhost:8001"
$EnvFile      = Join-Path $ProjectRoot ".env"
$PowerShellPolicyCmd = "Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned"
$ClosePromptCmd = "Read-Host 'Press Enter to close'"

function Get-EnvValueOrDefault {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Default
    )

    $value = [System.Environment]::GetEnvironmentVariable($Name, "Process")
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $Default
    }

    return $value
}

function Get-EnvBoolOrDefault {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][bool]$Default
    )

    $value = Get-EnvValueOrDefault -Name $Name -Default ""
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $Default
    }

    return $value -match "^(1|true|yes)$"
}

function Get-EnvIntOrDefault {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][int]$Default
    )

    $value = Get-EnvValueOrDefault -Name $Name -Default ""
    $parsed = 0
    if ([int]::TryParse($value, [ref]$parsed)) {
        return $parsed
    }

    return $Default
}

function ConvertFrom-EnvAssignment {
    param(
        [Parameter(Mandatory = $true)][string]$Line
    )

    $normalized = $Line.Trim()
    if (-not $normalized -or $normalized.StartsWith("#")) {
        return $null
    }

    if ($normalized -match '^\s*export\s+') {
        $normalized = $normalized -replace '^\s*export\s+', ''
    }

    $parts = $normalized -split "=", 2
    if ($parts.Count -ne 2) {
        return $null
    }

    $key = $parts[0].Trim()
    if ([string]::IsNullOrWhiteSpace($key)) {
        return $null
    }

    $rawValue = $parts[1].Trim()
    if (($rawValue.StartsWith('"') -and $rawValue.EndsWith('"')) -or ($rawValue.StartsWith("'") -and $rawValue.EndsWith("'"))) {
        $rawValue = $rawValue.Substring(1, $rawValue.Length - 2)
    }

    return @{ Name = $key; Value = $rawValue }
}

function Wait-ForHttpReady {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Url,
        [Parameter(Mandatory = $true)][int]$Retries,
        [Parameter(Mandatory = $true)][int]$DelayMs
    )

    Write-Host "Waiting for $Name to be ready..." -ForegroundColor Yellow

    $lastError = $null
    for ($i = 0; $i -lt $Retries; $i++) {
        Start-Sleep -Milliseconds $DelayMs
        try {
            $null = Invoke-WebRequest -Uri $Url -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop
            Write-Host "$Name ready: $Url" -ForegroundColor Green
            return $true
        } catch {
            $lastError = $_.Exception.Message
        }
    }

    Write-Host "$Name not ready yet. Continuing startup (it may still be booting)." -ForegroundColor Yellow
    if ($lastError) {
        Write-Host "Last $Name check error: $lastError" -ForegroundColor DarkYellow
    }
    return $false
}

function Test-FileNewerThan {
    param(
        [Parameter(Mandatory = $true)][string]$CandidatePath,
        [Parameter(Mandatory = $true)][string]$ReferencePath
    )

    if (-not (Test-Path $CandidatePath) -or -not (Test-Path $ReferencePath)) {
        return $false
    }

    return (Get-Item $CandidatePath).LastWriteTimeUtc -gt (Get-Item $ReferencePath).LastWriteTimeUtc
}

if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        $assignment = ConvertFrom-EnvAssignment -Line $_
        if ($assignment) {
            [System.Environment]::SetEnvironmentVariable($assignment.Name, $assignment.Value, "Process")
        }
    }
}

$dbUser = Get-EnvValueOrDefault -Name "POSTGRES_USER" -Default "postgres"
$dbPassword = Get-EnvValueOrDefault -Name "POSTGRES_PASSWORD" -Default "mazzagotte"
$dbName = Get-EnvValueOrDefault -Name "POSTGRES_DB" -Default "bracketworks"
$dbHost = Get-EnvValueOrDefault -Name "POSTGRES_HOST" -Default "localhost"
$dbPort = Get-EnvValueOrDefault -Name "POSTGRES_PORT" -Default "5433"
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

$DockerBuildMode = Get-EnvValueOrDefault -Name "BRACKETWORKS_DOCKER_BUILD" -Default "never"
$DockerBuildMode = $DockerBuildMode.ToLowerInvariant()

$AutoMode = Get-EnvBoolOrDefault -Name "BRACKETWORKS_AUTO" -Default $true
$FastStart = Get-EnvBoolOrDefault -Name "BRACKETWORKS_FAST_START" -Default $false

$WaitForFrontend = Get-EnvBoolOrDefault -Name "BRACKETWORKS_WAIT_FOR_FRONTEND" -Default $true
$WaitForBackend = Get-EnvBoolOrDefault -Name "BRACKETWORKS_WAIT_FOR_BACKEND" -Default $true
$SkipMigrations = Get-EnvBoolOrDefault -Name "BRACKETWORKS_SKIP_MIGRATIONS" -Default $false
$FrontendInstallMode = Get-EnvValueOrDefault -Name "BRACKETWORKS_FRONTEND_INSTALL_MODE" -Default "auto"
$FrontendInstallMode = $FrontendInstallMode.ToLowerInvariant()
$KillPort8001 = Get-EnvBoolOrDefault -Name "BRACKETWORKS_KILL_PORT_8001" -Default $true

if ($BackendMode -notin @("local", "docker")) {
    Write-Host "Invalid BRACKETWORKS_BACKEND_MODE '$BackendMode'. Use 'local' or 'docker'." -ForegroundColor Red
    exit 1
}

if ($FrontendInstallMode -notin @("auto", "always", "never")) {
    Write-Host "Invalid BRACKETWORKS_FRONTEND_INSTALL_MODE '$FrontendInstallMode'. Use 'auto', 'always', or 'never'." -ForegroundColor Red
    exit 1
}

if ($FastStart) {
    $WaitForFrontend = $false
    $WaitForBackend = $false
    $SkipMigrations = $true
    $FrontendInstallMode = "auto"
}

$BackendWaitRetries = Get-EnvIntOrDefault -Name "BRACKETWORKS_BACKEND_WAIT_RETRIES" -Default 40
$BackendWaitDelayMs = Get-EnvIntOrDefault -Name "BRACKETWORKS_BACKEND_WAIT_DELAY_MS" -Default 500
$FrontendWaitRetries = Get-EnvIntOrDefault -Name "BRACKETWORKS_FRONTEND_WAIT_RETRIES" -Default 60
$FrontendWaitDelayMs = Get-EnvIntOrDefault -Name "BRACKETWORKS_FRONTEND_WAIT_DELAY_MS" -Default 500

$BackendHealthUrl = "$BackendUrl/health"
$FrontendHealthUrl = "http://localhost:$Port/login"
$RepoNodePath = Join-Path $ProjectRoot ".tools\node-v22.22.3-win-x64"

# Ensure Node.js is in PATH
if (Test-Path (Join-Path $RepoNodePath "node.exe")) {
    $env:PATH = "$RepoNodePath;$env:PATH"
} elseif (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    $env:PATH = "C:\Program Files\nodejs;$env:PATH"
}

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    Write-Host "npm not found. Install Node.js with npm support." -ForegroundColor Red
    exit 1
}

if ($BackendMode -eq "docker" -and -not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker backend mode is selected but Docker is not available." -ForegroundColor Red
    Write-Host "Install or start Docker Desktop, or set BRACKETWORKS_BACKEND_MODE=local in .env." -ForegroundColor Yellow
    exit 1
}

if ($BackendMode -eq "local") {
    $createdBackendVenv = $false

    if (Test-Path $BackendPython) {
        $PythonCmd = $BackendPython
    } elseif (Get-Command python -ErrorAction SilentlyContinue) {
        Write-Host "backend/.venv not found. Creating local virtual environment..." -ForegroundColor Yellow
        Push-Location $BackendPath
        try {
            & python -m venv .venv
            if ($LASTEXITCODE -ne 0 -or -not (Test-Path $BackendPython)) {
                Write-Host "Failed to create backend virtual environment at backend/.venv." -ForegroundColor Red
                exit 1
            }
            $createdBackendVenv = $true
            $PythonCmd = $BackendPython
        } finally {
            Pop-Location
        }
    } else {
        Write-Host "Python not found. Install Python 3.12+ or create backend/.venv first." -ForegroundColor Red
        exit 1
    }

    $env:BRACKETWORKS_CREATED_BACKEND_VENV = if ($createdBackendVenv) { "true" } else { "false" }

    # Avoid multiple local uvicorn instances fighting for port 8001.
    $existingListeners = Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue
    if ($existingListeners) {
        if ($KillPort8001) {
            Write-Host "Stopping anything listening on port 8001 (set BRACKETWORKS_KILL_PORT_8001=false to disable)..." -ForegroundColor Yellow
            $existingListeners |
                Select-Object -ExpandProperty OwningProcess -Unique |
                ForEach-Object {
                    try {
                        Stop-Process -Id $_ -Force -ErrorAction Stop
                    } catch {
                        Write-Host "Could not stop process $($_): $($_.Exception.Message)" -ForegroundColor DarkYellow
                    }
                }
        } else {
            $pids = ($existingListeners | Select-Object -ExpandProperty OwningProcess -Unique) -join ", "
            Write-Host "Port 8001 is already in use by PID(s): $pids" -ForegroundColor Yellow
            Write-Host "Set BRACKETWORKS_KILL_PORT_8001=true to auto-stop conflicting listeners." -ForegroundColor Yellow
        }
    }

}

Write-Host ""
Write-Host "  BracketWorks" -ForegroundColor Cyan
Write-Host "  Frontend : http://localhost:$Port" -ForegroundColor Green
Write-Host "  Backend  : $BackendUrl" -ForegroundColor Yellow
Write-Host "  Database : $DatabaseUrl" -ForegroundColor Yellow
Write-Host "  Mode     : $BackendMode" -ForegroundColor Yellow
Write-Host "  Auto     : $(if ($AutoMode) { 'on' } else { 'off' })" -ForegroundColor Yellow
Write-Host "  Fast     : $(if ($FastStart) { 'on' } else { 'off' })" -ForegroundColor Yellow
Write-Host "  Migrate  : $(if ($SkipMigrations) { 'skip' } else { 'apply' })" -ForegroundColor Yellow
Write-Host "  FE deps  : $FrontendInstallMode" -ForegroundColor Yellow
Write-Host ""

if ($BackendMode -eq "docker") {
    $dockerBuildArg = if ($DockerBuildMode -match "^(always|true|1)$") { " --build" } else { "" }
    $dockerTailCmd = if ($AutoMode) { "" } else { "; $ClosePromptCmd" }
    $backendCmd = "$PowerShellPolicyCmd; " +
                  "cd '$ProjectRoot'; " +
                  "docker compose up -d$dockerBuildArg db redis backend; " +
                  "docker compose ps" +
                  $dockerTailCmd
} else {
    $backendReqPath = Join-Path $BackendPath "requirements.txt"
    $backendStatePath = Join-Path $BackendPath ".venv\.bw-backend-install-state.json"
    $backendReqHash = ""
    $backendInstallNeeded = $false
    $backendInstallReason = ""

    if (-not (Test-Path $backendReqPath)) {
        Write-Host "Backend requirements file not found at $backendReqPath" -ForegroundColor Red
        exit 1
    }

    $backendReqHash = (Get-FileHash -Path $backendReqPath -Algorithm SHA256).Hash

    if ($env:BRACKETWORKS_CREATED_BACKEND_VENV -eq "true") {
        $backendInstallNeeded = $true
        $backendInstallReason = "new virtual environment"
    } elseif (-not (Test-Path $backendStatePath)) {
        $backendInstallNeeded = $true
        $backendInstallReason = "dependency state file missing"
    } else {
        try {
            $backendState = Get-Content -Path $backendStatePath -Raw | ConvertFrom-Json
            if (-not $backendState.RequirementsHash) {
                $backendInstallNeeded = $true
                $backendInstallReason = "dependency state missing requirements hash"
            } elseif ($backendState.RequirementsHash -ne $backendReqHash) {
                $backendInstallNeeded = $true
                $backendInstallReason = "requirements changed"
            } elseif ($backendState.PythonPath -and $backendState.PythonPath -ne $PythonCmd) {
                $backendInstallNeeded = $true
                $backendInstallReason = "python executable changed"
            }
        } catch {
            $backendInstallNeeded = $true
            $backendInstallReason = "dependency state unreadable"
        }
    }

    $backendDepsCmd =
        "if ('$backendInstallNeeded' -eq 'True') { " +
        "  Write-Host 'Installing backend dependencies ($backendInstallReason)...' -ForegroundColor Yellow; " +
        "  & '$PythonCmd' -m pip install --upgrade pip; " +
        "  if (`$LASTEXITCODE -ne 0) { Write-Host 'Failed to upgrade pip.' -ForegroundColor Red; exit `$LASTEXITCODE }; " +
        "  & '$PythonCmd' -m pip install -r requirements.txt; " +
        "  if (`$LASTEXITCODE -ne 0) { Write-Host 'Backend dependency install failed.' -ForegroundColor Red; exit `$LASTEXITCODE }; " +
        "  `$backendStateJson = @{ InstalledAt = (Get-Date).ToString('O'); RequirementsHash = '$backendReqHash'; PythonPath = '$PythonCmd' } | ConvertTo-Json -Compress; " +
        "  Set-Content -Path '.\\.venv\\.bw-backend-install-state.json' -Value `$backendStateJson -Encoding UTF8; " +
        "} else { " +
        "  Write-Host 'Backend dependencies match requirements hash. Skipping install.' -ForegroundColor DarkGreen; " +
        "}; "

    $migrationCmd = if ($SkipMigrations) {
        "Write-Host 'Skipping database migrations (BRACKETWORKS_SKIP_MIGRATIONS=true).' -ForegroundColor Yellow; "
    } else {
        "Write-Host 'Running database migrations...' -ForegroundColor Yellow; " +
        "& '$PythonCmd' -m alembic upgrade head; " +
        "if (`$LASTEXITCODE -ne 0) { " +
        "  Write-Host 'Database migration failed. Backend will not start.' -ForegroundColor Red; " +
        "  $ClosePromptCmd; " +
        "  exit `$LASTEXITCODE; " +
        "}; "
    }

    $backendCmd = "$PowerShellPolicyCmd; " +
                  "`$env:DATABASE_URL='$DatabaseUrl'; " +
                  "`$env:ENVIRONMENT='development'; " +
                  "`$env:DEBUG='true'; " +
                  "`$env:SECRET_KEY='dev-secret-key-12345-not-for-production'; " +
                  "`$env:CORS_ORIGINS='http://localhost:3000,http://localhost:8001,http://127.0.0.1:3000'; " +
                  "cd '$BackendPath'; " +
                  $backendDepsCmd +
                  $migrationCmd +
                  "& '$PythonCmd' -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8001"
}
$backendWindowArgs = if ($AutoMode) { @("-Command", $backendCmd) } else { @("-NoExit", "-Command", $backendCmd) }
Start-Process powershell -ArgumentList $backendWindowArgs

# Start frontend in a new window
$frontendStartCmd = "if (Test-Path '.\\node_modules\\next\\dist\\bin\\next') { node .\\node_modules\\next\\dist\\bin\\next dev -p $Port --webpack } else { npm.cmd run dev }"
$frontendInstallCmdPrimary = "npm.cmd ci --no-audit --no-fund"
$frontendInstallCmdRetry = "npm.cmd install --include=dev --no-audit --no-fund"

$cmd = "$PowerShellPolicyCmd; " +
    "`$env:PATH='$env:PATH'; " +
    "cd '$FrontendPath'; " +
    "`$env:NEXT_PUBLIC_BACKEND_URL='$BackendUrl'; " +
    "`$lockPath = '.\\package-lock.json'; " +
    "`$stampPath = '.\\node_modules\\.bw-install-stamp'; " +
    "`$nextPath = '.\\node_modules\\next\\dist\\bin\\next'; " +
    "`$installNeeded = `$false; " +
    "switch ('$FrontendInstallMode') { " +
    "  'always' { `$installNeeded = `$true } " +
    "  'never'  { `$installNeeded = `$false } " +
    "  default { " +
    "    if (-not (Test-Path `$nextPath)) { `$installNeeded = `$true } " +
    "    elseif ((Test-Path `$lockPath) -and (-not (Test-Path `$stampPath))) { `$installNeeded = `$true } " +
    "    elseif ((Test-Path `$lockPath) -and (Test-Path `$stampPath) -and ((Get-Item `$lockPath).LastWriteTimeUtc -gt (Get-Item `$stampPath).LastWriteTimeUtc)) { `$installNeeded = `$true } " +
    "  } " +
    "}; " +
    "if ((-not `$installNeeded) -and (-not (Test-Path `$nextPath))) { " +
    "  Write-Host 'Next.js binary is missing and install mode is never. Set BRACKETWORKS_FRONTEND_INSTALL_MODE=auto or always.' -ForegroundColor Red; " +
    "  $ClosePromptCmd; " +
    "  exit 1; " +
    "}; " +
    "if (`$installNeeded) { " +
    "Write-Host 'Installing frontend dependencies...' -ForegroundColor Yellow; " +
    "$frontendInstallCmdPrimary; " +
    "if (`$LASTEXITCODE -ne 0) { " +
    "  Write-Host 'Frontend dependency install failed. Retrying after cleaning Next.js artifacts...' -ForegroundColor Yellow; " +
    "  if (Test-Path '.\\node_modules\\next') { Remove-Item -LiteralPath '.\\node_modules\\next' -Recurse -Force -ErrorAction SilentlyContinue }; " +
    "  if (Test-Path '.\\node_modules') { Get-ChildItem '.\\node_modules' -Filter '.next-*' -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue }; " +
    "  $frontendInstallCmdRetry; " +
    "  if (`$LASTEXITCODE -ne 0) { Write-Host 'Frontend dependency install failed.' -ForegroundColor Red; $ClosePromptCmd; exit 1 } " +
    "}; " +
    "if (-not (Test-Path `$nextPath)) { Write-Host 'Next.js runtime binary is still missing after install.' -ForegroundColor Red; $ClosePromptCmd; exit 1 }; " +
    "if (-not (Test-Path '.\\node_modules')) { New-Item -ItemType Directory -Path '.\\node_modules' -Force | Out-Null }; " +
    "Set-Content -Path `$stampPath -Value (Get-Date).ToString('O') -Encoding UTF8; " +
    "} else { Write-Host 'Frontend dependencies are up to date. Skipping install.' -ForegroundColor DarkGreen }; " +
        "$frontendStartCmd"
$frontendWindowArgs = if ($AutoMode) { @("-Command", $cmd) } else { @("-NoExit", "-Command", $cmd) }
Start-Process powershell -ArgumentList $frontendWindowArgs

if ($WaitForBackend) {
    Wait-ForHttpReady -Name "Backend" -Url $BackendHealthUrl -Retries $BackendWaitRetries -DelayMs $BackendWaitDelayMs | Out-Null
}

if ($WaitForFrontend) {
    $frontendReady = Wait-ForHttpReady -Name "Frontend" -Url $FrontendHealthUrl -Retries $FrontendWaitRetries -DelayMs $FrontendWaitDelayMs
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
