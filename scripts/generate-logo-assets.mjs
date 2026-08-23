#!/usr/bin/env node
/**
 * Genera i PNG del logo/icona app a partire da un SVG sorgente.
 * Script generico: funziona con QUALSIASI SVG quadrato in input, non solo con
 * branding/logo-mark.svg — utile anche se in futuro arriva un SVG da un altro
 * strumento/sito di generazione loghi: basta puntarci con --source.
 *
 * Uso:
 *   node scripts/generate-logo-assets.mjs
 *   node scripts/generate-logo-assets.mjs --source branding/logo-mark.svg --out branding/dist
 *   node scripts/generate-logo-assets.mjs --source path/a/un/altro-logo.svg --sizes 16,32,64,180,192,512
 *
 * Richiede la devDependency "sharp" (già aggiunta a package.json).
 */
import { mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"

function parseArgs(argv) {
  const args = { source: "branding/logo-mark.svg", out: "branding/dist", sizes: "16,32,48,64,180,192,512" }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === "--source") args.source = argv[++i]
    else if (a === "--out") args.out = argv[++i]
    else if (a === "--sizes") args.sizes = argv[++i]
    else if (a === "--help" || a === "-h") args.help = true
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(
      [
        "Genera PNG dell'icona app a più dimensioni da un SVG sorgente.",
        "",
        "  --source <file.svg>   SVG di partenza (default: branding/logo-mark.svg)",
        "  --out <cartella>      Cartella di output (default: branding/dist)",
        "  --sizes <n,n,n>       Lati in px da generare (default: 16,32,48,64,180,192,512)",
      ].join("\n"),
    )
    return
  }

  const sourcePath = path.resolve(process.cwd(), args.source)
  if (!existsSync(sourcePath)) {
    console.error(`SVG sorgente non trovato: ${sourcePath}`)
    process.exitCode = 1
    return
  }

  const outDir = path.resolve(process.cwd(), args.out)
  await mkdir(outDir, { recursive: true })

  const sizes = args.sizes
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)

  if (!sizes.length) {
    console.error("Nessuna dimensione valida in --sizes.")
    process.exitCode = 1
    return
  }

  console.log(`Sorgente: ${sourcePath}`)
  console.log(`Output:   ${outDir}\n`)

  const generated = []
  for (const size of sizes) {
    const fileName = `icon-${size}.png`
    const outPath = path.join(outDir, fileName)
    await sharp(sourcePath, { density: Math.max(96, size * 2) })
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(outPath)
    generated.push({ size, outPath })
    console.log(`  ✓ ${fileName} (${size}×${size})`)
  }

  // Alias con i nomi convenzionali più usati (favicon, PWA, Apple touch icon), se la
  // dimensione corrispondente è stata generata — evita di dover ricordare quale numero
  // corrisponde a quale uso.
  const aliasMap = {
    32: "favicon-32.png",
    180: "apple-touch-icon.png",
    192: "icon-192.png",
    512: "icon-512.png",
  }
  for (const g of generated) {
    const alias = aliasMap[g.size]
    if (!alias) continue
    const { copyFile } = await import("node:fs/promises")
    await copyFile(g.outPath, path.join(outDir, alias))
    console.log(`  ↳ alias: ${alias}`)
  }

  console.log(`\nFatto — ${generated.length} PNG generati in ${outDir}`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
