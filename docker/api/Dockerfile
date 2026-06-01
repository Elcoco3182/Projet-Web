# Stage 1 : cache des dépendances
FROM denoland/deno:alpine-2.5.0 AS builder

WORKDIR /app
ENV DENO_DIR=/tmp/deno-cache

COPY deno.json* deno.lock* ./
COPY src/scripts/api.ts ./src/scripts/api.ts
# Copier uniquement ce dont api.ts a besoin (ses imports)
COPY src/ ./src/

RUN deno cache src/scripts/api.ts

# Stage 2 : runtime
FROM denoland/deno:alpine-2.5.0

WORKDIR /app
ENV DENO_DIR=/tmp/deno-cache

# Récupérer le cache pré-construit
COPY --from=builder /tmp/deno-cache /tmp/deno-cache
COPY --from=builder /app/src ./src
COPY --from=builder /app/deno.json* ./
COPY --from=builder /app/deno.lock* ./

EXPOSE 8000
USER deno

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "src/scripts/api.ts"]