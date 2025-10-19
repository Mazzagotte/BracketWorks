# Dynamic path detection - find project root directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = $ScriptDir  # Script is already in project root
$BackendPath = Join-Path $ProjectRoot "backend"
$FrontendPath = Join-Path $ProjectRoot "frontend"

# Validate paths exist
if (-not (Test-Path $BackendPath)) {
    Write-Host "Error: Backend directory not found at $BackendPath"
    exit 1
}
if (-not (Test-Path $FrontendPath)) {
    Write-Host "Error: Frontend directory not found at $FrontendPath"
    exit 1
}

Write-Host "Project root detected: $ProjectRoot"
Write-Host "Starting backend from: $BackendPath"
Write-Host "Starting frontend from: $FrontendPath"

# Start Backend in new PowerShell window and keep it open with pause
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BackendPath'; python main_standalone.py; pause"

# Start frontend using yarn (after fixing .babelrc issue)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$FrontendPath'; yarn dev; pause"

# Open the dashboard in your default browser (no extra PowerShell window)
Start-Process cmd -ArgumentList "/c start http://localhost:3000"