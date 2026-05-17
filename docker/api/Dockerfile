FROM denoland/deno:2.2.0

WORKDIR /app

# ── Étape 1 : cache des dépendances ──────────────────────────────────────────
# Copier uniquement api.ts en premier pour que Docker mette en cache
# les dépendances. Si seul le code change (pas les imports), cette
# couche n'est pas reconstruite → builds beaucoup plus rapides.
COPY deno.json* deno.lock* ./
COPY src/scripts/api.ts ./src/scripts/api.ts
RUN deno cache src/scripts/api.ts

# ── Étape 2 : copier le reste du code source ─────────────────────────────────
COPY src/ ./src/

# ── Sécurité : ne pas tourner en root ────────────────────────────────────────
USER deno

EXPOSE 3000

# Permissions minimales nécessaires :
# --allow-net : connexions HTTP entrantes + connexion PostgreSQL sortante
# --allow-env : lecture des variables d'environnement (JWT_SECRET, POSTGRES_*, etc.)
CMD ["deno", "run", "--allow-net", "--allow-env", "src/scripts/api.ts"]