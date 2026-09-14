#!/usr/bin/env node
/**
 * Genera electron/build/icon.ico dal logo pubblico del progetto (public/favicon.png — la scatola
 * con il monogramma "PM", già usata come favicon del sito e nei manifest PWA), per l'icona
 * dell'app desktop Windows — confermato da Nicolò come icona corretta. Usa "sharp" (già
 * devDependency) per ridimensionare i PNG alle dimensioni standard di un'icona .ico, poi li
 * impacchetta a mano nel formato ICO (contenitore "PNG-in-ICO", supportato da Windows dalla
 * Vista in poi) — nessuna dipendenza aggiuntiva.
 *
 * Uso: node scripts/build-electron-icon.mjs
 */
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const SOURCE = path.resolve(process.cwd(), "public/favicon.png")
const OUT_DIR = path.resolve(process.cwd(), "electron/build")
const OUT_FILE = path.join(OUT_DIR, "icon.ico")
const SIZES = [16, 24, 32, 48, 64, 128, 256]

function icoDirEntry({ size, dataLength, offset }) {
  const buf = Buffer.alloc(16)
  buf.writeUInt8(size >= 256 ? 0 : size, 0) // width (0 = 256)
  buf.writeUInt8(size >= 256 ? 0 : size, 1) // height (0 = 256)
  buf.writeUInt8(0, 2) // color count (0 = >=256 colors, true color)
  buf.writeUInt8(0, 3) // reserved
  buf.writeUInt16LE(1, 4) // color planes
  buf.writeUInt16LE(32, 6) // bits per pixel
  buf.writeUInt32LE(dataLength, 8) // size of image data
  buf.writeUInt32LE(offset, 12) // offset of image data
  return buf
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  const pngBuffers = []
  for (const size of SIZES) {
    // Fonte già raster (favicon.png, 672×672): "cover" invece di "contain" così il monogramma
    // riempie il quadrato dell'icona invece di rimpicciolirsi con bordi vuoti attorno.
    const buf = await sharp(SOURCE)
      .resize(size, size, { fit: "cover" })
      .png()
      .toBuffer()
    pngBuffers.push({ size, buf })
    console.log(`  ✓ ${size}×${size} (${buf.length} byte)`)
  }

  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: 1 = icon
  header.writeUInt16LE(pngBuffers.length, 4) // image count

  let offset = 6 + pngBuffers.length * 16
  const entries = []
  for (const { size, buf } of pngBuffers) {
    entries.push(icoDirEntry({ size, dataLength: buf.length, offset }))
    offset += buf.length
  }

  const ico = Buffer.concat([header, ...entries, ...pngBuffers.map((p) => p.buf)])
  await writeFile(OUT_FILE, ico)
  console.log(`\nFatto — ${OUT_FILE} (${pngBuffers.length} risoluzioni, ${ico.length} byte totali)`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
