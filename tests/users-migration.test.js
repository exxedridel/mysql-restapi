import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { migrateUserIdentity, INITIAL_ADMIN_EMAIL } from "../src/migrations/users-identity.js";
import { initDatabase } from "../src/init-db.js";
import { migrateSessionRevocations, SESSION_REVOCATION_MIGRATION } from "../src/migrations/session-revocations.js";

function fakeConnection({ failAlter = false, failRevocations = false } = {}) {
  const state = { columns: new Set(), applied: false, role: "player", password: "unchanged-fixture-hash", additions: 0, promotions: 0, commits: 0, releases: 0 };
  let snapshot;
  return {
    state,
    async query(sql, parameters = []) {
      if (failRevocations && sql.includes("CREATE TABLE IF NOT EXISTS revoked_tokens")) {
        throw Object.assign(new Error("Revocation DDL failed in fake adapter"), { code: "REVOCATION_DDL_FAILED" });
      }
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

  it("adds the revocation table idempotently while preserving unexpired rows and existing users", async () => {
    const validHash = "a".repeat(64);
    const expiredHash = "b".repeat(64);
    const now = Math.floor(Date.now() / 1000);
    const revocations = new Map([[validHash, now + 60], [expiredHash, now - 1]]);
    const markers = new Set();
    let creations = 0;
    const connection = {
      async query(sql, parameters = []) {
        if (sql.includes("CREATE TABLE IF NOT EXISTS revoked_tokens")) {
          creations++;
          assert.ok(sql.includes("token_hash CHAR(64)"));
          assert.ok(sql.includes("expires_at BIGINT UNSIGNED"));
          assert.ok(sql.includes("ENGINE=InnoDB"));
        } else if (sql.startsWith("DELETE FROM revoked_tokens")) {
          assert.ok(sql.includes("expires_at <= UNIX_TIMESTAMP()"));
          for (const [hash, expiresAt] of revocations) if (expiresAt <= now) revocations.delete(hash);
        } else if (sql.startsWith("INSERT IGNORE INTO schema_migrations")) {
          markers.add(parameters[0]);
        } else {
          assert.fail("The revocation migration must not change existing user rows or roles");
        }
        return [[]];
      },
    };
    await migrateSessionRevocations(connection);
    await migrateSessionRevocations(connection);
    assert.equal(creations, 2);
    assert.deepEqual([...markers], [SESSION_REVOCATION_MIGRATION]);
    assert.deepEqual([...revocations], [[validHash, now + 60]]);
  });

  it("propagates revocation-table failures before HTTP initialization can complete", async () => {
    const connection = fakeConnection({ failRevocations: true });
    await assert.rejects(initDatabase({ getConnection: async () => connection }), { code: "REVOCATION_DDL_FAILED" });
    assert.equal(connection.state.releases, 1);
  });
});
