# Projet Web

![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)
![Postgres](https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Deno JS](https://img.shields.io/badge/deno%20js-000000?style=for-the-badge&logo=deno&logoColor=white)
![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/css-%23663399.svg?style=for-the-badge&logo=css&logoColor=white)

## Présentation

Un mélange du loups-garou de thiercelieux et Among Us sur le thème de Polytech.

Vous êtes restés tard dans le bâtiment de Polytech. Mais maintenant, vous êtes bloqués à l'intérieur.\
Êtes-vous de sûr de pouvoir faire confiance à vos camarades ?


## Accès

Vous pouvez y jouer en vous connectant au réseau Polytech ou alors avec le VPN de Polytech. (Tant que la VM est actif)\
Ensuite, connectez-vous alors à https://162.38.111.34:8080 (Il faut faire confiance).
Si vous utilisez firefox, il faudra aussi faire confiance à https://162.38.111.34:3000.


## Architecture et Sécurité

Front : HTML/CSS/JS\
Back : deno + websocket + TypeScript\
BDD : PostgreSQL\
Deploiement : Docker Compose\
Sécurité : HTTPS, CORS, Password hash sel et poivre, Cookies sécurisé, Access
Token

## Fonctionnalité

### Gameplay

Le jeu se déroule en plusieurs journées divisées en 6 moments :

- Le matin, après une nuit bien mouvementée
- Le midi, le moment des votes et discutions entre joueurs
- L'après-midi, pour parler après le vote
- Le soir, le moment de partir se cacher ou de se préparer à tuer
- Minuit, les loups et autres criminels passent à l'action
- L'Aube, c'est au tour des rôles safes d'utilisés leurs pouvoirs (s'ils en ont)

### Rôles

Il y a pour l'instant 4 roles, mais bien d'autres arriveront dans le futur :

- L'innocent, le villageois classique avec que ses jambes pour courir
- l'assassin, prêt à tuer et trahir tout le monde le moment venu
- la petite fille, elle a une très grande vision capable de repérer les
  assassins
- la parfumeuse, elle parfume les gens la journée pour les repérer la nuit

### Carte

Il n'y a qu'une seule carte pour l'instant, celle du rez-de-chaussé du bâtiment
Polytech.

### Stockage des données

Toutes les données utiles sont stockés sur 5 tables de données :

```
+--------------------------------+          +----------------------+
|            USERS               |          |        ROLES         |
+--------------------------------+          +----------------------+
| PK  id            SERIAL       |          | PK  id    SERIAL     |
|     username      VARCHAR(30)  |          |     name  TEXT       |
|     password_hash TEXT         |          +----------------------+
|     created_at    TIMESTAMP    |                     ^
|     admin         BOOLEAN      |                     |
+--------------------------------+                     |
         ^                ^                            |
         |                |               +------------+-----------+
         |                |               |       HISTORIQUES      |
         |                |               +------------------------+
         |                |               | PK  id        SERIAL   |
         |                +-------------->| FK  user_id   INT      |
         |                                | FK  party_id  INT      |
         |                                | FK  role_id   INT      |
         |                                +------------------------+
         |                                            ^
         |                               +------------+
         |                               |
         |                    +----------------------------+
         |                    |       PARTIES              |
         |                    +----------------------------+
         |                    | PK  id         SERIAL      |
         |                    |     started_at TIMESTAMPTZ |
         |                    |     ended_at   TIMESTAMPTZ |
         |                    +----------------------------+
         |
+------------------------------------+
|          REFRESH_TOKENS            |
+------------------------------------+
| PK  id         SERIAL              |
| FK  user_id    INTEGER   NOT NULL  |
|     token_hash TEXT      UNIQUE    |
|     expires_at TIMESTAMPTZ         |
|     created_at TIMESTAMPTZ         |
+------------------------------------+
```

### CI/CD

Nous avons décidé de faire totalement la partie CI/CD pour pouvoir deploy
directement le site web sur la VM de Corentin. Ainsi, tout le monde peut s'y
connecter :

1. Se connecter au wifi de Polytech
2. Aller sur https://162.38.111.34:8080 (ne marche pas sur certain navigateur
   comme firefox)
3. Se connecter ou s'inscrire
4. S'amuser (si le serveur n'est pas en maintenance)

Voici notre pipeline complète (le build et le deploy ne se font que sur le
main).\
En plus de ce qui été demandé, on a rajouté un test : sast qui permet de
vérifier des problèmes de sécurités dans notre code, ce qui est un critère très
important pour nous.

```
┌─────────────┐     ┌──────────────────┐     ┌───────────────────┐     ┌─────────────┐
│     LINT    │     │       TEST       │     │       BUILD       │     │   DEPLOY    │
├─────────────┤     ├──────────────────┤     ├───────────────────┤     ├─────────────┤
│  lint       │────▶│  semgrep-sast    │────▶│   build-api       │────▶│   deploy    │
└─────────────┘     │  test            │     │   build-back      │     └─────────────┘
                    └──────────────────┘     │   build-db        │
                                             │   build-front     │
                                             └───────────────────┘
```

## Structure

```
Prjet-Web/
│   .dockerignore
│   .env
│   .gitignore
│   .gitlab-ci.yml
│   .pre-commit-config.yaml
│   deno.json
│   deno.lock
│   docker-compose.override.yml
│   docker-compose.yml
│   README.md
│   
├───certs
│       localhost+2-key.pem
│       localhost+2.pem
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
│   │   index.html
│   │   login.css
│   │   login.html
│   │   style.css
│   │   
│   ├───assets
│   │   ├───images
│   │   │       assassin.png
│   │   │       innocent.png
│   │   │       Lapipizza2.png
│   │   │       mapImage.png
│   │   │       petitefille.png
│   │   │       polytech_night.jpg
│   │   │       
│   │   └───map
│   │           polytech.json
│   │           
│   └───js
│       │   login.js
│       │   scene.js
│       │   
│       └───client
│           │   client.js
│           │   
│           ├───core
│           │       collision.js
│           │       player.js
│           │       state.js
│           │       
│           ├───net
│           │       socket.js
│           │       
│           ├───render
│           │       assets.js
│           │       renderer.js
│           │       
│           └───ui
│                   input.js
│                   ui.js
│                   
├───src
│   ├───back
│   │   │   config.ts
│   │   │   server.ts
│   │   │   
│   │   ├───auth
│   │   │       middleware.ts
│   │   │       routes.ts
│   │   │       validation.ts
│   │   │       
│   │   ├───game
│   │   │       logic.ts
│   │   │       state.ts
│   │   │       websocket.ts
│   │   │       
│   │   └───utils
│   │           fetch.ts
│   │           map.ts
│   │           
│   └───scripts
│           api.ts
│           front.ts
│           
├───tests
│       auth.test.ts
│       
└───tools
        extractMap.py
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

De plus, changer dans le .env les http en https

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
