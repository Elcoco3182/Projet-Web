FROM denoland/deno:2.5.0

WORKDIR /app

COPY . .

RUN deno cache server.ts

EXPOSE 3000

USER deno

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read=./deno.json", "server.ts"]