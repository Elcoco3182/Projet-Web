import { Pool } from "jsr:@db/postgres";

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

        // GET /users/:id
        if (req.method === "GET" && url.pathname.match(/^\/users\/\d+$/)) {
            const id = url.pathname.split("/")[2];
            const rows = await query("SELECT * FROM users WHERE id = $1", [id]);
            if (rows.length === 0) return Response.json({ error: "User not found" }, { status: 404 });
            return Response.json(rows[0]);
        }

        // POST /users  { pseudo, email }
        if (req.method === "POST" && url.pathname === "/users") {
            const { pseudo, email } = await req.json();
            if (!pseudo || typeof pseudo !== "string") return Response.json({ error: "Pseudo invalide" }, { status: 400 });
            if (!email || typeof email !== "string") return Response.json({ error: "Email invalide" }, { status: 400 });
            const rows = await query(
                "INSERT INTO users (pseudo, email) VALUES ($1, $2) RETURNING *",
                [pseudo, email]
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
            if (!name || typeof name !== "string") return Response.json({ error: "Nom invalide" }, { status: 400 });
            const rows = await query(
                "INSERT INTO roles (name) VALUES ($1) RETURNING *",
                [name]
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
                "INSERT INTO parties DEFAULT VALUES RETURNING *"
            );
            return Response.json(rows[0], { status: 201 });
        }

        // PATCH /parties/:id/end  (termine une partie)
        if (req.method === "PATCH" && url.pathname.match(/^\/parties\/\d+\/end$/)) {
            const id = url.pathname.split("/")[2];
            const rows = await query(
                "UPDATE parties SET ended_at = NOW() WHERE id = $1 RETURNING *",
                [id]
            );
            if (rows.length === 0) return Response.json({ error: "Partie not found" }, { status: 404 });
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
                    [partyId]
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
                    [userId]
                );
                return Response.json(rows);
            }

            const rows = await query("SELECT * FROM historiques ORDER BY id");
            return Response.json(rows);
        }

        // POST /historiques  { user_id, party_id, role_id }
        if (req.method === "POST" && url.pathname === "/historiques") {
            const { user_id, party_id, role_id } = await req.json();
            if (!user_id || !party_id || !role_id) return Response.json({ error: "Champs manquants" }, { status: 400 });
            const rows = await query(
                "INSERT INTO historiques (user_id, party_id, role_id) VALUES ($1, $2, $3) RETURNING *",
                [user_id, party_id, role_id]
            );
            return Response.json(rows[0], { status: 201 });
        }

        return Response.json({ error: "Not found" }, { status: 404 });

    } catch (err) {
        console.error(err);
        return Response.json({ error: "Erreur serveur" }, { status: 500 });
    }
});