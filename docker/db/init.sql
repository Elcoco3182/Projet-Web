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

-- Données initiales
INSERT INTO users
VALUES (1, 'coco', '$2a$12$ZDAQgOpU7bQiTzPLSQZp7u.jvRpPHEXZ/mTRFiDXXHKPDdFLIEN.C'),  -- Hash de 'pasdemail'
       (2, 'personne', 'toujourspasdemail@gmail.com');

INSERT INTO roles
VALUES (1, 'innocent'),
       (2, 'assassin'),
       (3, 'petiteFille');

-- Index sur username pour accélérer les lookups au login
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);