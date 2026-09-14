// Preload della piccola finestra di aggiornamento (electron/update-window.html): espone solo
// quanto serve a mostrare la barra di progresso e i due pulsanti, nessun accesso Node esteso.
const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("updateBridge", {
  onStatus: (callback) => {
    ipcRenderer.on("update-status", (_event, payload) => callback(payload))
  },
  restartAndInstall: () => ipcRenderer.send("update-restart-and-install"),
  dismiss: () => ipcRenderer.send("update-dismiss"),
})
