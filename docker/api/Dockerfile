FROM denoland/deno:2.5.0

WORKDIR /app

COPY . .

RUN deno cache src/scripts/api.ts

EXPOSE 8000

USER deno

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read=./deno.json", "src/scripts/api.ts"]