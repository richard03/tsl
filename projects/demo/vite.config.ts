import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Každý projekt je samostatná Vite aplikace s kořenem ve vlastní složce (adresář tohoto souboru).
// Sdílený framework nezávislý na projektu si bere přes alias `@engine`, který míří rovnou na
// TypeScriptové zdroje enginu — engine tedy nemá vlastní krok buildu.
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@engine": fileURLToPath(new URL("../../engine/src/index.ts", import.meta.url)),
    },
  },
  server: {
    // Povolí dev serveru číst zdroje sdíleného enginu, které leží mimo kořen tohoto projektu.
    fs: { allow: [fileURLToPath(new URL("../../", import.meta.url))] },
  },
});
