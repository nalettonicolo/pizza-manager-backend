; Pagina aggiuntiva del wizard di installazione Windows: chiede la Partita IVA della pizzeria,
; verifica in tempo reale (chiamata HTTP via PowerShell, già presente su ogni Windows moderno,
; nessun plugin NSIS di terze parti da scaricare) che esista un tenant ATTIVO con quella P.IVA e,
; se lo trova, salva pochi dati non sensibili (id, nome, indirizzo, logo) in
; %APPDATA%\pizza-manager\tenant-binding.json — l'app li legge al primo avvio per mostrare subito
; il nome/logo della pizzeria giusta sulla schermata di login. Il tenant, il suo spazio nel
; database e il suo abbonamento sono sempre creati in anticipo dal superadmin: questo passaggio
; non crea né modifica mai nulla, è solo un "riconoscimento". Campo OBBLIGATORIO: senza una
; Partita IVA riconosciuta dal sistema l'installazione non prosegue (richiesta esplicita —
; evita che l'app venga installata da chi non ha ancora un tenant attivo su PizzaManager).
; Questi !include vanno a livello di file (non dentro una macro): le Function più sotto sono
; lette subito, nello stesso passaggio in cui NSIS elabora questo !include — una macro come
; customHeader esegue il suo contenuto solo quando electron-builder la richiama più avanti nel
; proprio template, troppo tardi per ${If}/nsDialogs qui sotto.
!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "WordFunc.nsh"
!insertmacro WordFind

; Solo nel compilatore dell'installer, mai in quello del disinstallatore (stesso file incluso in
; entrambi i passaggi): nel disinstallatore né queste variabili né questa pagina vengono mai
; referenziate da nulla, e NSIS tratta una variabile/funzione così "orfana" come un avviso — che
; qui è fatale (electron-builder considera gli avvisi come errori).
!ifndef BUILD_UNINSTALLER

Var PM_Dialog
Var PM_InputPiva
Var PM_Piva
Var PM_ExecOut
Var PM_ExecTag

!macro customPageAfterChangeDir
  Page custom PmPivaPageCreate PmPivaPageLeave
!macroend

Function PmPivaPageCreate
  !insertmacro MUI_HEADER_TEXT "Collega la tua pizzeria" "Partita IVA obbligatoria: deve essere già registrata su PizzaManager."
  nsDialogs::Create 1018
  Pop $PM_Dialog
  ${If} $PM_Dialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0u 100% 34u "Inserisci la tua Partita IVA per poter installare l'applicazione (11 cifre). Deve essere quella con cui la tua pizzeria è già registrata su PizzaManager."
  Pop $0

  ${NSD_CreateText} 0 38u 100% 14u ""
  Pop $PM_InputPiva

  nsDialogs::Show
FunctionEnd

Function PmPivaPageLeave
  ${NSD_GetText} $PM_InputPiva $PM_Piva

  ; Campo obbligatorio: senza una Partita IVA riconosciuta dal sistema l'installazione non
  ; prosegue (richiesta esplicita, non più facoltativa come nella versione precedente).
  ${If} $PM_Piva == ""
    MessageBox MB_OK|MB_ICONEXCLAMATION "Devi inserire la Partita IVA della tua pizzeria per poter installare PizzaManager."
    Abort
  ${EndIf}

  DetailPrint "Verifica Partita IVA in corso..."
  ; L'output include nome|indirizzo|sede_legale (separati da "|"): indirizzo e sede_legale
  ; possono essere vuoti, sede_legale arriva già filtrata dalla funzione (solo se diversa
  ; dall'indirizzo operativo) — qui si mostrano entrambi solo se presenti, per un riepilogo
  ; più completo/professionale in fase di installazione. "_" invece di stringa vuota per i campi
  ; mancanti: ${WordFind} con delimitatori consecutivi vuoti ("||") non li tratta come parole
  ; vuote separate ma restituisce l'intera stringa originale — bug osservato ("Sede legale:
  ; <nome>||"). Un segnaposto non vuoto in ogni posizione evita delimitatori adiacenti.
  nsExec::ExecToStack `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$$ProgressPreference='SilentlyContinue'; try { $$piva = '$PM_Piva'; $$uri = 'https://flfhrwzlrftuhkrfwzse.supabase.co/functions/v1/verifica-piva-tenant?piva=' + [uri]::EscapeDataString($$piva); $$r = Invoke-RestMethod -Uri $$uri -Headers @{apikey='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsZmhyd3pscmZ0dWhrcmZ3enNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5NzY0MjEsImV4cCI6MjA3NDU1MjQyMX0.5JRY5xAGbr8ZSbwB6-aFZ45hVP-nxG7G265Nt5LZIiY'} -TimeoutSec 12; if ($$r.ok) { $$dir = Join-Path $$env:APPDATA 'pizza-manager'; New-Item -ItemType Directory -Force -Path $$dir | Out-Null; $$r | ConvertTo-Json -Compress | Set-Content -Path (Join-Path $$dir 'tenant-binding.json') -Encoding UTF8; $$ind = $$r.indirizzo; if (-not $$ind) { $$ind = '_' }; $$sede = $$r.sede_legale; if (-not $$sede) { $$sede = '_' }; Write-Output ('FOUND:' + $$r.nome + '|' + $$ind + '|' + $$sede) } else { Write-Output ('NOTFOUND:' + $$r.reason) } } catch { Write-Output 'NOTFOUND:network_error' }"`
  Pop $0
  Pop $PM_ExecOut

  ${WordFind} $PM_ExecOut ":" "+1" $PM_ExecTag
  ${If} $PM_ExecTag == "FOUND"
    ${WordFind} $PM_ExecOut ":" "+2" $1
    ${WordFind} $1 "|" "+1" $0
    ${WordFind} $1 "|" "+2" $2
    ${WordFind} $1 "|" "+3" $3
    StrCpy $4 "Abbiamo trovato: $0"
    ${If} $2 != "_"
      StrCpy $4 "$4$\r$\n$2"
    ${EndIf}
    ${If} $3 != "_"
      StrCpy $4 "$4$\r$\nSede legale: $3"
    ${EndIf}
    StrCpy $4 "$4$\r$\n$\r$\nÈ la tua pizzeria?"
    MessageBox MB_YESNO|MB_ICONQUESTION $4 IDYES pm_confirmed
    Abort
    pm_confirmed:
    DetailPrint "Pizzeria collegata: $0"
  ${Else}
    ; Nessuna via per proseguire senza una P.IVA valida: solo OK, e si resta sulla pagina finché
    ; non viene riconosciuta — coerente con "non far procedere l'installazione" richiesto.
    MessageBox MB_OK|MB_ICONEXCLAMATION "Partita IVA non trovata: non risulta registrata su PizzaManager.$\r$\nControlla di averla scritta giusta, oppure contatta l'assistenza per registrare la tua pizzeria prima di installare l'app."
    Abort
  ${EndIf}
FunctionEnd

!endif ; BUILD_UNINSTALLER
