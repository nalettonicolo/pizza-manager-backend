#!/usr/bin/env node
/**
 * Pubblica gli artefatti generati da electron-builder (installer .exe, .blockmap, latest.yml) su
 * GitHub Releases (repo pubblica nalettonicolo/pizza-manager-backend) — è lì che electron-updater
 * controlla gli aggiornamenti a partire dalla 1.0.5 (build.publish nel package.json). Usa la CLI
 * `gh`, già autenticata sulla macchina, invece del meccanismo di publish integrato di
 * electron-builder: un comando in più, ma niente token da passare come variabile d'ambiente e
 * pieno controllo su cosa viene caricato.
 *
 * Il nome del file installer generato in locale contiene spazi ("PizzaManager Setup 1.0.5.exe"),
 * ma electron-builder scrive dentro latest.yml il nome "sicuro per URL" che si aspetta come asset
 * GitHub (trattini, es. "PizzaManager-Setup-1.0.5.exe") — è il nome che userà quando pubblica lui
 * stesso. `gh release create` invece carica l'asset con il nome letterale del file locale, e
 * GitHub a sua volta sostituisce gli spazi con dei punti: senza intervenire, l'asset finirebbe per
 * chiamarsi "PizzaManager.Setup.1.0.5.exe", diverso da entrambi — electron-updater non lo
 * troverebbe mai. Qui i file vengono copiati in uno stage temporaneo con il nome ESATTO scritto in
 * latest.yml prima del caricamento, così i tre nomi combaciano.
 *
 * Uso: node scripts/publish-github-release.mjs (lanciato in coda a electron-builder)
 */
import { readdir, readFile, mkdtemp, copyFile, rm } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import path from "node:path"
import os from "node:os"

const RELEASE_DIR = path.resolve(process.cwd(), "release")
const REPO = "nalettonicolo/pizza-manager-backend"

/** Legge solo il campo "url:" di primo livello da latest.yml (niente dipendenza da un parser YAML
 * per un file così semplice e a formato fisso, generato sempre da electron-builder). */
function extractInstallerNameFromLatestYml(yml) {
  const m = yml.match(/^\s*-?\s*url:\s*(\S+)\s*$/m)
  return m ? m[1] : null
}

async function main() {
  const pkgPath = path.resolve(process.cwd(), "package.json")
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"))
  const version = pkg.version
  const tag = `v${version}`

  const latestYmlPath = path.join(RELEASE_DIR, "latest.yml")
  const latestYmlRaw = await readFile(latestYmlPath, "utf8")
  const expectedInstallerName = extractInstallerNameFromLatestYml(latestYmlRaw)
  if (!expectedInstallerName) {
    console.error("Non riesco a leggere il campo 'url:' da release/latest.yml — build electron-builder non riuscita?")
    process.exitCode = 1
    return
  }

  const entries = await readdir(RELEASE_DIR, { withFileTypes: true })
  const localInstaller = entries
    .map((e) => e.name)
    .find((name) => name.endsWith(".exe") && !name.endsWith(".blockmap") && name.includes(version))
  const localBlockmap = entries.map((e) => e.name).find((name) => name.endsWith(".exe.blockmap") && name.includes(version))

  if (!localInstaller || !localBlockmap) {
    console.error(`Installer o .blockmap per la versione ${version} non trovati in release/ — hai lanciato electron-builder prima di questo script?`)
    process.exitCode = 1
    return
  }

  const stageDir = await mkdtemp(path.join(os.tmpdir(), "pm-release-"))
  const stagedInstaller = path.join(stageDir, expectedInstallerName)
  const stagedBlockmap = path.join(stageDir, `${expectedInstallerName}.blockmap`)
  const stagedYml = path.join(stageDir, "latest.yml")

  await copyFile(path.join(RELEASE_DIR, localInstaller), stagedInstaller)
  await copyFile(path.join(RELEASE_DIR, localBlockmap), stagedBlockmap)
  await copyFile(latestYmlPath, stagedYml)

  console.log(`Pubblico ${tag} su ${REPO} (nomi asset allineati a latest.yml):`)
  console.log(`  · ${expectedInstallerName}`)
  console.log(`  · ${expectedInstallerName}.blockmap`)
  console.log(`  · latest.yml`)

  try {
    execFileSync(
      "gh",
      [
        "release",
        "create",
        tag,
        stagedInstaller,
        stagedBlockmap,
        stagedYml,
        "--repo",
        REPO,
        "--title",
        `PizzaManager ${version}`,
        "--notes",
        `Aggiornamento automatico dell'app desktop PizzaManager alla versione ${version}.`,
      ],
      { stdio: "inherit" },
    )
  } catch {
    console.error("\nPubblicazione fallita — controlla l'output sopra (es. release già esistente per questo tag).")
    process.exitCode = 1
    return
  } finally {
    await rm(stageDir, { recursive: true, force: true })
  }

  console.log(`\nFatto — ${tag} pubblicata su https://github.com/${REPO}/releases/tag/${tag}`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
