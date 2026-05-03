<#
.SYNOPSIS
  Da root repo (Windows): push su GitHub e aggiorna il clone sul server via SSH.

.DESCRIPTION
  1) git push (salta con -NoPush se hai già pushato)
  2) ssh → git pull --ff-only sul server
  Opzionale: rebuild Nest + restart systemd (solo quando tocchi il backend)

.PARAMETER SshHost
  Alias SSH (es. da ~/.ssh/config). Default: servercasa

.PARAMETER RemotePath
  Path remoto del repo (bash). Default: ~/progetti/PizzaManagerApp

.EXAMPLE
  .\scripts\sync-to-server.ps1
.EXAMPLE
  .\scripts\sync-to-server.ps1 -RebuildBackend
.EXAMPLE
  .\scripts\sync-to-server.ps1 -NoPush -RebuildBackend
#>
param(
    [string] $SshHost = "servercasa",
    [string] $RemotePath = "~/progetti/PizzaManagerApp",
    [switch] $NoPush,
    [switch] $RebuildBackend,
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
if ($RebuildBackend) {
    $remoteCmd += " && cd server/pizzeria-backend && npm run build && sudo systemctl restart $SystemdService"
}

Write-Host ">>> ssh $SshHost (pull sul server)" -ForegroundColor Cyan
if ($RebuildBackend) {
    Write-Host "    (+ build backend + sudo systemctl restart $SystemdService)" -ForegroundColor DarkGray
}

# Argomenti separati: evita problemi di quoting rispetto a una sola stringa per ssh.
ssh $SshHost bash -lc $remoteCmd

if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Host ">>> Fatto." -ForegroundColor Green
