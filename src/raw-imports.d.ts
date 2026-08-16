/**
 * Type declarations for Vite ?raw imports.
 *
 * Vite supports importing any file as a raw string via the `?raw` suffix.
 * This is used by the ICM (Interpretable Context Methodology) loader
 * (src/constants/loadPrompts.ts) to read markdown prompt files at build time.
 *
 * See: https://vitejs.dev/guide/assets.html#importing-asset-as-string
 */

declare module '*.md?raw' {
  const content: string;
  export default content;
}

declare module '*?raw' {
  const content: string;
  export default content;
}
