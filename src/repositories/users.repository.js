const columns = "id, email, password, first_name, last_name, role, token_version";

export class MysqlUsersRepository {
  constructor(database, transactionConnection = false) {
    this.database = database;
    this.transactionConnection = transactionConnection;
  }

  async findById(id) {
    const [rows] = await this.database.query(`SELECT ${columns} FROM users WHERE id = ?`, [id]);
    return rows[0] ?? null;
  }

  async findByEmail(email) {
    const [rows] = await this.database.query(`SELECT ${columns} FROM users WHERE LOWER(TRIM(email)) = ?`, [email]);
    return rows[0] ?? null;
  }

  async list() {
    const [rows] = await this.database.query(`SELECT ${columns} FROM users ORDER BY id ASC`);
    return rows;
  }

  async create(fields) {
    const [result] = await this.database.query("INSERT INTO users (email, password, first_name, last_name, role, token_version) VALUES (?, ?, ?, ?, ?, 0)", [fields.email, fields.password, fields.first_name, fields.last_name, fields.role]);
    return this.findById(result.insertId);
  }

  async update(id, fields) {
    await this.database.query("UPDATE users SET ? WHERE id = ?", [fields, id]);
    return this.findById(id);
  }

  async delete(id) {
    await this.database.query("DELETE FROM users WHERE id = ?", [id]);
  }

  async isTokenRevoked(tokenHash) {
    const [rows] = await this.database.query(
      "SELECT 1 FROM revoked_tokens WHERE token_hash = ? AND expires_at > UNIX_TIMESTAMP() LIMIT 1",
      [tokenHash],
    );
    return rows.length > 0;
  }

  async revokeToken(tokenHash, expiresAt) {
    await this.database.query("DELETE FROM revoked_tokens WHERE expires_at <= UNIX_TIMESTAMP()");
    const expiration = Math.ceil(expiresAt);
    await this.database.query(
      "INSERT INTO revoked_tokens (token_hash, expires_at) VALUES (?, ?) ON DUPLICATE KEY UPDATE expires_at = GREATEST(expires_at, ?)",
      [tokenHash, expiration, expiration],
    );
  }

  async transaction(callback) {
    if (this.transactionConnection) return callback(this);
    const connection = await this.database.getConnection();
    try {
      await connection.beginTransaction();
      // Serialize mutations and revalidate the actor after locking all user rows.
      await connection.query("SELECT id FROM users ORDER BY id FOR UPDATE");
      const result = await callback(new MysqlUsersRepository(connection, true));
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
