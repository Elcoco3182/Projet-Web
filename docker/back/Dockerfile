FROM denoland/deno:2.5.0

WORKDIR /app

COPY deno.json* deno.lock* ./

RUN deno cache server.ts

COPY . .

EXPOSE 8080

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "server.ts"]