# Deploy frontend su Firebase Hosting (dominio: https://pizzamanager.it)
# Esegui dalla root del progetto: .\deploy-firebase.ps1

$ErrorActionPreference = "Stop"
$rootDir = $PSScriptRoot

if (-not (Test-Path "$rootDir\.env.production")) {
    Write-Host "Crea .env.production nella root con almeno VITE_API_URL (URL backend Koyeb)." -ForegroundColor Yellow
    Write-Host "Puoi copiare .env.production.example e compilare VITE_API_URL." -ForegroundColor Yellow
    $r = Read-Host "Vuoi continuare senza .env.production? (s/n)"
    if ($r -ne "s") { exit 1 }
} else {
    $content = Get-Content "$rootDir\.env.production" -Raw
    if ($content -notmatch "VITE_API_URL=.+") {
        Write-Host "Attenzione: .env.production potrebbe non avere VITE_API_URL. Le chiamate API potrebbero fallire." -ForegroundColor Yellow
    }
}

Set-Location $rootDir
Write-Host "Build frontend..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Deploy su Firebase Hosting..." -ForegroundColor Cyan
firebase deploy --only hosting
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Deploy completato. Verifica https://pizzamanager.it" -ForegroundColor Green
