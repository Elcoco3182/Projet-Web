FROM denoland/deno:alpine-2.5.0

WORKDIR /app

COPY deno.json* deno.lock* ./

RUN deno cache server.ts || true

COPY . .

EXPOSE 3000

USER deno

CMD ["deno", "run", "--no-lock", "--allow-net", "--allow-env", "--allow-read", "server.ts"]