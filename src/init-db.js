import bcrypt from "bcryptjs";
import { migrateUserIdentity } from "./migrations/users-identity.js";

export async function initDatabase(database) {
  const connection = await database.getConnection();
  let locked = false;
  try {
    const [result] = await connection.query("SELECT GET_LOCK(?, 20) AS acquired", ["pokemon_users_identity_v1"]);
    if (Number(result[0]?.acquired) !== 1) {
      throw Object.assign(new Error("No se pudo adquirir el bloqueo de inicialización."), { code: "INITIALIZATION_LOCK_TIMEOUT" });
    }
    locked = true;
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(200) NOT NULL,
        description VARCHAR(300),
        isDone BOOLEAN NOT NULL DEFAULT 0,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role ENUM('player', 'admin') NOT NULL DEFAULT 'player',
        token_version INT UNSIGNED NOT NULL DEFAULT 0
      ) ENGINE=InnoDB
    `);
    await migrateUserIdentity(connection);
    const [taskRows] = await connection.query("SELECT COUNT(*) AS total FROM tasks");
    if (Number(taskRows[0].total) === 0) {
      await connection.query("INSERT INTO tasks (title, description) VALUES (?, ?)", ["Amazing tasks", "Do de tasks asap"]);
    }
    await connection.beginTransaction();
    const [userRows] = await connection.query("SELECT COUNT(*) AS total FROM users");
    if (Number(userRows[0].total) === 0) {
      const email1 = "hevedrios@gmail.com";
      const password1 = "Qwe123@9";
      const hashedPassword1 = await bcrypt.hash(password1, 10);
      const first_name1 = "Heved";
      const last_name1 = "Ríos";
      
      const email2 = "najerad2223@gmail.com";
      const password2 = "Diana123";
      const hashedPassword2 = await bcrypt.hash(password2, 10);
      const first_name2 = "Diana";
      const last_name2 = "Nájera";

      await connection.query(
        "INSERT INTO users (email, password, first_name, last_name, role, token_version) VALUES (?, ?, ?, ?, ?, 0)",
        [email1, hashedPassword1, first_name1, last_name1, "player"]
      );
      await connection.query(
        "INSERT INTO users (email, password, first_name, last_name, role, token_version) VALUES (?, ?, ?, ?, ?, 0)",
        [email2, hashedPassword2, first_name2, last_name2, "admin"]
      );


    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    try {
      if (locked) await connection.query("SELECT RELEASE_LOCK(?)", ["pokemon_users_identity_v1"]);
    } finally {
      connection.release();
    }
  }
}
