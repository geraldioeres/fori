/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cpSync, createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, join, normalize, resolve } from 'node:path';
import { createRequire } from 'node:module';

const PDFJS_ASSET_DIRS = ['standard_fonts', 'cmaps', 'wasm', 'iccs'];
const pdfjsRoot = dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));

/** Serve (dev) and copy (build) pdf.js data files — fonts, CMaps, wasm decoders, ICC profiles — under /pdfjs/. */
function pdfjsAssets(): Plugin {
  let outDir = 'dist';
  return {
    name: 'pdfjs-assets',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use('/pdfjs', (req, res, next) => {
        const rel = normalize(decodeURIComponent((req.url ?? '').split('?')[0])).replace(/^[/\\]+/, '');
        const top = rel.split(/[/\\]/)[0];
        const file = join(pdfjsRoot, rel);
        if (!PDFJS_ASSET_DIRS.includes(top) || !file.startsWith(pdfjsRoot) || !existsSync(file) || !statSync(file).isFile()) {
          return next();
        }
        if (file.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm');
        createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      for (const d of PDFJS_ASSET_DIRS) cpSync(join(pdfjsRoot, d), join(outDir, 'pdfjs', d), { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), pdfjsAssets()],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
