// src/back/game/lobbyRoutes.ts
import { Router } from "@oak/oak";
import bcrypt from "@bcryptjs";
import { lobbyManager } from "./lobby.ts";
import { requireAuthJson } from "../auth/middleware.ts";
import { validateLobbyName, validateLobbyPassword } from "../auth/validation.ts";

export const lobbyRouter = new Router();

// ── POST /lobbies : créer un lobby ──────────────────────────────────────────
lobbyRouter.post("/lobbies", requireAuthJson, async (ctx) => {
  let body: { name?: string; password?: string };

  try {
    body = await ctx.request.body.json();
  } catch {
    ctx.response.status = 400;
    ctx.response.body = {
      error: "Corps de requête JSON invalide.",
    };
    return;
  }

  const name = (body.name ?? "").trim();
  const password = body.password ?? "";

  const nameError = validateLobbyName(name);

  if (nameError) {
    ctx.response.status = 400;
    ctx.response.body = {
      error: nameError,
    };
    return;
  }

  let passwordHash: string | null = null;

  if (password) {
    const passwordError = validateLobbyPassword(password);

    if (passwordError) {
      ctx.response.status = 400;
      ctx.response.body = {
        error: passwordError,
      };
      return;
    }

    const salt = await bcrypt.genSalt(10);
    passwordHash = await bcrypt.hash(password, salt);
  }

  const lobby = lobbyManager.createLobby(name, passwordHash);

  ctx.response.status = 201;
  ctx.response.body = {
    id: lobby.id,
    name: lobby.name,
    isPrivate: !!lobby.passwordHash,
  };
});


// ── GET /lobbies?search= : lister les lobbies publics ───────────────────────
lobbyRouter.get("/lobbies", requireAuthJson, (ctx) => {
  const search = ctx.request.url.searchParams.get("search") ?? "";

  ctx.response.status = 200;
  ctx.response.body = lobbyManager.listPublicLobbies(search);
});


// ── GET /lobbies/:id : vérifier l'existence du lobby ───────────────────────
lobbyRouter.get("/lobbies/:id", requireAuthJson, (ctx) => {
  const info = lobbyManager.findSummary(ctx.params.id ?? "");

  if (!info) {
    ctx.response.status = 404;
    ctx.response.body = {
      error: "Lobby introuvable.",
    };
    return;
  }

  ctx.response.status = 200;
  ctx.response.body = info;
});


// ── POST /lobbies/:id/check-password ────────────────────────────────────────
lobbyRouter.post(
    "/lobbies/:id/check-password",
    requireAuthJson,
    async (ctx) => {
      const lobbyId = ctx.params.id ?? "";

      const lobby = lobbyManager.getLobby(lobbyId);

      // Le lobby n'existe pas
      if (!lobby) {
        ctx.response.status = 404;
        ctx.response.body = {
          error: "Ce lobby n'existe pas.",
        };
        return;
      }

      // Lobby public
      if (!lobby.passwordHash) {
        ctx.response.status = 200;
        ctx.response.body = {
          ok: true,
        };
        return;
      }

      let body: { password?: string };

      try {
        body = await ctx.request.body.json();
      } catch {
        ctx.response.status = 400;
        ctx.response.body = {
          error: "Corps de requête JSON invalide.",
        };
        return;
      }

      const password = body.password ?? "";

      // Pas de mot de passe
      if (!password) {
        ctx.response.status = 400;
        ctx.response.body = {
          error: "Ce lobby est privé, entre le mot de passe.",
        };
        return;
      }

      // Comparaison avec le hash enregistré
      const valid = await bcrypt.compare(
          password,
          lobby.passwordHash,
      );

      if (!valid) {
        ctx.response.status = 401;
        ctx.response.body = {
          error: "Le mot de passe rentré n'est pas valide.",
        };
        return;
      }

      ctx.response.status = 200;
      ctx.response.body = {
        ok: true,
      };
    },
);