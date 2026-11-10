import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { migrateUserIdentity, INITIAL_ADMIN_EMAIL } from "../src/migrations/users-identity.js";
import { initDatabase } from "../src/init-db.js";

function fakeConnection({ failAlter = false } = {}) {
  const state = { columns: new Set(), applied: false, role: "player", password: "unchanged-fixture-hash", additions: 0, promotions: 0, commits: 0, releases: 0 };
  let snapshot;
  return {
    state,
    async query(sql, parameters = []) {
      if (sql.includes("GET_LOCK")) return [[{ acquired: 1 }]];
      if (sql.includes("INFORMATION_SCHEMA.TABLES")) return [[{ ENGINE: "InnoDB" }]];
      if (sql.includes("INFORMATION_SCHEMA.COLUMNS")) return [[...state.columns].map((COLUMN_NAME) => ({ COLUMN_NAME }))];
      if (sql.startsWith("ALTER TABLE")) {
        if (failAlter) throw Object.assign(new Error("DDL failed in fake adapter"), { code: "DDL_FAILED" });
        state.columns.add(sql.includes("token_version") ? "token_version" : "role");
        state.additions++;
      }
      if (sql.startsWith("SELECT name FROM schema_migrations")) return [state.applied ? [{ name: parameters[0] }] : []];
      if (sql.startsWith("UPDATE users SET role")) {
        assert.equal(parameters[0], INITIAL_ADMIN_EMAIL);
        state.role = "admin";
        state.promotions++;
      }
      if (sql.startsWith("INSERT INTO schema_migrations")) state.applied = true;
      if (sql.includes("SELECT COUNT(*) AS total")) return [[{ total: 1 }]];
      return [[]];
    },
    async beginTransaction() { snapshot = { role: state.role, applied: state.applied }; },
    async commit() { state.commits++; snapshot = undefined; },
    async rollback() { if (snapshot) Object.assign(state, snapshot); snapshot = undefined; },
    release() { state.releases++; },
  };
}

describe("Additive identity migration without a real MySQL database", () => {
  it("adds missing columns once and bootstraps the existing administrator only on the first migration", async () => {
    const connection = fakeConnection();
    await migrateUserIdentity(connection);
    assert.deepEqual([...connection.state.columns].sort(), ["role", "token_version"]);
    assert.equal(connection.state.role, "admin");
    assert.equal(connection.state.password, "unchanged-fixture-hash");
    connection.state.role = "player";
    await migrateUserIdentity(connection);
    assert.equal(connection.state.role, "player");
    assert.equal(connection.state.promotions, 1);
    assert.equal(connection.state.additions, 2);
    assert.equal(connection.state.commits, 1);
  });

  it("propagates DDL failures and does not mark or bootstrap a failed migration", async () => {
    const connection = fakeConnection({ failAlter: true });
    await assert.rejects(migrateUserIdentity(connection), { code: "DDL_FAILED" });
    assert.equal(connection.state.applied, false);
    assert.equal(connection.state.promotions, 0);
  });

  it("propagates initialization errors and releases the initialization connection", async () => {
    const connection = fakeConnection({ failAlter: true });
    await assert.rejects(initDatabase({ getConnection: async () => connection }), { code: "DDL_FAILED" });
    assert.equal(connection.state.releases, 1);
  });
});
