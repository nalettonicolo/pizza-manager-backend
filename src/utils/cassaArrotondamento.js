/** Arrotonda a 0,05 € (5 centesimi), utile per contanti. */
export function roundTotalToFiveCents(euro) {
  const n = Number(euro)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n * 20) / 20
}
