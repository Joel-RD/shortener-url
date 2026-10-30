-- ============================================
-- SCHEMA COMPLETO: URL SHORTENER
-- ============================================

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT COLLATE NOCASE UNIQUE NOT NULL,
    email TEXT COLLATE NOCASE UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    last_name TEXT,
    email_verified BOOLEAN DEFAULT 0,
    account_active BOOLEAN DEFAULT 1,
    email_attempt_count INTEGER DEFAULT 0,
    email_blocked_until DATETIME,
    password_attempt_count INTEGER DEFAULT 0,
    password_blocked_until DATETIME,
    subscription_tier TEXT DEFAULT 'free' CHECK(subscription_tier IN ('free', 'pro', 'premium')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de URLs acortadas
CREATE TABLE IF NOT EXISTS urls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    original_url TEXT NOT NULL,
    short_url TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    views INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabla de códigos de verificación
-- `code` no es UNIQUE: dos emails distintos podrían generar el mismo código
-- y el upsert se resuelve por `email`.
CREATE TABLE IF NOT EXISTS verification_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    email TEXT UNIQUE,
    code TEXT,
    attempt_count INTEGER DEFAULT 0,
    blocked_until DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME DEFAULT (DATETIME('now', '+10 minutes')),
    used BOOLEAN DEFAULT 0,
    used_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- ÍNDICES PARA MEJOR RENDIMIENTO
-- ============================================

-- Índices para tabla urls
CREATE INDEX IF NOT EXISTS idx_urls_user_id ON urls(user_id);
CREATE INDEX IF NOT EXISTS idx_urls_short_url ON urls(short_url);
CREATE INDEX IF NOT EXISTS idx_urls_created_at ON urls(created_at);
CREATE INDEX IF NOT EXISTS idx_urls_is_active ON urls(is_active);

-- Índices para tabla verification_codes
CREATE INDEX IF NOT EXISTS idx_verification_email ON verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_verification_expires ON verification_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_verification_used ON verification_codes(used);

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger 1: Eliminar códigos de verificación expirados
CREATE TRIGGER IF NOT EXISTS delete_expired_verification_codes
AFTER INSERT ON verification_codes
BEGIN
    DELETE FROM verification_codes
    WHERE expires_at < DATETIME('now')
    AND used = 0;
END;

-- Trigger 2: Eliminar códigos de verificación que han sido usados
CREATE TRIGGER IF NOT EXISTS delete_used_verification_codes
AFTER UPDATE ON verification_codes
WHEN NEW.used = 1
BEGIN
    DELETE FROM verification_codes
    WHERE id = NEW.id;
END;

-- Trigger 3: Mantener updated_at al día
CREATE TRIGGER IF NOT EXISTS update_users_updated_at
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
