$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Checking Python Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

try {
    $version = python --version 2>&1
    Write-Host "[1/2] Python found: $version" -ForegroundColor Green
} catch {
    Write-Host "[1/2] Python NOT found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Python 3 from:" -ForegroundColor Yellow
    Write-Host "  https://www.python.org/downloads/" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Make sure to check 'Add Python to PATH' during installation!" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host ""
Write-Host "[2/2] Testing bridge script..." -ForegroundColor Yellow

try {
    $testOutput = python -c "print('Python is working!')" 2>&1
    Write-Host "Python test passed!" -ForegroundColor Green
} catch {
    Write-Host "Python test failed!" -ForegroundColor Red
    pause
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  All checks passed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "You can now run: npm start" -ForegroundColor Cyan
Write-Host ""
pause
