// App desktop Windows per PizzaManager: un wrapper nativo (Electron) attorno al sito già in
// produzione (admin tenant, cassa/reparti operativi, superadmin) — nessuna duplicazione di
// logica di routing/tenant/login: la finestra carica lo stesso URL del browser, quindi tutto
// (auth, RLS, realtime) funziona esattamente come sul web. Il tracciamento resta legato al login
// dell'utente, non a un client separato.
//
// Si parte sempre dalla pagina di login (non dalla landing marketing): se una sessione è già
// valida, Login.jsx reindirizza da solo alla home corretta per ruolo (admin tenant, cassa,
// superadmin) — un unico ingresso valido per qualsiasi tenant, dato che tutti i pannelli vivono
// sullo stesso dominio pizzamanager.it.
//
// Sviluppo: ELECTRON_START_URL=http://localhost:5173/login npm run electron:dev (dev server Vite)
// Produzione: carica PIZZAMANAGER_URL (default https://pizzamanager.it/login)

const { app, BrowserWindow, shell, Menu, session, ipcMain } = require("electron")
const path = require("node:path")
const fs = require("node:fs")
const { autoUpdater } = require("electron-updater")

const START_URL =
  process.env.ELECTRON_START_URL || process.env.PIZZAMANAGER_URL || "https://pizzamanager.it/login"

const ICON_PATH = path.join(__dirname, "build", "icon.ico")
const STATE_FILE = path.join(app.getPath("userData"), "window-state.json")
// Percorso letterale, NON app.getPath("userData"): quel percorso dipende da app.name, che per
// un pacchetto electron-builder spesso diventa il "productName" ("PizzaManager", senza trattino)
// invece del "name" di package.json ("pizza-manager") — l'installer (installer.nsh) scrive
// SEMPRE in %APPDATA%\pizza-manager\, quindi qui dobbiamo leggere esattamente da lì, altrimenti
// il file non viene mai trovato e il riconoscimento tenant resta sempre vuoto.
const TENANT_BINDING_FILE = path.join(
  process.env.APPDATA || app.getPath("userData"),
  "pizza-manager",
  "tenant-binding.json",
)

/** Dati del tenant "riconosciuto" via Partita IVA durante l'installazione (vedi
 * electron/build/installer.nsh), se presenti — mai creati né modificati da qui, solo letti. */
function loadTenantBinding() {
  try {
    const raw = fs.readFileSync(TENANT_BINDING_FILE, "utf8")
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object" && parsed.ok && parsed.nome) return parsed
  } catch {
    /* nessun binding salvato in fase di installazione: normale, resta il login classico */
  }
  return null
}

/** Ricorda dimensione/posizione finestra tra un avvio e l'altro (nessuna dipendenza esterna). */
function loadWindowState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf8")
    const parsed = JSON.parse(raw)
    if (
      parsed &&
      Number.isFinite(parsed.width) &&
      Number.isFinite(parsed.height) &&
      parsed.width > 200 &&
      parsed.height > 200
    ) {
      return parsed
    }
  } catch {
    /* prima esecuzione, o file corrotto: usa i default */
  }
  return { width: 1400, height: 900 }
}

function saveWindowState(win) {
  if (!win || win.isDestroyed()) return
  try {
    const bounds = win.isMaximized() ? win.getNormalBounds() : win.getBounds()
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify({ ...bounds, maximized: win.isMaximized() }),
      "utf8",
    )
  } catch {
    /* non bloccante: al peggio riparte con le dimensioni di default */
  }
}

function createWindow() {
  const state = loadWindowState()
  const tenantBinding = loadTenantBinding()

  const win = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 1024,
    minHeight: 640,
    title: tenantBinding ? `PizzaManager — ${tenantBinding.nome}` : "PizzaManager",
    icon: fs.existsSync(ICON_PATH) ? ICON_PATH : undefined,
    autoHideMenuBar: true,
    backgroundColor: "#f4f6fb",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
      // Passa al preload i dati del tenant "riconosciuto" in fase di installazione (se presenti):
      // solo nome/indirizzo/logo, mai credenziali — il preload li espone così alla pagina web,
      // che può mostrarli (es. nome pizzeria) prima ancora del login.
      additionalArguments: [`--pm-tenant-binding=${JSON.stringify(tenantBinding || null)}`],
    },
  })

  if (state.maximized) win.maximize()

  win.loadURL(START_URL)

  // Link/redirect verso un'origine diversa da quella dell'app (checkout Stripe/SumUp, WhatsApp,
  // documenti esterni, mailto...) si aprono nel browser di sistema, mai in una nuova finestra
  // Electron senza chrome — altrimenti popup di pagamento/OAuth risulterebbero rotti o non finibili.
  const appOrigin = new URL(START_URL).origin
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      if (new URL(url).origin !== appOrigin) {
        shell.openExternal(url)
        return { action: "deny" }
      }
    } catch {
      shell.openExternal(url)
      return { action: "deny" }
    }
    return { action: "allow" }
  })
  win.webContents.on("will-navigate", (event, url) => {
    try {
      if (new URL(url).origin !== appOrigin) {
        event.preventDefault()
        shell.openExternal(url)
      }
    } catch {
      /* URL non parsabile: lascia proseguire la navigazione, innocuo */
    }
  })

  let saveTimer = null
  const scheduleSave = () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => saveWindowState(win), 400)
  }
  win.on("resize", scheduleSave)
  win.on("move", scheduleSave)
  win.on("close", () => saveWindowState(win))

  return win
}

