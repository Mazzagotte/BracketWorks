# BracketWorks Frontend Launcher
# This script starts the frontend development server
# Backend: Using production backend at https://bracketworks-backend.onrender.com

# Dynamic path detection - find project root directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = $ScriptDir  # Script is already in project root
$FrontendPath = Join-Path $ProjectRoot "frontend"

# Validate frontend path exists
if (-not (Test-Path $FrontendPath)) {
    Write-Host "Error: Frontend directory not found at $FrontendPath" -ForegroundColor Red
    pause
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

# Start frontend development server
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$FrontendPath'; Write-Host 'Starting frontend with yarn dev...' -ForegroundColor Cyan; yarn dev"

# Wait a moment for server to start, then open browser
Write-Host "Waiting for development server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Open the dashboard in default browser
Write-Host "Opening browser at http://localhost:3000" -ForegroundColor Green
Start-Process "http://localhost:3000"

Write-Host ""
Write-Host "Development environment started successfully!" -ForegroundColor Green
Write-Host "Press any key to exit this window..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")