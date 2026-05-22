import { Application } from "@oak/oak";
import * as path from "@std/path";

const PORT = parseInt(Deno.env.get("FRONT_PORT") ?? "8080");
//const __dirname = path.dirname(path.fromFileUrl(import.meta.url));
const PUBLIC = path.join(Deno.cwd(), "public");

const app = new Application();

app.use(async (ctx) => {
  try {
    await ctx.send({
      root: PUBLIC,
      index: "login.html", // Page d'accueil = login
    });
  } catch {
    ctx.response.status = 404;
    ctx.response.body = "404 — Page introuvable";
  }
});

console.log(`Serveur front démarré sur le port ${PORT} (racine : ${PUBLIC})`);

// ==================== HTTPS ====================

await app.listen({
  port: PORT,
  secure: true,
  cert: await Deno.readTextFile("./certs/localhost+2.pem"),
  key: await Deno.readTextFile("./certs/localhost+2-key.pem"),
});