/**
 * Aggiornamento automatico della SHELL Electron (main.cjs, preload, installer, icona…): a
 * differenza del contenuto web — che arriva da solo perché la finestra carica sempre il sito live
 * — un cambiamento a questi file richiede un nuovo installer, che nessun deploy del sito può
 * consegnare da solo. `electron-updater` controlla il file `latest.yml` pubblicato insieme
 * all'installer su pizzamanager.it (stesso hosting del sito, nessun servizio esterno in più),
 * scarica il nuovo pacchetto in background con una barra di avanzamento reale (eventi
 * "download-progress" con percentuale/byte reali, non simulati) e installa solo quando l'utente
 * conferma dalla finestrella dedicata — mai un riavvio a sorpresa mentre si sta lavorando (es. a
 * un ordine in cassa).
 */
let mainWindow = null
let updateWin = null

function showUpdateWindow() {
  if (updateWin && !updateWin.isDestroyed()) return updateWin
  updateWin = new BrowserWindow({
    width: 420,
    height: 264,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    // Figlia della finestra principale: resta sempre sopra di lei invece di potersi perdere
    // dietro, ma chiuderla non tocca la finestra principale né chiude l'app (window-all-closed
    // scatta solo quando anche quella è chiusa).
    parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
    title: "Aggiornamento PizzaManager",
    icon: fs.existsSync(ICON_PATH) ? ICON_PATH : undefined,
    backgroundColor: "#14171f",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "update-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  updateWin.setMenuBarVisibility(false)
  updateWin.loadFile(path.join(__dirname, "update-window.html"))
  updateWin.on("closed", () => {
    updateWin = null
  })
  return updateWin
}

function sendUpdateStatus(payload) {
  if (updateWin && !updateWin.isDestroyed()) {
    updateWin.webContents.send("update-status", payload)
  }
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on("update-available", (info) => {
    showUpdateWindow()
    sendUpdateStatus({ state: "available", version: info?.version })
  })
  autoUpdater.on("download-progress", (progress) => {
    sendUpdateStatus({
      state: "downloading",
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    })
  })
  autoUpdater.on("update-downloaded", (info) => {
    sendUpdateStatus({ state: "downloaded", version: info?.version })
  })
  autoUpdater.on("error", (err) => {
    // "update-available" non ancora emesso (nessun aggiornamento in giro, o rete assente): errore
    // silenzioso, non disturbare chi sta lavorando con un popup per un controllo di routine fallito.
    if (!updateWin) return
    sendUpdateStatus({ state: "error", message: err?.message || String(err) })
  })

  ipcMain.on("update-restart-and-install", () => {
    // quitAndInstall(isSilent, isForceRunAfter): di default isSilent è FALSE, quindi rilancerebbe
    // l'intero wizard NSIS interattivo (compresa la pagina Partita IVA, pensata solo per la prima
    // installazione) — un aggiornamento su un'app già installata deve applicarsi in silenzio,
    // come un aggiornamento di Windows, non ripetere la procedura di installazione da capo.
    autoUpdater.quitAndInstall(true, true)
  })
  ipcMain.on("update-dismiss", () => {
    if (updateWin && !updateWin.isDestroyed()) updateWin.close()
  })

  // Controllo silenzioso all'avvio: se non c'è nulla di nuovo non succede nulla in UI (nessun
  // "sei aggiornato" invadente) — solo un aggiornamento reale apre la finestrella.
  autoUpdater.checkForUpdates().catch(() => {
    /* offline o feed non raggiungibile: nessun blocco, si lavora comunque */
  })
}

/** Menu minimale: giusto Modifica (per copia/incolla nei form) e Vista (reload/zoom/devtools). */
function buildMenu() {
  const template = [
    {
      label: "Modifica",
      submenu: [
        { role: "undo", label: "Annulla" },
        { role: "redo", label: "Ripeti" },
        { type: "separator" },
        { role: "cut", label: "Taglia" },
        { role: "copy", label: "Copia" },
        { role: "paste", label: "Incolla" },
        { role: "selectAll", label: "Seleziona tutto" },
      ],
    },
    {
      label: "Vista",
      submenu: [
        { role: "reload", label: "Ricarica" },
        { role: "forceReload", label: "Ricarica (forza)" },
        { type: "separator" },
        { role: "resetZoom", label: "Zoom normale" },
        { role: "zoomIn", label: "Aumenta zoom" },
        { role: "zoomOut", label: "Riduci zoom" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Schermo intero" },
        { role: "toggleDevTools", label: "Strumenti sviluppo" },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  // Isola i permessi: nega tutto tranne notifiche (utili per gli avvisi ordine) e media
  // (fotocamera, usata dalla prova di consegna firma/foto) — mai geolocalizzazione automatica ecc.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(["notifications", "media"].includes(permission))
  })

  buildMenu()
  mainWindow = createWindow()
  setupAutoUpdater()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
