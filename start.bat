@echo off
echo ========================================
echo   OpenCode Multi-Platform Remote
echo ========================================
echo.

echo [0/4] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python 3 is not installed or not in PATH!
    echo.
    echo Please install Python 3 from:
    echo   https://www.python.org/downloads/
    echo.
    echo Make sure to check "Add Python to PATH" during installation!
    echo.
    pause
    exit /b 1
)
python --version
echo Python check passed!
echo.

if not exist "node_modules" (
    echo [1/4] Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo Failed to install dependencies!
        pause
        exit /b 1
    )
    echo Dependencies installed successfully!
    echo.
)

if not exist "config.json" (
    echo [2/4] Creating config.json...
    copy config.example.json config.json
    echo Config file created!
    echo.
)

echo [3/4] Testing bridge.py...
python bridge.py --help >nul 2>&1
if errorlevel 1 (
    echo Warning: bridge.py test failed, but continuing anyway...
    echo.
) else (
    echo Bridge script OK!
    echo.
)

echo [4/4] Starting server...
echo.
echo Make sure OpenCode CLI is installed!
echo.
call npm start
pause
