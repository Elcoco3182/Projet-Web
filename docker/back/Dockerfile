FROM denoland/deno:alpine-2.5.0

WORKDIR /app

RUN chown -R deno:deno /app

COPY deno.json* deno.lock* ./

RUN deno cache server.ts || true

COPY . .

EXPOSE 3000

USER deno

CMD ["deno", "run", "--allow-net", "--allow-env", "--watch", "--allow-read=./deno.json", "server.ts"]