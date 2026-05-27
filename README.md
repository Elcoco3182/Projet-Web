# Projet Web

![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)
![Postgres](https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Deno JS](https://img.shields.io/badge/deno%20js-000000?style=for-the-badge&logo=deno&logoColor=white)
![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/css-%23663399.svg?style=for-the-badge&logo=css&logoColor=white)

## Présentation

Création d'un petit jeu en multijoueur de stratégie en temps réel.

## Architecture et Sécurité

Front : HTML/CSS/JS\
Back : deno + websocket + TypeScript\
BDD : PostgreSQL\
Deploiement : Docker Compose\
Sécurité : HTTPS, CORS, Password hash sel et poivre, Cookies sécurisé, Access
Token

## Structure

```
Prjet-Web/
│   .dockerignore
│   .env
│   .gitignore
│   Deno.json
│   deno.lock
│   docker-compose.yml
│   package-lock.json
│   README.md
│   server.ts
│   
├───doc
│       api doc
│       docker doc
│       git doc
│       
├───docker
│   ├───api
│   │       Dockerfile
│   │       
│   ├───back
│   │       Dockerfile
│   │       
│   ├───db
│   │       Dockerfile
│   │       init.sql
│   │       
│   └───front
│           Dockerfile
│           
├───public
│       client.js
│       index.html
│       login.html
│       login.js
│       style.css
│       
└───src
    └───scripts
            api.ts
            front.ts
```

## Initialisation

Installer mkcert et créer un faux certificat, qu'il faut mettredans le dossier
/certs\
( https://github.com/FiloSottile/mkcert/releases )

windows :

```bash
choco install mkcert
mkcert -install
mkcert localhost 127.0.0.1 ::1
```

linux :

```bash
sudo apt install mkcert
mkcert -install
mkcert localhost 127.0.0.1 ::1
```

## Pipeline CI GitLab

Le pipeline se déclenche automatiquement à chaque push. Il comprend 3 stages :

| Stage   | Job                              | Déclencheur               |
| ------- | -------------------------------- | ------------------------- |
| `lint`  | `deno fmt --check` + `deno lint` | toutes les branches       |
| `test`  | `deno test tests/`               | toutes les branches       |
| `build` | build + push des 4 images Docker | branche `main` uniquement |

### Setup initial (une seule fois)

```bash
# Installer les hooks git
# Sur linux :
pre-commit install

# Sur windows :
pip install pre-commit
```

### Workflow quotidien

```bash
# Formater avant de commit (obligatoire, vérifié par la CI)
deno fmt
```

> Le hook pre-commit lance `deno fmt --check` et `deno lint` automatiquement à
> chaque `git commit`. Si le hook bloque, corriger avec `deno fmt` puis relancer
> le commit.

### Règles

- Ne jamais committer `.env` (contient les secrets)
- Passer par une branche dédiée, merger sur `main` uniquement quand lint + test
  sont verts
- Utiliser des **bare specifiers** pour les imports Deno (définis dans
  `deno.json`) :

```ts
// ✅ Correct
import { Application } from "@oak/oak";

// ❌ À éviter
import { Application } from "jsr:@oak/oak@^17.1.4";
```

### Fins de ligne (Windows)

Sur Windows, configurer Git pour ne pas convertir les fins de ligne :

```bash
git config core.autocrlf false
```

Sans ça, `deno fmt --check` échouera en CI.

## Licence

à définir
