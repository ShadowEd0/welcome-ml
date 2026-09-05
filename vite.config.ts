import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Petit plugin de build : copie le dossier "data/" (cartes, images, univers)
 * vers "dist/data/" à la fin de `vite build`.
 *
 * Pourquoi :
 *  - en mode dev, le serveur Vite sert la racine du projet -> /data/* est déjà accessible ;
 *  - en production, la racine du site est "dist/" ; sans cette copie,
 *    /data/cards.json et /data/cards_img/* n'existent pas, et le fallback SPA
 *    de Vite renvoie index.html (du HTML) à la place du JSON -> les cartes cassent.
 *
 * La structure de dist/ reflète donc celle du projet (data/cards.json,
 * data/cards_img/, data/universes/). Aucun backend requis : compatible avec
 * tout hébergement statique (GitHub Pages, Netlify, etc.).
 */
function copyDataDir(): Plugin {
  return {
    name: 'copy-data-dir',
    apply: 'build',
    closeBundle() {
      const src = resolve(process.cwd(), 'data');
      const dest = resolve(process.cwd(), 'dist', 'data');

      if (!existsSync(src)) {
        this.warn('[copy-data-dir] dossier "data/" introuvable — rien à copier.');
        return;
      }

      mkdirSync(dest, { recursive: true });
      cpSync(src, dest, { recursive: true, force: true });
      this.info('[copy-data-dir] "data/" copié vers "dist/data/".');
    },
  };
}

export default defineConfig({
  plugins: [react(), copyDataDir()],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
});