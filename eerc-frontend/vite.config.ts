// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

/**
 * The eERC SDK is a Node-targeted library. It reaches for `Buffer`, `process`
 * and `global` at runtime -- most importantly `Buffer.from(hex, "hex")`, which
 * is how it turns a wallet signature into a decryption key.
 *
 * This previously used hand-wired aliases plus @esbuild-plugins/node-globals-
 * polyfill. Two things were wrong with that arrangement and both were silent:
 * the esbuild shim's hex codec rejects valid hex, so every eERC operation died
 * with "Invalid hex string"; and the `buffer` alias made Vite apply CommonJS
 * interop to a pre-bundle that carries only named exports, so an import of it
 * resolved to undefined with no error at the import site.
 *
 * vite-plugin-node-polyfills installs the genuine implementations as real
 * globals in both dev and build, which is the whole fix.
 */
export default defineConfig({
  plugins: [
    react(),
    // Tailwind v4 ships as a Vite plugin; without it every utility class in
    // the app is inert, which is why the UI once rendered unstyled.
    tailwindcss(),
    nodePolyfills({
      globals: { Buffer: true, process: true, global: true },
      protocolImports: true,
    }),
  ],
  build: { target: "esnext" },
});
