import assert from "node:assert/strict";
import { afterEach, before, beforeEach, describe, it } from "node:test";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
import { MemoryUsersRepository } from "./support/memory-users.repository.js";
import { hashToken } from "../src/lib/sessions.js";

const SECRET = "users-http-test-only-secret-not-a-deployment-credential";
const PASSWORD = "Testing-password-123";
const ADMIN = "admin@example.test";
const PLAYER = "player@example.test";
const publicKeys = ["email", "first_name", "id", "last_name", "role"];
let initialHash;

before(async () => { initialHash = await bcrypt.hash(PASSWORD, 4); });

describe("Users identity API over real HTTP with an isolated repository", () => {
  let repository;
  let server;
  let baseUrl;

  beforeEach(async () => {
    repository = new MemoryUsersRepository([
      { id: 1, email: ADMIN, first_name: "Admin", last_name: "Test", role: "admin", password: initialHash },
      { id: 2, email: PLAYER, first_name: "Player", last_name: "Test", role: "player", password: initialHash },
    ]);
    const app = createApp({ usersRepository: repository, jwtSecret: SECRET });
    server = await new Promise((resolve) => {
      const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    if (!server) return;
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  async function request(path, { method = "GET", token, body, rawBody } = {}) {
    const response = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined || rawBody !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  async function login(email = ADMIN, password = PASSWORD) {
    const response = await request("/login", { method: "POST", body: { email, password } });
    assert.equal(response.status, 200);
    return response.body;
  }

  async function create(token, overrides = {}) {
    return request("/users", { method: "POST", token, body: {
      email: "new@example.test", first_name: "New", last_name: "User", password: PASSWORD, ...overrides,
    } });
  }

  function assertPublic(user) {
    assert.deepEqual(Object.keys(user).sort(), publicKeys);
    assert.equal(typeof user.id, "number");
    assert.ok(!JSON.stringify(user).includes(initialHash));
  }

  it("returns a public user and signed 12-hour versioned JWT on login", async () => {
    const { token, user } = await login(" ADMIN@EXAMPLE.TEST ");
    assertPublic(user);
    assert.equal(user.role, "admin");
    const decoded = jwt.verify(token, SECRET, { algorithms: ["HS256"] });
    assert.equal(decoded.id, 1);
    assert.equal(decoded.role, "admin");
    assert.equal(decoded.tokenVersion, 0);
    assert.equal(decoded.exp - decoded.iat, 12 * 60 * 60);
    assert.ok(!Object.hasOwn(decoded, "password"));
    const me = await request("/auth/me", { token });
    assert.deepEqual(me, { status: 200, body: { user } });
  });

  it("revokes only the current session, including independent logins in the same second", async () => {
    const actualNow = Date.now;
    const issuedAt = Math.floor(actualNow() / 1000);
    let first;
    let second;
    try {
      Date.now = () => issuedAt * 1000;
      first = await login();
      second = await login();
    } finally {
      Date.now = actualNow;
    }
    const firstClaims = jwt.verify(first.token, SECRET);
    const secondClaims = jwt.verify(second.token, SECRET);
    assert.equal(firstClaims.iat, issuedAt);
    assert.equal(secondClaims.iat, issuedAt);
    assert.match(firstClaims.jti, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.notEqual(firstClaims.jti, secondClaims.jti);
    assert.notEqual(first.token, second.token);
    assert.equal((await request("/logout", { token: first.token, method: "POST" })).status, 204);
    for (const path of ["/auth/me", "/users/contacts", "/users"]) {
      const response = await request(path, { token: first.token });
      assert.equal(response.status, 401);
      assert.equal(response.body.code, "SESSION_REVOKED");
    }
    assert.equal((await request("/logout", { token: first.token, method: "POST" })).status, 401);
    assert.equal((await request("/auth/me", { token: second.token })).status, 200);
    const fresh = await login();
    assert.notEqual(fresh.token, first.token);
    assert.equal((await request("/auth/me", { token: fresh.token })).status, 200);
    assert.equal((await repository.findById(1)).token_version, 0);
  });

  it("revokes legacy tokens without jti by hash and stores neither the token nor its claims", async () => {
    const legacy = jwt.sign({ id: 2, email: PLAYER, first_name: "Legacy" }, SECRET, { expiresIn: 60 });
    const second = await login(PLAYER);
    assert.equal((await request("/auth/me", { token: legacy })).status, 200);
    repository.revokedTokens.set("expired-fixture", 1);
    assert.equal((await request("/logout", { token: legacy, method: "POST" })).status, 204);
    assert.equal((await request("/auth/me", { token: legacy })).status, 401);
    assert.equal((await request("/auth/me", { token: second.token })).status, 200);
    assert.equal(repository.revokedTokens.has("expired-fixture"), false);
    assert.deepEqual([...repository.revokedTokens.keys()], [hashToken(legacy)]);
    assert.match([...repository.revokedTokens.keys()][0], /^[0-9a-f]{64}$/);
    assert.equal([...repository.revokedTokens.values()][0], jwt.decode(legacy).exp);
    assert.equal(JSON.stringify([...repository.revokedTokens]).includes(legacy), false);
  });

  it("keeps revocation in the repository when the HTTP app is recreated", async () => {
    const first = await login();
    const second = await login();
    await request("/logout", { token: first.token, method: "POST" });
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    const app = createApp({ usersRepository: repository, jwtSecret: SECRET });
    server = await new Promise((resolve) => {
      const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await request("/auth/me", { token: first.token })).status, 401);
    assert.equal((await request("/auth/me", { token: second.token })).status, 200);
  });

  it("does not acknowledge logout or authorize requests if the revocation store fails", async () => {
    const { token } = await login();
    repository.revokeToken = async () => { throw new Error("Private database failure"); };
    const result = await request("/logout", { token, method: "POST" });
    assert.deepEqual(result, { status: 500, body: { message: "No se pudo completar la solicitud.", code: "INTERNAL_ERROR" } });
    assert.equal((await request("/auth/me", { token })).status, 200);
    repository.isTokenRevoked = async () => { throw new Error("Private database failure"); };
    assert.equal((await request("/auth/me", { token })).status, 500);
  });

  it("rejects missing, forged, unsigned, expired and malformed sessions", async () => {
    assert.equal((await request("/auth/me")).status, 401);
    const claims = { id: 1, email: ADMIN, role: "admin", tokenVersion: 0 };
    const tokens = [
      "not-a-token",
      jwt.sign(claims, "incorrect-test-secret", { expiresIn: 60 }),
      jwt.sign(claims, SECRET, { expiresIn: -1 }),
      jwt.sign(claims, null, { algorithm: "none", expiresIn: 60 }),
      jwt.sign({ ...claims, tokenVersion: -1 }, SECRET, { expiresIn: 60 }),
      jwt.sign({ ...claims, id: "1" }, SECRET, { expiresIn: 60 }),
      jwt.sign(claims, SECRET),
    ];
    for (const token of tokens) assert.equal((await request("/auth/me", { token })).status, 401);
  });

  it("checks roles in the repository rather than trusting an admin claim", async () => {
    const token = jwt.sign({ id: 2, email: PLAYER, role: "admin", tokenVersion: 0 }, SECRET, { expiresIn: 60 });
    for (const [path, method, body] of [
      ["/users", "GET"], ["/users/1", "GET"],
      ["/users", "POST", { email: "x@example.test" }],
      ["/users/1", "PUT", { role: "player" }], ["/users/1", "DELETE"],
    ]) assert.equal((await request(path, { method, body, token })).status, 403);
    assert.equal((await repository.list()).length, 2);
  });

  it("provides authenticated contacts without private fields and excludes the current user", async () => {
    const { token } = await login(PLAYER);
    const result = await request("/users/contacts", { token });
    assert.equal(result.status, 200);
    assert.equal(result.body.users.length, 1);
    assert.equal(result.body.users[0].email, ADMIN);
    result.body.users.forEach(assertPublic);
    assert.equal((await request("/users/contacts")).status, 401);
  });

  it("creates, reads, updates and deletes users without exposing password hashes", async () => {
    const { token } = await login();
    const created = await create(token, { email: " NEW@EXAMPLE.TEST ", first_name: " New " });
    assert.equal(created.status, 201);
    assertPublic(created.body.user);
    assert.equal(created.body.user.email, "new@example.test");
    assert.equal(created.body.user.first_name, "New");
    assert.equal(created.body.user.role, "player");
    const id = created.body.user.id;
    const stored = await repository.findById(id);
    assert.notEqual(stored.password, PASSWORD);
    assert.equal(await bcrypt.compare(PASSWORD, stored.password), true);
    assert.equal((await request(`/users/${id}`, { token })).status, 200);
    const updated = await request(`/users/${id}`, { method: "PUT", token, body: { first_name: "Updated", last_name: "Name" } });
    assert.equal(updated.status, 200);
    assertPublic(updated.body.user);
    assert.equal(updated.body.user.first_name, "Updated");
    assert.equal((await repository.findById(id)).password, stored.password);
    const listed = await request("/users", { token });
    assert.equal(listed.body.users.length, 3);
    listed.body.users.forEach(assertPublic);
    const session = await login("new@example.test");
    assert.equal((await request(`/users/${id}`, { method: "DELETE", token })).status, 204);
    assert.equal((await request(`/users/${id}`, { token })).status, 404);
    assert.equal((await request("/auth/me", { token: session.token })).status, 401);
  });

  it("rejects normalized duplicate emails in create and update atomically", async () => {
    const { token } = await login();
    assert.equal((await create(token, { email: " PLAYER@EXAMPLE.TEST " })).status, 409);
    assert.equal((await request("/users/2", { method: "PUT", token, body: { email: " ADMIN@EXAMPLE.TEST " } })).status, 409);
    assert.equal((await repository.findById(2)).email, PLAYER);
    assert.equal((await repository.findById(2)).token_version, 0);
  });

  it("rejects invalid types, lengths and arbitrary fields without mutating accounts", async () => {
    const { token } = await login();
    const invalidInputs = [
      { email: "invalid" }, { email: `${"a".repeat(100)}@example.test` },
      { first_name: " " }, { first_name: "a".repeat(101) }, { last_name: 42 },
      { password: "short" }, { password: "é".repeat(37) }, { role: "owner" },
      { id: 99 }, { token_version: 0 }, { tokenVersion: 0 }, { password: null },
    ];
    for (const fields of invalidInputs) assert.equal((await create(token, fields)).status, 400);
    assert.equal((await request("/users/2", { method: "PUT", token, body: {} })).status, 400);
    assert.equal((await request("/users/2", { method: "PUT", token, body: { password: "" } })).status, 400);
    assert.equal((await request("/users/not-an-id", { token })).status, 400);
    assert.equal((await repository.list()).length, 2);
  });

  it("rejects invalid login input and wrong credentials without leaking database details", async () => {
    for (const body of [{ email: ADMIN }, { email: ADMIN, password: {} }, { email: ADMIN, password: PASSWORD, role: "admin" }]) {
      assert.equal((await request("/login", { method: "POST", body })).status, 400);
    }
    assert.equal((await request("/login", { method: "POST", body: { email: ADMIN, password: "wrong" } })).status, 401);
    assert.equal((await request("/login", { method: "POST", body: { email: "unknown@example.test", password: PASSWORD } })).status, 401);
    assert.equal((await request("/login", { method: "POST", rawBody: "{broken" })).status, 400);
    repository.findByEmail = async () => { throw new Error("SQL/private connection details must not be returned"); };
    const error = await request("/login", { method: "POST", body: { email: ADMIN, password: PASSWORD } });
    assert.deepEqual(error, { status: 500, body: { message: "No se pudo completar la solicitud.", code: "INTERNAL_ERROR" } });
  });

  it("keeps sessions for a name edit but invalidates them after email, password or role changes", async () => {
    const admin = await login();
    let player = await login(PLAYER);
    assert.equal((await request("/users/2", { method: "PUT", token: admin.token, body: { first_name: "Renamed" } })).status, 200);
    let me = await request("/auth/me", { token: player.token });
    assert.equal(me.body.user.first_name, "Renamed");
    assert.equal((await repository.findById(2)).token_version, 0);
    const changes = [
      { email: "changed@example.test" }, { password: "New-test-password-456" }, { role: "admin" },
    ];
    let email = PLAYER;
    let password = PASSWORD;
    for (const [index, change] of changes.entries()) {
      assert.equal((await request("/users/2", { method: "PUT", token: admin.token, body: change })).status, 200);
      assert.equal((await request("/auth/me", { token: player.token })).status, 401);
      assert.equal((await repository.findById(2)).token_version, index + 1);
      email = change.email ?? email;
      password = change.password ?? password;
      player = await login(email, password);
      assert.equal((await request("/auth/me", { token: player.token })).status, 200);
    }
    assert.equal((await request("/users", { token: player.token })).status, 200);
  });

  it("accepts legacy version-zero tokens only for the same current id and email", async () => {
    const legacy = jwt.sign({ id: 2, email: PLAYER, first_name: "Old name" }, SECRET, { expiresIn: 60 });
    assert.equal((await request("/auth/me", { token: legacy })).status, 200);
    const wrongEmail = jwt.sign({ id: 2, email: ADMIN }, SECRET, { expiresIn: 60 });
    assert.equal((await request("/auth/me", { token: wrongEmail })).status, 401);
    const { token } = await login();
    await request("/users/2", { method: "PUT", token, body: { role: "admin" } });
    assert.equal((await request("/auth/me", { token: legacy })).status, 401);
  });

  it("prevents an administrator from deleting or demoting their own account", async () => {
    const { token } = await login();
    assert.equal((await request("/users/1", { method: "DELETE", token })).status, 409);
    assert.equal((await request("/users/1", { method: "PUT", token, body: { role: "player" } })).status, 409);
    assert.equal((await repository.findById(1)).role, "admin");
  });

  it("serializes conflicting administrator writes so an administrator remains", async () => {
    const first = await login();
    const secondUser = await create(first.token, { email: "second-admin@example.test", role: "admin" });
    const second = await login("second-admin@example.test");
    const results = await Promise.all([
      request(`/users/${secondUser.body.user.id}`, { method: "DELETE", token: first.token }),
      request("/users/1", { method: "DELETE", token: second.token }),
    ]);
    assert.equal(results.filter((result) => result.status === 204).length, 1);
    assert.equal((await repository.list()).filter((user) => user.role === "admin").length, 1);
  });

  it("revalidates the actor inside the write transaction after an intervening role change", async () => {
    const { token } = await login();
    const originalTransaction = repository.transaction.bind(repository);
    let intervene = true;
    repository.transaction = async (callback) => {
      if (intervene) {
        intervene = false;
        await originalTransaction((tx) => tx.update(1, { role: "player", token_version: 1 }));
      }
      return originalTransaction(callback);
    };
    assert.equal((await create(token)).status, 401);
    assert.equal((await repository.list()).length, 2);
  });
});
