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
        // GET /users
        if (req.method === "GET" && url.pathname === "/users") {
            const users = await query("SELECT * FROM users ORDER BY id");
            return Response.json(users);
        }

        // POST /users  { email: string }
        if (req.method === "POST" && url.pathname === "/users") {
            const { email } = await req.json();

            if (!email || typeof email !== "string") {
                return Response.json({ error: "Email invalide" }, { status: 400 });
            }

            const rows = await query<{ id: number; email: string }>(
                "INSERT INTO users (email) VALUES ($1) RETURNING *",
                [email],
            );
            return Response.json(rows[0], { status: 201 });
        }

        return Response.json({ error: "Not found" }, { status: 404 });

    } catch (err) {
        console.error(err);
        return Response.json({ error: "Erreur serveur" }, { status: 500 });
    }
});