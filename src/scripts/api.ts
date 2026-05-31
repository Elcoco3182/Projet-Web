import { Pool } from "@db/postgres";

const pool = new Pool({
  hostname: Deno.env.get("POSTGRES_HOST") ?? "db",
  port: Number(Deno.env.get("POSTGRES_PORT") ?? 5432),
  database: Deno.env.get("POSTGRES_DB"),
  user: Deno.env.get("POSTGRES_USER"),
  password: Deno.env.get("POSTGRES_PASSWORD"),
}, 3);

async function query<T>(sql: string, args?: unknown[]): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.queryObject<T>(sql, args);
    return result.rows;
  } finally {
    client.release();
  }
}

Deno.serve({ port: 8000 }, async (req) => {
  const url = new URL(req.url);

  try {
    // ==================== HEALTH ====================

    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ status: "ok" });
    }

    // ==================== USERS ====================

    // GET /users
    if (req.method === "GET" && url.pathname === "/users") {
      const users = await query("SELECT * FROM users ORDER BY id");
      return Response.json(users);
    }

    // GET /users/by-username/:username
    // Utilisé par server.ts lors du login pour récupérer le hash du mot de passe.
    // Retourne uniquement les champs nécessaires à l'authentification (pas de données sensibles superflues).
    if (
      req.method === "GET" &&
      url.pathname.match(/^\/users\/by-username\/[^/]+$/)
    ) {
      const username = decodeURIComponent(url.pathname.split("/")[3]);
      const rows = await query<
        { id: number; username: string; password_hash: string }
      >(
        "SELECT id, username, password_hash FROM users WHERE username = $1",
        [username],
      );
      if (rows.length === 0) {
        return Response.json({ error: "User not found" }, { status: 404 });
      }
      return Response.json(rows[0]);
    }

    // GET /users/:id
    if (req.method === "GET" && url.pathname.match(/^\/users\/\d+$/)) {
      const id = url.pathname.split("/")[2];
      const rows = await query("SELECT * FROM users WHERE id = $1", [id]);
      if (rows.length === 0) {
        return Response.json({ error: "User not found" }, { status: 404 });
      }
      return Response.json(rows[0]);
    }

    // POST /users/register  { username, password_hash }
    // Appelé par server.ts lors de l'inscription. Le hachage du mot de passe est
    // effectué dans server.ts ; api.ts ne reçoit et ne stocke jamais le mot de passe en clair.
    if (req.method === "POST" && url.pathname === "/users/register") {
      const body = await req.json();
      const { username, password_hash } = body;

      if (!username || typeof username !== "string") {
        return Response.json({ error: "Nom d'utilisateur invalide" }, {
          status: 400,
        });
      }
      if (!password_hash || typeof password_hash !== "string") {
        return Response.json({ error: "Hash manquant" }, { status: 400 });
      }

      // Vérifier si le username est déjà pris
      const existing = await query<{ id: number }>(
        "SELECT id FROM users WHERE username = $1",
        [username],
      );
      if (existing.length > 0) {
        return Response.json({ error: "Nom d'utilisateur déjà pris" }, {
          status: 409,
        });
      }

      const rows = await query<{ id: number; username: string }>(
        "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username",
        [username, password_hash],
      );
      return Response.json(rows[0], { status: 201 });
    }

    // POST /users  { pseudo, email }
    if (req.method === "POST" && url.pathname === "/users") {
      const { pseudo, email } = await req.json();
      if (!pseudo || typeof pseudo !== "string") {
        return Response.json({ error: "Pseudo invalide" }, { status: 400 });
      }
      if (!email || typeof email !== "string") {
        return Response.json({ error: "Email invalide" }, { status: 400 });
      }
      const rows = await query(
        "INSERT INTO users (pseudo, email) VALUES ($1, $2) RETURNING *",
        [pseudo, email],
      );
      return Response.json(rows[0], { status: 201 });
    }

    // DELETE /users/:id
    if (req.method === "DELETE" && url.pathname.match(/^\/users\/\d+$/)) {
      const id = url.pathname.split("/")[2];
      await query("DELETE FROM users WHERE id = $1", [id]);
      return Response.json({ message: "User supprimé" });
    }

    // ==================== ROLES ====================

    // GET /roles
    if (req.method === "GET" && url.pathname === "/roles") {
      const roles = await query("SELECT * FROM roles ORDER BY id");
      return Response.json(roles);
    }

    // POST /roles  { name }
    if (req.method === "POST" && url.pathname === "/roles") {
      const { name } = await req.json();
      if (!name || typeof name !== "string") {
        return Response.json({ error: "Nom invalide" }, { status: 400 });
      }
      const rows = await query(
        "INSERT INTO roles (name) VALUES ($1) RETURNING *",
        [name],
      );
      return Response.json(rows[0], { status: 201 });
    }

    // DELETE /roles/:id
    if (req.method === "DELETE" && url.pathname.match(/^\/roles\/\d+$/)) {
      const id = url.pathname.split("/")[2];
      await query("DELETE FROM roles WHERE id = $1", [id]);
      return Response.json({ message: "Role supprimé" });
    }

    // ==================== PARTIES ====================

    // GET /parties
    if (req.method === "GET" && url.pathname === "/parties") {
      const parties = await query("SELECT * FROM parties ORDER BY id");
      return Response.json(parties);
    }

    // POST /parties  (crée une nouvelle partie)
    if (req.method === "POST" && url.pathname === "/parties") {
      const rows = await query(
        "INSERT INTO parties DEFAULT VALUES RETURNING *",
      );
      return Response.json(rows[0], { status: 201 });
    }

    // PATCH /parties/:id/end  (termine une partie)
    if (req.method === "PATCH" && url.pathname.match(/^\/parties\/\d+\/end$/)) {
      const id = url.pathname.split("/")[2];
      const rows = await query(
        "UPDATE parties SET ended_at = NOW() WHERE id = $1 RETURNING *",
        [id],
      );
      if (rows.length === 0) {
        return Response.json({ error: "Partie not found" }, { status: 404 });
      }
      return Response.json(rows[0]);
    }

    // DELETE /parties/:id
    if (req.method === "DELETE" && url.pathname.match(/^\/parties\/\d+$/)) {
      const id = url.pathname.split("/")[2];
      await query("DELETE FROM parties WHERE id = $1", [id]);
      return Response.json({ message: "Partie supprimée" });
    }

    // ==================== HISTORIQUES ====================

    // GET /historiques?party_id=1  ou  /historiques?user_id=1
    if (req.method === "GET" && url.pathname === "/historiques") {
      const partyId = url.searchParams.get("party_id");
      const userId = url.searchParams.get("user_id");

      if (partyId) {
        const rows = await query(
          `SELECT h.*, u.pseudo, r.name as role_name 
                     FROM historiques h
                     JOIN users u ON h.user_id = u.id
                     JOIN roles r ON h.role_id = r.id
                     WHERE h.party_id = $1`,
          [partyId],
        );
        return Response.json(rows);
      }

      if (userId) {
        const rows = await query(
          `SELECT h.*, p.started_at, r.name as role_name 
                     FROM historiques h
                     JOIN parties p ON h.party_id = p.id
                     JOIN roles r ON h.role_id = r.id
                     WHERE h.user_id = $1`,
          [userId],
        );
        return Response.json(rows);
      }

      const rows = await query("SELECT * FROM historiques ORDER BY id");
      return Response.json(rows);
    }

    // POST /historiques  { user_id, party_id, role_id }
    if (req.method === "POST" && url.pathname === "/historiques") {
      const { user_id, party_id, role_id } = await req.json();
      if (!user_id || !party_id || !role_id) {
        return Response.json({ error: "Champs manquants" }, { status: 400 });
      }
      const rows = await query(
        "INSERT INTO historiques (user_id, party_id, role_id) VALUES ($1, $2, $3) RETURNING *",
        [user_id, party_id, role_id],
      );
      return Response.json(rows[0], { status: 201 });
    }

    // ==================== REFRESH TOKENS ====================
    // 3 routes sont appelées par routes.ts (back).
    // Elles ne sont jamais accessibles depuis le navigateur (api sur réseau interne Docker)

    // POST /refresh-tokens  { user_id, token_hash }
    // Appelé par routes.ts après un login ou register réussi
    // Stocke le hash SHA-256 du refresh token avec une expiration de 30 jours.
    if (req.method === "POST" && url.pathname === "/refresh-tokens") {
      const body = await req.json();
      const { user_id, token_hash } = body;

      if (!user_id || typeof user_id !== "number") {
        return Response.json({ error: "user_id invalide" }, { status: 400 });
      }
      if (!token_hash || typeof token_hash !== "string") {
        return Response.json({ error: "token_hash manquant" }, { status: 400 });
      }

      const rows = await query<{ id: number }>(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '30 days')
         RETURNING id`,
        [user_id, token_hash],
      );
      return Response.json(rows[0], { status: 201 });
    }

    // GET /refresh-tokens/:tokenHash
    // Appelé par routes.ts sur POST /refresh.
    // Vérifie que le token existe et n'est pas expiré.
    // Retourne le username associé pour générer un nouvel access token.
    if (
      req.method === "GET" &&
      url.pathname.match(/^\/refresh-tokens\/[^/]+$/)
    ) {
      const tokenHash = decodeURIComponent(url.pathname.split("/")[2]);

      const rows = await query<{ username: string }>(
        `SELECT u.username
         FROM refresh_tokens rt
         JOIN users u ON rt.user_id = u.id
         WHERE rt.token_hash = $1
           AND rt.expires_at > NOW()`,
        [tokenHash],
      );

      if (rows.length === 0) {
        // Token introuvable ou expiré
        return Response.json(
          { error: "Refresh token invalide ou expiré" },
          { status: 404 },
        );
      }
      return Response.json(rows[0]);
    }

    // DELETE /refresh-tokens/:tokenHash
    // Appelé par routes.ts sur POST /logout.
    // Supprime le token de la base
    if (
      req.method === "DELETE" &&
      url.pathname.match(/^\/refresh-tokens\/[^/]+$/)
    ) {
      const tokenHash = decodeURIComponent(url.pathname.split("/")[2]);

      await query(
        "DELETE FROM refresh_tokens WHERE token_hash = $1",
        [tokenHash],
      );
      // On retourne 200 même si le token n'existait pas — le résultat est le même
      return Response.json({ message: "Refresh token supprimé." });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  }
});
