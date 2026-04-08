# BracketWorks Frontend Launcher
# This script starts the frontend development server
# Backend: Using production backend at https://bracketworks-backend.onrender.com

# Dynamic path detection - find project root directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = $ScriptDir  # Script is already in project root
$FrontendPath = Join-Path $ProjectRoot "frontend"
$Port = 3000

# Validate frontend path exists
if (-not (Test-Path $FrontendPath)) {
    Write-Host "Error: Frontend directory not found at $FrontendPath" -ForegroundColor Red
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Check if .env.local exists
$EnvFile = Join-Path $FrontendPath ".env.local"
if (-not (Test-Path $EnvFile)) {
    Write-Host "Warning: .env.local not found at $EnvFile" -ForegroundColor Yellow
    Write-Host "         Environment variables (e.g. NEXT_PUBLIC_API_URL) may not be set." -ForegroundColor Yellow
    Write-Host ""
}

# Check if port is already in use
$portInUse = Test-NetConnection -ComputerName localhost -Port $Port -InformationLevel Quiet -WarningAction SilentlyContinue
if ($portInUse) {
    Write-Host "Error: Port $Port is already in use. Stop the existing process and try again." -ForegroundColor Red
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  BracketWorks Development Environment" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Frontend: $FrontendPath" -ForegroundColor Green
Write-Host "Backend:  https://bracketworks-backend.onrender.com" -ForegroundColor Green
Write-Host ""
Write-Host "Starting frontend development server..." -ForegroundColor Yellow
Write-Host ""

# Start frontend development server (window closes naturally when yarn dev exits)
Start-Process powershell -ArgumentList "-Command", "cd '$FrontendPath'; Write-Host 'Starting frontend with yarn dev...' -ForegroundColor Cyan; yarn dev; Write-Host 'Server stopped.' -ForegroundColor Red; Read-Host 'Press Enter to close'"

# Poll for server readiness instead of fixed sleep
Write-Host "Waiting for development server to be ready..." -ForegroundColor Yellow
$maxWait = 60
$elapsed = 0
$ready = $false

while ($elapsed -lt $maxWait) {
    Start-Sleep -Seconds 2
    $elapsed += 2
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:$Port" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        $ready = $true
        break
    } catch {
        Write-Host "  Still waiting... ($elapsed`s)" -ForegroundColor Gray
    }
}

if (-not $ready) {
    Write-Host ""
    Write-Host "Warning: Server did not respond after ${maxWait}s. It may still be starting." -ForegroundColor Yellow
    Write-Host "         Check the yarn dev window for errors." -ForegroundColor Yellow
} else {
    Write-Host "Server is ready!" -ForegroundColor Green
}

# Open the dashboard in default browser
Write-Host "Opening browser at http://localhost:$Port" -ForegroundColor Green
Start-Process "http://localhost:$Port"

Write-Host ""
Write-Host "Development environment started successfully!" -ForegroundColor Green
Write-Host "Press any key to exit this window..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
