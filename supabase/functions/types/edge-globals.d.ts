/**
 * Runtime reale: Deno su Supabase Edge.
 * Dichiarazione minima per il language service TypeScript dell’editor (non usata dal bundle Vite).
 */
declare const Deno: {
  serve(handler: (request: Request) => Response | Promise<Response>): void
  env: { get(key: string): string | undefined }
}
