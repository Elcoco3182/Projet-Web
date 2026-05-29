import { Application, Router } from "@oak/oak";
import { oakCors } from "@deno.land/x/cors";
import { PORT } from "./config.ts";
import { authRouter } from "./auth/routes.ts";
import { wsRouter } from "./game/websocket.ts";

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
  console.log(
    `${ctx.request.method} ${ctx.request.url.pathname} → ${ctx.response.status}`,
  );
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use(healthRouter.routes());
app.use(healthRouter.allowedMethods());
app.use(wsRouter.routes());
app.use(wsRouter.allowedMethods());
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
