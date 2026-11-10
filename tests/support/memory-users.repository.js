// Test/QA repository only. Same async interface and serialized transactions as SQL.
export class MemoryUsersRepository {
  constructor(initialUsers = []) {
    this.rows = new Map(initialUsers.map((user) => [Number(user.id), {
      role: "player", token_version: 0, ...structuredClone(user), id: Number(user.id),
    }]));
    this.nextId = Math.max(0, ...this.rows.keys()) + 1;
    this.queue = Promise.resolve();
  }

  async findById(id) {
    const row = this.rows.get(Number(id));
    return row ? structuredClone(row) : null;
  }

  async findByEmail(email) {
    const row = [...this.rows.values()].find((user) => user.email.trim().toLowerCase() === email);
    return row ? structuredClone(row) : null;
  }

  async list() {
    return structuredClone([...this.rows.values()].sort((a, b) => a.id - b.id));
  }

  async create(fields) {
    if (await this.findByEmail(fields.email)) throw Object.assign(new Error("Duplicate email"), { code: "ER_DUP_ENTRY" });
    const row = { ...structuredClone(fields), id: this.nextId++, token_version: 0 };
    this.rows.set(row.id, row);
    return structuredClone(row);
  }

  async update(id, fields) {
    const row = this.rows.get(Number(id));
    if (!row) return null;
    const existing = fields.email ? await this.findByEmail(fields.email) : null;
    if (existing && existing.id !== Number(id)) throw Object.assign(new Error("Duplicate email"), { code: "ER_DUP_ENTRY" });
    Object.assign(row, structuredClone(fields));
    return structuredClone(row);
  }

  async delete(id) {
    this.rows.delete(Number(id));
  }

  async transaction(callback) {
    const previous = this.queue;
    let unlock;
    this.queue = new Promise((resolve) => { unlock = resolve; });
    await previous;
    const rows = structuredClone(this.rows);
    const nextId = this.nextId;
    try {
      return await callback(this);
    } catch (error) {
      this.rows = rows;
      this.nextId = nextId;
      throw error;
    } finally {
      unlock();
    }
  }
}
