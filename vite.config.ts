import { defineConfig, loadEnv } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { VitePWA as vitePWA } from "vite-plugin-pwa";
import webfontDownload from "vite-plugin-webfont-dl";
import sveltePreprocess from "svelte-preprocess";

import type * as vite from "vite";
import * as path from "path";
import * as fs from "fs/promises";

import manifestFunc from "./src/manifest.js";

export default defineConfig((env) => {
  const manifest = manifestFunc(env.mode);
  return {
    plugins: [
      {
        name: "manifest-index",
        transformIndexHtml: {
          enforce: "pre",
          transform(html: string) {
            return html.replace(
              /{{\s*(.+)\s*}}/gi,
              // https://esbuild.github.io/content-types/#direct-eval
              (match, expr) => new Function("manifest", `return ${expr}`)(manifest) || ""
            );
          },
        },
      },
      webfontDownload([
        "https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@400;600;700&display=swap",
        "https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@48,400,0,0",
      ]),
      vitePWA({
        manifest: manifest,
        registerType: "autoUpdate",
        // See:
        // https://vite-pwa-org.netlify.app/workbox/generate-sw.html
        // https://vite-pwa-org.netlify.app/workbox/inject-manifest.html
        strategies: "generateSW",
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png}"],
        },
        devOptions: {
          enabled: true,
        },
      }),
      svelte({
        preprocess: sveltePreprocess({
          scss: {
            prependData: `@import "${path.resolve(__dirname, "./src/styles/variables.scss")}";`,
          },
        }),
      }),
    ],
    worker: {
      format: "iife",
    },
    root: path.resolve(__dirname, "src"),
    envPrefix: "APP_",
    publicDir: "../public",
    server: {
      port: 5000,
      proxy: {
        "/__discord__": {
          target: "https://discord.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/__discord__/, ""),
        },
        "/__gateway__": wsProxy("wss://gateway.discord.gg", /^\/__gateway__/),
        "/__auth_gateway__": wsProxy("wss://remote-auth-gateway.discord.gg", /^\/__auth_gateway__/),
      },
    },
    build: {
      target: ["firefox57"],
      outDir: "../dist",
      emptyOutDir: true,
    },
    // https://github.com/vitejs/vite/issues/7385#issuecomment-1286606298
    resolve: {
      alias: {
        "#": path.resolve(__dirname, "./src/"),
      },
    },
  };
});

function wsProxy(target: string, base: RegExp): vite.ProxyOptions {
  const url = new URL(target);
  return {
    target,
    ws: true,
    changeOrigin: true,
    rewrite: (path) => path.replace(base, ""),
    configure: (proxy) => {
      // That was stupid. This is required for Cloudflare to not freak out.
      proxy.on("proxyReqWs", (proxyReq, req, socket, options, head) => {
        proxyReq.setHeader("Origin", "https://discord.com");
        proxyReq.setHeader("Host", url.host);
      });
    },
  };
}
