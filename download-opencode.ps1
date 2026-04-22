$ErrorActionPreference = "Stop"

$installDir = "E:\Downloads\opencode"
$zipPath = "$installDir\opencode.zip"
$exePath = "$installDir\opencode.exe"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  OpenCode CLI Downloader" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $installDir)) {
    Write-Host "[1/4] Creating directory: $installDir" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
} else {
    Write-Host "[1/4] Directory already exists: $installDir" -ForegroundColor Green
}

Write-Host ""
Write-Host "[2/4] Fetching latest release info..." -ForegroundColor Yellow

try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/opencodeai/opencode/releases/latest"
    $version = $release.tag_name
    Write-Host "Latest version: $version" -ForegroundColor Green
} catch {
    Write-Host "Failed to fetch release info" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[3/4] Downloading OpenCode CLI for Windows..." -ForegroundColor Yellow

$asset = $release.assets | Where-Object { $_.name -like "*windows*x86_64*" -or $_.name -like "*windows*amd64*" }

if (-not $asset) {
    Write-Host "Could not find Windows asset" -ForegroundColor Red
    exit 1
}

$downloadUrl = $asset.browser_download_url
Write-Host "Downloading from: $downloadUrl" -ForegroundColor Gray

try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing
    Write-Host "Download completed!" -ForegroundColor Green
} catch {
    Write-Host "Download failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[4/4] Extracting files..." -ForegroundColor Yellow

try {
    Expand-Archive -Path $zipPath -DestinationPath $installDir -Force
    Write-Host "Extraction completed!" -ForegroundColor Green
} catch {
    Write-Host "Extraction failed: $_" -ForegroundColor Red
    exit 1
}

Remove-Item $zipPath -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Installation complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "OpenCode CLI installed to:" -ForegroundColor White
Write-Host "  $exePath" -ForegroundColor Yellow
Write-Host ""
Write-Host "Please update config.json with:" -ForegroundColor White
Write-Host "  `"opencodePath`": `"$($exePath.Replace('\', '\\'))`"" -ForegroundColor Yellow
Write-Host ""
