FROM denoland/deno:alpine-2.5.0

WORKDIR /app

COPY . .

ENV DENO_DIR=/tmp/deno-cache

RUN deno cache src/scripts/api.ts

EXPOSE 8000

USER deno

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "src/scripts/api.ts"]