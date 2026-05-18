-- Schéma de la base de données du user
-- Ce fichier est exécuté automatiquement au premier démarrage du conteneur PostgreSQL

CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(30) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMP DEFAULT NOW()
);

-- Index sur username pour accélérer les lookups au login
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);