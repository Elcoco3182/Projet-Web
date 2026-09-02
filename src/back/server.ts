import { Application, Router } from "@oak/oak";
import { oakCors } from "@deno.land/x/cors";
import { PORT } from "./config.ts";
import { authRouter } from "./auth/routes.ts";
import { wsRouter } from "./game/websocket.ts";
import { lobbyRouter } from "./game/lobbyRoutes.ts";

const app = new Application();

// ── Healthcheck ───────────────────────────────────────────────────────────────
const healthRouter = new Router();
healthRouter.get("/health", (ctx) => {
  ctx.response.status = 200;
  ctx.response.body = "ok";
});

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",");
app.use(oakCors({
  origin: (requestOrigin) => {
    if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
      return requestOrigin || "*";
    }
    return false;
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// ── Logger ────────────────────────────────────────────────────────────────────
app.use(async (ctx, next) => {
  await next();
  ctx.response.headers.set("X-Content-Type-Options", "nosniff"); // Empêche les attaques par uploads de fichier txt
  ctx.response.headers.set("X-Frame-Options", "DENY"); // Empêche d'être chargé dans une <iframe> sur un autre site
  ctx.response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains",
  ); // Force le navigateur à toujours utiliser HTTPS
  ctx.response.headers.set("Content-Security-Policy", "default-src 'self'"); // Définit d'où peuvent venir les ressources chargées par la page
  console.log(
    `${ctx.request.method} ${ctx.request.url.pathname} → ${ctx.response.status}`,
  );
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use(healthRouter.routes());
app.use(healthRouter.allowedMethods());
app.use(wsRouter.routes());
app.use(wsRouter.allowedMethods());
app.use(lobbyRouter.routes());
app.use(lobbyRouter.allowedMethods());
app.use(authRouter.routes());
app.use(authRouter.allowedMethods());

// ── Démarrage ─────────────────────────────────────────────────────────────────
console.log(`Server listening on port ${PORT}`);
await app.listen({
  port: PORT,
  secure: true,
  cert: await Deno.readTextFile("./certs/localhost+2.pem"),
  key: await Deno.readTextFile("./certs/localhost+2-key.pem"),
});
