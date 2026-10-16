-- Add the session revocation counter for long-lived ("remember me") sessions.
-- Sessions carry the auth_epoch they were issued with; bumping a user's epoch
-- (e.g. on password change) invalidates every outstanding session cookie.
-- Idempotent: safe to run on a database that already has the column.

SET @has_auth_epoch = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'auth_epoch'
);
SET @add_auth_epoch = IF(
    @has_auth_epoch = 0,
    'ALTER TABLE users ADD COLUMN auth_epoch INT NOT NULL DEFAULT 0',
    'SELECT 1'
);
PREPARE stmt FROM @add_auth_epoch;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
