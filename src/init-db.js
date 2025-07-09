import { pool } from "./db.js";
import bcrypt from "bcryptjs";

export async function initDatabase() {
  console.log("🚀 Iniciando conexión a la base de datos...");

  try {
    // Crear tabla de tareas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(200) NOT NULL,
        description VARCHAR(300),
        done BOOLEAN NOT NULL DEFAULT 0,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const [taskRows] = await pool.query("SELECT COUNT(*) AS total FROM tasks");
    if (taskRows[0].total === 0) {
      await pool.query(`
        INSERT INTO tasks(title, description)
        VALUES ('Amazing tasks', 'Do de tasks asap');
      `);
      console.log("✅ Tabla 'tasks' creada e insertada");
    }

    // Crear tabla de usuarios
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      );
    `);

    const [userRows] = await pool.query("SELECT COUNT(*) AS total FROM users");
    if (userRows[0].total === 0) {
      const email1 = "hevedrios@gmail.com";
      const email2 = "najerad2223@gmail.com";
      const password = "D1An43vD";
      const hashedPassword = await bcrypt.hash(password, 10);

      await pool.query(
        "INSERT INTO users (email, password) VALUES (?, ?)",
        [email1, hashedPassword]
      );
      await pool.query(
        "INSERT INTO users (email, password) VALUES (?, ?)",
        [email2, hashedPassword]
      );

      console.log(`✅ Usuarios creados: ${email1} y ${email2} / pass: ${password}`);
    } else {
      console.log("✅ Tabla 'users' ya tiene registros");
    }

  } catch (error) {
    console.error("❌ Error al inicializar la base de datos:", error.message);
  }
}
