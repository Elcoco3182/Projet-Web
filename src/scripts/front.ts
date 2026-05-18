
/**
 * front_server.ts — Serveur de fichiers statiques
 *
 * Responsabilité unique : servir les fichiers HTML/CSS/JS du dossier public/.

 * Structure attendue :
 *   public/
 *     login.html   ← page d'authentification (page d'accueil)
 *     login.js
 *     login.css
 *     index.html   ← jeu (redirigé après login)
 *     client.js
 *     style.css
 */

import { Application } from "https://deno.land/x/oak@v17.1.6/mod.ts";
import * as path       from "https://deno.land/std@0.188.0/path/mod.ts";

const PORT      = parseInt(Deno.env.get("FRONT_PORT") ?? "8080");
//const __dirname = path.dirname(path.fromFileUrl(import.meta.url));
const PUBLIC    = path.join(Deno.cwd(), "public");

const app = new Application();

app.use(async (ctx) => {
  try {
    await ctx.send({
      root:  PUBLIC,
      index: "login.html", // Page d'accueil = login
    });
  } catch {
    ctx.response.status = 404;
    ctx.response.body   = "404 — Page introuvable";
  }
});

console.log(`Serveur front démarré sur le port ${PORT} (racine : ${PUBLIC})`);
await app.listen({ port: PORT });