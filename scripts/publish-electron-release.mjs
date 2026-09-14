#!/usr/bin/env node
/**
 * Copia gli artefatti generati da electron-builder (installer .exe, .blockmap, latest.yml) da
 * release/ dentro public/desktop-releases/, così un normale `npm run deploy:hosting:ci` li
 * pubblica su pizzamanager.it/desktop-releases/ — è lì che electron-updater (build.publish nel
 * package.json) controlla se esiste una versione più recente. Nessun servizio di hosting
 * aggiuntivo: stessa infrastruttura Firebase già in uso per il sito.
 *
 * Uso: node scripts/publish-electron-release.mjs (lanciato in coda a `electron:build:win`)
 */
import { readdir, mkdir, copyFile } from "node:fs/promises"
import path from "node:path"

const RELEASE_DIR = path.resolve(process.cwd(), "release")
const OUT_DIR = path.resolve(process.cwd(), "public/desktop-releases")

async function main() {
  const entries = await readdir(RELEASE_DIR, { withFileTypes: true })
  const toCopy = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => name.endsWith(".exe") || name.endsWith(".exe.blockmap") || name === "latest.yml")

  if (!toCopy.length) {
    console.error("Nessun artefatto trovato in release/ — hai lanciato electron-builder prima di questo script?")
    process.exitCode = 1
    return
  }

  await mkdir(OUT_DIR, { recursive: true })
  for (const name of toCopy) {
    await copyFile(path.join(RELEASE_DIR, name), path.join(OUT_DIR, name))
    console.log(`  ✓ ${name}`)
  }
  console.log(`\nFatto — ${toCopy.length} file copiati in ${OUT_DIR}`)
  console.log("Ricorda: restano solo locali finché non lanci un deploy (npm run deploy:hosting:ci).")
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
