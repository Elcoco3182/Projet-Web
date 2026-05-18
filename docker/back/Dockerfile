FROM denoland/deno:alpine-2.5.0

WORKDIR /app

COPY deno.json* deno.lock* ./

RUN deno cache src/scripts/back.ts || true

COPY . .

EXPOSE 3000

USER deno

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read=./deno.json", "server.ts"]