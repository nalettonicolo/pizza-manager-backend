let currentFaviconSource = null;
let currentFaviconDataUrl = null;

function ensureFaviconLink() {
  let link = document.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "icon");
    document.head.appendChild(link);
  }
  return link;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function buildFaviconDataUrl(logoUrl) {
  const img = await loadImage(logoUrl);
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const square = Math.min(srcW, srcH);
  const sx = (srcW - square) / 2;
  const sy = (srcH - square) / 2;

  // Cerchio bianco di sfondo per rendere leggibile il simbolo su tutte le tab.
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.closePath();

  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, sx, sy, square, square, 2, 2, size - 4, size - 4);
  ctx.restore();

  return canvas.toDataURL("image/png");
}

export async function applyTenantFavicon(logoUrl) {
  if (typeof document === "undefined") return;
  const link = ensureFaviconLink();
  const source = String(logoUrl || "").trim();

  if (!source) {
    currentFaviconSource = null;
    currentFaviconDataUrl = null;
    link.removeAttribute("href");
    return;
  }

  if (source === currentFaviconSource && currentFaviconDataUrl) {
    link.setAttribute("href", currentFaviconDataUrl);
    return;
  }

  try {
    const dataUrl = await buildFaviconDataUrl(source);
    if (dataUrl) {
      currentFaviconSource = source;
      currentFaviconDataUrl = dataUrl;
      link.setAttribute("href", dataUrl);
      return;
    }
  } catch {
    // Fallback diretto: usa il logo come favicon se il canvas non è possibile (CORS / formato).
  }

  currentFaviconSource = source;
  currentFaviconDataUrl = source;
  link.setAttribute("href", source);
}
