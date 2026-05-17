FROM postgres:16-alpine

#ENV POSTGRES_DB=${POSTGRES_DB}
#ENV POSTGRES_USER=${POSTGRES_USER}
#ENV POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

#COPY ./init/ /docker-entrypoint-initdb.d/

COPY docker/db/init.sql /docker-entrypoint-initdb.d/init.sql

EXPOSE 5432

