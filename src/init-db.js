import { pool } from "./db.js";

export async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(200) NOT NULL,
        description VARCHAR(300),
        done BOOLEAN NOT NULL DEFAULT 0,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const [rows] = await pool.query("SELECT COUNT(*) AS total FROM tasks");

    if (rows[0].total === 0) {
      await pool.query(`
        INSERT INTO tasks(title, description)
        VALUES ('Amazing tasks', 'Do de tasks asap');
      `);
      console.log("✅ Tabla creada e insertada");
    } else {
      console.log("✅ Tabla ya existe con datos");
    }
  } catch (error) {
    console.error("❌ Error al inicializar la base de datos:", error);
  }
}
