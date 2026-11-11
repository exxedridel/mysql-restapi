export const SESSION_REVOCATION_MIGRATION = "20261110_session_revocations_v1";

// Initialization holds the existing advisory lock and completes before listen().
export async function migrateSessionRevocations(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS revoked_tokens (
      token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
      expires_at BIGINT UNSIGNED NOT NULL,
      INDEX revoked_tokens_expiration (expires_at)
    ) ENGINE=InnoDB
  `);
  await connection.query("DELETE FROM revoked_tokens WHERE expires_at <= UNIX_TIMESTAMP()");
  await connection.query(
    "INSERT IGNORE INTO schema_migrations (name) VALUES (?)",
    [SESSION_REVOCATION_MIGRATION],
  );
}
