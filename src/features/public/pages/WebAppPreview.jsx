import PublicStore from "@/features/public/pages/PublicStore";

/**
 * Anteprima webapp: usa la stessa vetrina pubblica reale del tenant.
 * In questo modo non c'è divergenza tra preview e storefront online.
 */
export default function WebAppPreview() {
  return <PublicStore />;
}
