export const USER_IDENTITY_MIGRATION = "20261110_users_identity_v1";
export const INITIAL_ADMIN_EMAIL = "najerad2223@gmail.com";

// Called under the initialization advisory lock. DDL is additive and may auto-commit.
export async function migrateUserIdentity(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(100) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);
  const [tables] = await connection.query(
    "SELECT ENGINE FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'",
  );
  if (tables[0]?.ENGINE !== "InnoDB") {
    const error = new Error("La tabla users debe usar InnoDB para proteger las escrituras concurrentes.");
    error.code = "USERS_REQUIRE_INNODB";
    throw error;
  }
  const [columns] = await connection.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME IN ('role', 'token_version')",
  );
  const names = new Set(columns.map((column) => column.COLUMN_NAME));
  if (!names.has("role")) {
    await connection.query("ALTER TABLE users ADD COLUMN role ENUM('player', 'admin') NOT NULL DEFAULT 'player'");
  }
  if (!names.has("token_version")) {
    await connection.query("ALTER TABLE users ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 0");
  }
  const [applied] = await connection.query("SELECT name FROM schema_migrations WHERE name = ?", [USER_IDENTITY_MIGRATION]);
  if (applied.length > 0) return;
  await connection.beginTransaction();
  try {
    // Bootstrap once; subsequent startups preserve all roles and token versions.
    await connection.query("UPDATE users SET role = 'admin' WHERE LOWER(TRIM(email)) = ?", [INITIAL_ADMIN_EMAIL]);
    await connection.query("INSERT INTO schema_migrations (name) VALUES (?)", [USER_IDENTITY_MIGRATION]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}
