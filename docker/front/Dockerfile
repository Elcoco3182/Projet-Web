FROM denoland/deno:alpine-2.5.0

WORKDIR /app

COPY . .

RUN deno cache src/scripts/front.ts

EXPOSE 8080

USER deno

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read=./public,./deno.json", "src/scripts/front.ts"]