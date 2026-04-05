/**
 * Estrae ##, ###, #### da markdown (indice Guida utente). Ignora commenti HTML in testa.
 */
export function slugifyHeading(text) {
  const s = String(text || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "sezione";
}

/**
 * @param {string} md
 * @returns {{ toc, h2List, h3List, h4List }}
 */
export function buildGuidaToc(md) {
  const lines = String(md || "").split(/\r?\n/);
  const slugCounts = {};
  const bumpId = (base) => {
    const n = (slugCounts[base] = (slugCounts[base] || 0) + 1);
    return n === 1 ? base : `${base}-${n}`;
  };

  const toc = [];
  const h2List = [];
  const h3List = [];
  const h4List = [];

  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("#### ")) {
      const text = t.slice(5).trim();
      if (!text) continue;
      const id = bumpId(slugifyHeading(text));
      toc.push({ level: 4, text, id });
      h4List.push({ id });
    } else if (t.startsWith("### ")) {
      const text = t.slice(4).trim();
      if (!text) continue;
      const id = bumpId(slugifyHeading(text));
      toc.push({ level: 3, text, id });
      h3List.push({ id });
    } else if (t.startsWith("## ")) {
      const text = t.slice(3).trim();
      if (!text) continue;
      const id = bumpId(slugifyHeading(text));
      toc.push({ level: 2, text, id });
      h2List.push({ id });
    }
  }

  return { toc, h2List, h3List, h4List };
}
