/**
 * Etichetta leggibile dal prefisso email (es. mario.rossi@x.it → "Mario.rossi").
 */
export function labelFromEmailPrefix(email) {
  if (!email || !email.includes("@")) return "";
  const prefix = email.split("@")[0].trim();
  if (!prefix) return "";
  return prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase().replace(/(\d+)/, " $1");
}
