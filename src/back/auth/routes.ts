import { Router, send } from "@oak/oak";
import { create, verify } from "@zaubrik/djwt";
import bcrypt from "@bcryptjs";
import { POIVRE, secretKey } from "../config.ts";
import { API_URL, fetchWithRetry } from "../utils/fetch.ts";
import { validatePassword, validateUsername } from "./validation.ts";
import {
  clearAuthCookie,
  clearRefreshTokenCookie,
  getRefreshTokenFromCookie,
  getTokenFromCookie,
  hashToken,
  isRateLimited,
  requireAuth,
  setAuthCookie,
  setRefreshTokenCookie,
} from "./middleware.ts";

export const authRouter = new Router();

// ── Helper : génère un refresh token brut aléatoire ──────────────────────────

function generateRawRefreshToken(): string {
  return crypto.randomUUID() + crypto.randomUUID();
}

// ── Helper : stocke le refresh token hashé en base via l'API ─────────────────
async function storeRefreshToken(
  userId: number,
  rawToken: string,
): Promise<void> {
  const tokenHash = await hashToken(rawToken);
  await fetchWithRetry(`${API_URL}/refresh-tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userId,
      token_hash: tokenHash,
    }),
  });
}

// ── POST /register ────────────────────────────────────────────────────────────
authRouter.post("/register", async (ctx) => {
  let body: { username?: string; password?: string };
  try {
    body = await ctx.request.body.json();
  } catch {
    ctx.response.status = 400;
    ctx.response.body = { error: "Corps de requête JSON invalide." };
    return;
  }

  const username = (body.username ?? "").trim();
  const password = body.password ?? "";

  const usernameError = validateUsername(username);
  if (usernameError) {
    ctx.response.status = 400;
    ctx.response.body = { error: usernameError };
    return;
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    ctx.response.status = 400;
    ctx.response.body = { error: passwordError };
    return;
  }

  const salt = await bcrypt.genSalt(12);
  const password_hash = await bcrypt.hash(password + POIVRE, salt);

  let res: Response;
  try {
    res = await fetchWithRetry(`${API_URL}/users/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password_hash }),
    });
  } catch {
    ctx.response.status = 503;
    ctx.response.body = { error: "Service indisponible, réessayez plus tard." };
    return;
  }

  if (res.status === 409) {
    ctx.response.status = 409;
    ctx.response.body = { error: "Ce nom d'utilisateur est déjà pris." };
    return;
  }
  if (!res.ok) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Erreur lors de la création du compte." };
    return;
  }

  // Récupérer l'id du nouvel utilisateur pour lier le refresh token
  const newUser = await res.json() as { id: number; username: string };

  // Access token (15 min)
  const token = await create(
    { alg: "HS512", typ: "JWT" },
    { username },
    secretKey,
  );
  setAuthCookie(ctx, token);

  // rajout Refresh token (30 jours) — généré, stocké hashé en base, posé en cookie
  const rawRefreshToken = generateRawRefreshToken();
  await storeRefreshToken(newUser.id, rawRefreshToken);
  setRefreshTokenCookie(ctx, rawRefreshToken);

  ctx.response.status = 201;
  ctx.response.body = { message: "Compte créé avec succès.", username };
});

// ── POST /login ───────────────────────────────────────────────────────────────
authRouter.post("/login", async (ctx) => {
  const ip = ctx.request.ip;
  if (isRateLimited(ip)) {
    ctx.response.status = 429;
    ctx.response.body = {
      error: "Trop de tentatives. Réessayez dans une minute.",
    };
    return;
  }

  let body: { username?: string; password?: string };
  try {
    body = await ctx.request.body.json();
  } catch {
    ctx.response.status = 400;
    ctx.response.body = { error: "Corps de requête JSON invalide." };
    return;
  }

  const username = (body.username ?? "").trim();
  const password = body.password ?? "";

  if (!username || !password) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Nom d'utilisateur et mot de passe requis." };
    return;
  }

  let userRes: Response | null = null;
  try {
    userRes = await fetchWithRetry(
      `${API_URL}/users/by-username/${encodeURIComponent(username)}`,
    );
  } catch {
    /* L'API est down — on continue avec un hash invalide pour éviter le timing attack */
  }

  let hashToCheck = "$2a$12$invalide.hash.pour.eviter.timing.attaque";
  let fetchedUsername: string | null = null;
  let fetchedUserId: number | null = null;

  if (userRes?.ok) {
    const userData = await userRes.json() as {
      id: number;
      username: string;
      password_hash: string;
    };
    hashToCheck = userData.password_hash;
    fetchedUsername = userData.username;
    fetchedUserId = userData.id;
  }

  const valid = await bcrypt.compare(password + POIVRE, hashToCheck);

  if (!fetchedUsername || !valid) {
    ctx.response.status = 401;
    ctx.response.body = {
      error: "Nom d'utilisateur ou mot de passe incorrect.",
    };
    return;
  }

  // Access token (15 min)
  const token = await create({ alg: "HS512", typ: "JWT" }, {
    username: fetchedUsername,
  }, secretKey);
  setAuthCookie(ctx, token);

  // rjout du refresh token (30 jours)
  const rawRefreshToken = generateRawRefreshToken();
  await storeRefreshToken(fetchedUserId!, rawRefreshToken);
  setRefreshTokenCookie(ctx, rawRefreshToken);

  ctx.response.status = 200;
  ctx.response.body = {
    message: "Connexion réussie.",
    username: fetchedUsername,
  };
});

