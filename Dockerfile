FROM denoland/deno:2.2.0

WORKDIR /app

# Copier les fichiers de dépendances en premier (cache)
COPY deno.json* deno.lock* ./

# Pré-cacher les dépendances
RUN deno cache src/main.ts || true

# Copier le reste du code
COPY . .

# Exposer le port
EXPOSE 8000

# Lancer l'application
CMD ["deno", "run", "--allow-net", "--allow-env", "src/main.ts"]