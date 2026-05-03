<#
.SYNOPSIS
  Da root repo (Windows): push su GitHub e aggiornamento automatico sul server via SSH.

.DESCRIPTION
  1) git push (salta con -NoPush)
  2) ssh → git pull --ff-only sul server
  3) Di default: build Nest (server/pizzeria-backend) + sudo systemctl restart servizio
  Usa -SkipBackend se vuoi solo il pull (es. solo doc o deploy frontend altrove).

.PARAMETER SshHost
  Alias SSH (es. ~/.ssh/config). Default: servercasa

.PARAMETER RemotePath
  Path remoto del repo (bash). Default: ~/progetti/PizzaManagerApp

.PARAMETER SystemdService
  Unit systemd del backend. Default: pizzamanager-api

.EXAMPLE
  .\scripts\sync-to-server.ps1
.EXAMPLE
  .\scripts\sync-to-server.ps1 -SkipBackend
.EXAMPLE
  .\scripts\sync-to-server.ps1 -NoPush
#>
param(
    [string] $SshHost = "servercasa",
    [string] $RemotePath = "~/progetti/PizzaManagerApp",
    [switch] $NoPush,
    [switch] $SkipBackend,
    [string] $SystemdService = "pizzamanager-api"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath ".git")) {
    Write-Error "Esegui dalla root del repository (cartella con .git)."
    exit 1
}

if (-not $NoPush) {
    Write-Host ">>> git push" -ForegroundColor Cyan
    git push
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

$remoteCmd = "set -e; cd $RemotePath && git pull --ff-only"
if (-not $SkipBackend) {
    $remoteCmd += " && cd server/pizzeria-backend && npm run build && sudo systemctl restart $SystemdService"
}

Write-Host ">>> ssh $SshHost" -ForegroundColor Cyan
Write-Host "    $remoteCmd" -ForegroundColor DarkGray

ssh $SshHost bash -lc $remoteCmd

if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Host ">>> Fatto." -ForegroundColor Green
