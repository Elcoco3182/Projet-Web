FROM denoland/deno:2.2.0

WORKDIR /app

# ── Étape 1 : cache des dépendances ──────────────────────────────────────────
COPY deno.json* deno.lock* ./
COPY src/scripts/back.ts ./src/scripts/back.ts
RUN deno cache src/scripts/back.ts

# ── Étape 2 : copier le code source et les fichiers statiques ────────────────
COPY src/ ./src/

# public/ contient login.html, login.js, login.css, index.html, client.js...
# Il doit être copié car back.ts le sert depuis ../../public relatif à src/scripts/
COPY public/ ./public/

# ── Sécurité : ne pas tourner en root ────────────────────────────────────────
USER deno

EXPOSE 8080

# Permissions minimales nécessaires :
# --allow-net          : écouter les connexions HTTP entrantes
# --allow-env          : lire FRONT_PORT depuis l'environnement
# --allow-read=./public : accès en lecture limité aux fichiers statiques uniquement
#                        (pas accès à tout le système de fichiers)
CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read=./public", "src/scripts/back.ts"]