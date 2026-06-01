# Stage 1 : cache des dépendances
FROM denoland/deno:alpine-2.5.0 AS builder

WORKDIR /app
ENV DENO_DIR=/tmp/deno-cache

COPY deno.json* deno.lock* ./
COPY src/ ./src/
COPY public/ ./public/

RUN deno cache src/scripts/front.ts

# Stage 2 : runtime
FROM denoland/deno:alpine-2.5.0

WORKDIR /app
ENV DENO_DIR=/tmp/deno-cache

COPY --from=builder /tmp/deno-cache /tmp/deno-cache
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public
COPY --from=builder /app/deno.json* ./
COPY --from=builder /app/deno.lock* ./

EXPOSE 8080
USER deno

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "src/scripts/front.ts"]