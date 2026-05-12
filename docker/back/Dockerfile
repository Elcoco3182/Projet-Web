FROM denoland/deno:2.2.0

WORKDIR /app

COPY deno.json* deno.lock* ./

RUN deno cache src/scripts/back.ts

COPY . .

EXPOSE 3000

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "src/scripts/back.ts"]