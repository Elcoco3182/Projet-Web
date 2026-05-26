FROM denoland/deno:alpine-2.5.0

WORKDIR /app

COPY deno.json* deno.lock* ./

COPY . .

RUN chown -R deno:deno /app

RUN deno cache server.ts

EXPOSE 3000

USER deno

CMD ["deno", "run", "--no-lock", "--allow-net", "--allow-env", "--watch", "--allow-read=/app", "server.ts"]