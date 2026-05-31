CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(30) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE roles
(
    id   SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE parties
(
    id         SERIAL PRIMARY KEY,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at   TIMESTAMPTZ
);

CREATE TABLE historiques
(
    id        SERIAL PRIMARY KEY,
    user_id   INT REFERENCES users (id) ON DELETE CASCADE,
    party_id  INT REFERENCES parties (id) ON DELETE CASCADE,
    role_id   INT REFERENCES roles (id) ON DELETE SET NULL
);

-- On ne stocke jamais le token brut — uniquement son hash SHA-256
-- Si quelqu'un vole la base, les tokens sont inutilisables sans les valeurs brutes
-- ON DELETE CASCADE : si l'utilisateur est supprimé, ses tokens le sont aussi automatiquement
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,        -- hash SHA-256 du token brut
    expires_at TIMESTAMPTZ NOT NULL,        -- expiration dans 30 jours
    created_at TIMESTAMPTZ DEFAULT NOW()
);
 
-- Index pour accélérer la recherche par hash (appelée à chaque /refresh)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash
    ON refresh_tokens(token_hash);
 
-- Index pour retrouver tous les tokens d'un utilisateur (ex: logout global)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
    ON refresh_tokens(user_id);


-- Données initiales
INSERT INTO users
VALUES (1, 'coco', '$2a$12$7PwUKc5RkMuPGaXlbpqxc.2gE1JbljcjvpsOmYkhQvlAYBGgdvfCC'),  -- Hash de 'pasdemail + mon poivre (coco)'
       (2, 'personne', '$2a$12$ZDAQgOpU7bQiTzPLSQZp7u.jvRpPHEXZ/mTRFiDXXHKPDdFLIEN.C');

INSERT INTO roles
VALUES (1, 'innocent'),
       (2, 'assassin'),
       (3, 'petitefille'),
       (4, 'loupgarou'),
       (5, 'necrophage'),
       (6, 'parfumeuse'),
       (7, 'cuisiniere'),
       (8, 'cultise'),
       (9, 'fou'),
       (10, 'garde'),
       (11, 'vampire'),
       (12, 'petitfouineur'),
       (13, 'solitaire'),
       (14, 'macavecunfusil');

-- Index sur username pour accélérer les lookups au login
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);