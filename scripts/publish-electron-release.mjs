#!/usr/bin/env node
/**
 * "Ponte" verso chi ha già installato una versione precedente alla 1.0.5 (che controllava ancora
 * questo URL, prima dello switch a GitHub Releases come canale principale — vedi
 * scripts/publish-github-release.mjs). Copia gli artefatti dell'ultima build da release/ dentro
 * public/desktop-releases/ (senza toccare gli installer di versioni precedenti già presenti lì),
 * così un normale `npm run deploy:hosting:ci` li pubblica su pizzamanager.it/desktop-releases/.
 *
 * Il file installer generato in locale ha spazi nel nome ("PizzaManager Setup 1.0.5.exe"), ma
 * electron-builder scrive dentro latest.yml il nome "sicuro per URL" (trattini, es.
 * "PizzaManager-Setup-1.0.5.exe") — qui l'installer viene copiato con ESATTAMENTE quel nome,
 * altrimenti electron-updater cercherebbe un file che non esiste (stesso bug già corretto per la
 * pubblicazione su GitHub, vedi publish-github-release.mjs).
 *
 * Uso: node scripts/publish-electron-release.mjs
 */
import { readdir, mkdir, copyFile, readFile } from "node:fs/promises"
import path from "node:path"

const RELEASE_DIR = path.resolve(process.cwd(), "release")
const OUT_DIR = path.resolve(process.cwd(), "public/desktop-releases")

function extractInstallerNameFromLatestYml(yml) {
  const m = yml.match(/^\s*-?\s*url:\s*(\S+)\s*$/m)
  return m ? m[1] : null
}

async function main() {
  const pkg = JSON.parse(await readFile(path.resolve(process.cwd(), "package.json"), "utf8"))
  const version = pkg.version

  const latestYmlPath = path.join(RELEASE_DIR, "latest.yml")
  const latestYmlRaw = await readFile(latestYmlPath, "utf8")
  const expectedInstallerName = extractInstallerNameFromLatestYml(latestYmlRaw)
  if (!expectedInstallerName) {
    console.error("Non riesco a leggere il campo 'url:' da release/latest.yml — build electron-builder non riuscita?")
    process.exitCode = 1
    return
  }

  // release/ accumula gli installer di TUTTE le build fatte finora (non viene mai svuotata tra
  // una e l'altra): va filtrato esplicitamente per la versione corrente, altrimenti si rischia di
  // prendere il primo .exe trovato — che può benissimo essere di una versione vecchia.
  const entries = await readdir(RELEASE_DIR, { withFileTypes: true })
  const files = entries.filter((e) => e.isFile()).map((e) => e.name)
  const currentInstaller = files.find((name) => name.endsWith(".exe") && !name.endsWith(".blockmap") && name.includes(version))
  const currentBlockmap = files.find((name) => name === `${currentInstaller}.blockmap`)

  if (!currentInstaller || !currentBlockmap) {
    console.error(`Installer o .blockmap per la versione ${version} non trovati in release/ — hai lanciato electron-builder prima di questo script?`)
    process.exitCode = 1
    return
  }

  await mkdir(OUT_DIR, { recursive: true })

  await copyFile(path.join(RELEASE_DIR, currentInstaller), path.join(OUT_DIR, expectedInstallerName))
  console.log(`  ✓ ${expectedInstallerName} (rinominato da "${currentInstaller}" per combaciare con latest.yml)`)
  await copyFile(path.join(RELEASE_DIR, currentBlockmap), path.join(OUT_DIR, `${expectedInstallerName}.blockmap`))
  console.log(`  ✓ ${expectedInstallerName}.blockmap`)
  await copyFile(latestYmlPath, path.join(OUT_DIR, "latest.yml"))
  console.log("  ✓ latest.yml")

  console.log(`\nFatto — copiati in ${OUT_DIR} (gli installer di versioni precedenti già presenti restano intatti)`)
  console.log("Ricorda: restano solo locali finché non lanci un deploy (npm run deploy:hosting:ci).")
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
