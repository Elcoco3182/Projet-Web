FROM denoland/deno:2.5.0

WORKDIR /app

COPY deno.json* deno.lock* ./

RUN deno cache src/scripts/api.ts

COPY . .

EXPOSE 8000

CMD ["deno", "run", "--allow-net", "--allow-env", "src/scripts/api.ts"]