// ── POST /refresh ─────────────────────────────────────────────────────────────
// Appelé automatiquement par le navigateur quand l'access token expire (15 min).
// Vérifie le refresh token en base → génère un nouvel access token.
authRouter.post("/refresh", async (ctx) => {
  const rawToken = getRefreshTokenFromCookie(ctx);

  if (!rawToken) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Session expirée. Reconnectez-vous." };
    return;
  }

  // Hasher le token reçu pour chercher en base
  const tokenHash = await hashToken(rawToken);

  let tokenRes: Response | null = null;
  try {
    tokenRes = await fetchWithRetry(
      `${API_URL}/refresh-tokens/${encodeURIComponent(tokenHash)}`,
    );
  } catch {
    ctx.response.status = 503;
    ctx.response.body = { error: "Service indisponible." };
    return;
  }

  if (!tokenRes?.ok) {
    // Token introuvable ou expiré → forcer la reconnexion
    clearAuthCookie(ctx);
    clearRefreshTokenCookie(ctx);
    ctx.response.status = 401;
    ctx.response.body = { error: "Session expirée. Reconnectez-vous." };
    return;
  }

  const tokenData = await tokenRes.json() as { username: string };

  // Nouveau access token (15 min)
  const newAccessToken = await create(
    { alg: "HS512", typ: "JWT" },
    { username: tokenData.username },
    secretKey,
  );
  setAuthCookie(ctx, newAccessToken);

  ctx.response.status = 200;
  ctx.response.body = { message: "Token renouvelé." };
});

// ── POST /logout ──────────────────────────────────────────────────────────────
authRouter.post("/logout", async (ctx) => {
  const rawToken = getRefreshTokenFromCookie(ctx);

  // MODIFIÉ : on supprime le refresh token de la base avant de vider les cookies
  // Sinon le token reste valide en base même si les cookies supprimé
  if (rawToken) {
    const tokenHash = await hashToken(rawToken);
    try {
      await fetchWithRetry(
        `${API_URL}/refresh-tokens/${encodeURIComponent(tokenHash)}`,
        { method: "DELETE" },
      );
    } catch {
      // On continue même si l'API est down — les cookies seront quand même supprimés
      console.warn(
        "Logout : impossible de supprimer le refresh token en base.",
      );
    }
  }

  clearAuthCookie(ctx);
  clearRefreshTokenCookie(ctx); // AJOUTÉ
  ctx.response.status = 200;
  ctx.response.body = { message: "Déconnexion réussie." };
});

// ── GET /verify ───────────────────────────────────────────────────────────────
authRouter.get("/verify", async (ctx) => {
  const token = getTokenFromCookie(ctx);
  if (!token) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Non authentifié." };
    return;
  }
  try {
    const payload = await verify(token, secretKey);
    ctx.response.status = 200;
    ctx.response.body = { username: payload.username };
  } catch {
    clearAuthCookie(ctx);
    ctx.response.status = 401;
    ctx.response.body = { error: "Token invalide ou expiré." };
  }
});

// ── Fichiers statiques publics ────────────────────────────────────────────────
authRouter.get("/login.html", async (ctx) => {
  await send(ctx, "login.html", { root: "./public" });
});
authRouter.get("/login.css", async (ctx) => {
  await send(ctx, "login.css", { root: "./public" });
});
authRouter.get("/login.js", async (ctx) => {
  await send(ctx, "login.js", { root: "./public" });
});

// ── Routes protégées ──────────────────────────────────────────────────────────
authRouter.get("/", requireAuth, async (ctx) => {
  await send(ctx, "index.html", { root: "./public" });
});
authRouter.get("/index.html", requireAuth, async (ctx) => {
  await send(ctx, "index.html", { root: "./public" });
});
