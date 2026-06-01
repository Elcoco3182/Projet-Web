# Stage 1 : cache des dépendances
FROM denoland/deno:alpine-2.5.0 AS builder

WORKDIR /app
ENV DENO_DIR=/tmp/deno-cache

COPY deno.json* deno.lock* ./
COPY src/ ./src/
COPY public/ ./public/

RUN deno cache src/back/server.ts \
  && chmod -R 777 /tmp/deno-cache

# Stage 2 : runtime
FROM denoland/deno:alpine-2.5.0

WORKDIR /app
ENV DENO_DIR=/tmp/deno-cache

COPY --from=builder /tmp/deno-cache /tmp/deno-cache
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public
COPY --from=builder /app/deno.json* ./
COPY --from=builder /app/deno.lock* ./

RUN chown -R deno:deno /app /tmp/deno-cache

EXPOSE 3000
USER deno

CMD ["deno", "run", "--no-lock", "--allow-net", "--allow-env", "--allow-read=/app", "src/back/server.ts"]