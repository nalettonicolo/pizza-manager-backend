# Avvia Chrome/Edge in modalità stampa diretta (senza anteprima/conferma extra).
# Uso tipico su PC cassa con stampante predefinita POS-58.
#
# Esempio:
#   .\scripts\cassa-chrome-stampa-diretta.ps1
#   .\scripts\cassa-chrome-stampa-diretta.ps1 -Url "https://pizzamanager.it/operative/cassa"
#
param(
  [string]$Url = "https://pizzamanager.it/login"
)

$candidates = @(
  "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe"
)

$browser = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) {
  Write-Error "Chrome/Edge non trovati. Installa Chrome oppure apri Edge con: msedge --kiosk-printing $Url"
  exit 1
}

Write-Host "Avvio: $browser"
Write-Host "URL: $Url"
Write-Host "Flag: --kiosk-printing (stampa diretta sulla stampante predefinita Windows)"
Start-Process -FilePath $browser -ArgumentList @(
  "--kiosk-printing",
  "--disable-print-preview",
  $Url
)
